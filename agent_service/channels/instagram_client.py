"""
Instagram Client — outbound DM dispatch and agent pipeline integration.

Handles:
    - Sending DMs via Meta Graph API
    - Customer identity resolution (igsid → CRM customer)
    - Routing messages through the LangGraph agent
    - Fail-safe fallback messaging
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any, Optional

import httpx

from agent_service.config.settings import get_settings
from agent_service.graph.agent_graph import run_agent_turn

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Fallback message
# ---------------------------------------------------------------------------

FALLBACK_TEXT = (
    "Our AI assistant is currently unavailable. A sales executive has been "
    "notified and will message you shortly."
)


# ---------------------------------------------------------------------------
# Django ORM bootstrap (for CRM access from within FastAPI worker)
# ---------------------------------------------------------------------------

_django_ready = False


def _ensure_django() -> None:
    """Initialise Django ORM if not already done."""
    global _django_ready
    if _django_ready:
        return

    project_root = Path(__file__).resolve().parent.parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "crm_backend.settings")

    import django
    django.setup()
    _django_ready = True


# ---------------------------------------------------------------------------
# Customer identity resolution
# ---------------------------------------------------------------------------

def _resolve_customer(igsid: str, mid: str | None = None) -> Optional[dict]:
    """
    Resolve an Instagram-scoped ID to a CRM customer.
    Returns dict with customer details or None if not found.
    """
    _ensure_django()
    from crm.models import InstagramCustomerLink

    try:
        link = InstagramCustomerLink.objects.select_related('customer').get(
            instagram_id=igsid
        )
        # Fetch username if we don't have it yet and mid is available
        if not link.instagram_username and mid:
            username = _fetch_instagram_username(mid)
            if username:
                link.instagram_username = username
                link.save(update_fields=['instagram_username'])

        customer = link.customer
        return {
            'id': str(customer.id),
            'company_name': customer.company_name,
            'contact_person': customer.contact_person,
            'whatsapp_number': customer.whatsapp_number,
            'phone_number': link.phone_number,
            'profile_complete': bool(customer.contact_person and customer.whatsapp_number),
            'instagram_username': link.instagram_username,
        }
    except InstagramCustomerLink.DoesNotExist:
        return None


def _create_customer_from_instagram(
    igsid: str,
    name: str,
    phone: str,
    mid: str | None = None,
) -> dict:
    """
    Create a new CRM customer linked to an Instagram ID.
    If a customer with that phone already exists, just link them.
    """
    _ensure_django()
    from crm.models import Customer, InstagramCustomerLink

    # Fetch username if possible
    username = _fetch_instagram_username(mid) if mid else None

    # Check if customer with this phone already exists (cross-channel merge)
    existing = Customer.objects.filter(whatsapp_number=phone).first()

    if existing:
        # Link existing customer to Instagram
        link, _ = InstagramCustomerLink.objects.update_or_create(
            phone_number=phone,
            defaults={
                'instagram_id': igsid,
                'customer': existing,
            }
        )
        if username and link.instagram_username != username:
            link.instagram_username = username
            link.save(update_fields=['instagram_username'])
        
        return {
            'id': str(existing.id),
            'company_name': existing.company_name,
            'contact_person': existing.contact_person,
            'whatsapp_number': existing.whatsapp_number,
            'profile_complete': True,
        }
    else:
        # Create new customer
        import uuid
        customer = Customer.objects.create(
            id=uuid.uuid4(),
            company_name=name,
            contact_person=name,
            whatsapp_number=phone,
            lead_source='Instagram',
            industry_segment='Unknown',
            city='Unknown',
            state='Unknown',
        )
        InstagramCustomerLink.objects.create(
            phone_number=phone,
            instagram_id=igsid,
            customer=customer,
            instagram_username=username,
        )
        return {
            'id': str(customer.id),
            'company_name': name,
            'contact_person': name,
            'whatsapp_number': phone,
            'profile_complete': True,
        }


def _fetch_instagram_username(mid: str) -> str | None:
    """Fetch sender username using the message ID."""
    import requests
    settings = get_settings()
    if not settings.IG_ACCESS_TOKEN or not mid:
        return None
    try:
        # GET https://graph.instagram.com/{VERSION}/{mid}?fields=from&access_token={IG_ACCESS_TOKEN}
        # Based on Meta Graph API documentation
        url = f"{settings.IG_API_BASE_URL}/{settings.IG_API_VERSION}/{mid}"
        params = {
            "fields": "from",
            "access_token": settings.IG_ACCESS_TOKEN
        }
        
        logger.debug(f"[Graph API] Fetching username for mid={mid}")
        logger.debug(f"[Graph API] Request URL: {url}?fields=from")
        
        resp = requests.get(url, params=params, timeout=10)
        logger.debug(f"[Graph API] Fetch Username Status: {resp.status_code}")
        logger.debug(f"[Graph API] Fetch Username Response: {resp.text}")
        
        if resp.status_code == 200:
            data = resp.json()
            return data.get("from", {}).get("username")
        else:
            logger.warning("Failed to fetch IG username for mid=%s: status=%d body=%s", mid, resp.status_code, resp.text)
    except Exception as exc:
        logger.exception("Error fetching IG username: %s", exc)
    return None


# ---------------------------------------------------------------------------
# CRM interaction logging
# ---------------------------------------------------------------------------

def _log_interaction(customer_id: str, text: str, direction: str = "inbound") -> None:
    """Log an interaction to the CRM database."""
    _ensure_django()
    from crm.models import Interaction
    from django.utils import timezone

    try:
        Interaction.objects.create(
            customer_id=customer_id,
            channel="Instagram",
            interaction_type="AI_Chat",
            content_transcript=f"[{direction}] {text}",
            timestamp=timezone.now(),
        )
    except Exception as exc:
        logger.error("Failed to log CRM interaction: %s", exc)


# ---------------------------------------------------------------------------
# Escalation creation
# ---------------------------------------------------------------------------

def _create_escalation(customer_id: str, error_details: str) -> None:
    """Create an escalation record in the CRM database."""
    _ensure_django()
    from crm.models import Escalation

    try:
        Escalation.objects.create(
            customer_id=customer_id,
            status="Escalated",
            priority="High",
            error_details=error_details,
        )
        logger.info("Escalation created for customer %s", customer_id)
    except Exception as exc:
        logger.error("Failed to create escalation: %s", exc)


# ---------------------------------------------------------------------------
# Outbound DM dispatch
# ---------------------------------------------------------------------------

async def _send_dm(recipient_id: str, text: str) -> bool:
    """Send a DM via the Instagram Graph API."""
    settings = get_settings()

    if not settings.IG_ACCESS_TOKEN:
        logger.error("Cannot send Instagram DM — IG_ACCESS_TOKEN not configured")
        return False

    # Truncate to Meta's 1000-byte UTF-8 limit
    encoded = text.encode("utf-8")
    if len(encoded) > 1000:
        text = encoded[:997].decode("utf-8", errors="ignore") + "…"

    url = (
        f"{settings.IG_API_BASE_URL}/{settings.IG_API_VERSION}"
        f"/{settings.IG_ACCOUNT_ID}/messages"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "recipient": {"id": recipient_id},
                "message": {"text": text},
            }
            logger.debug(f"[Graph API] Sending DM to recipient={recipient_id}")
            logger.debug(f"[Graph API] DM Payload: {payload}")
            
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {settings.IG_ACCESS_TOKEN}"},
                json=payload,
            )
            
            logger.debug(f"[Graph API] DM Response Status: {resp.status_code}")
            logger.debug(f"[Graph API] DM Response Body: {resp.text}")
            
            if resp.status_code == 200:
                logger.info("DM sent to %s (status=%d)", recipient_id, resp.status_code)
                return True
            else:
                logger.error(
                    "DM send failed: status=%d body=%s",
                    resp.status_code,
                    resp.text[:200],
                )
                return False
        except Exception as exc:
            logger.exception("DM send error to %s: %s", recipient_id, exc)
            return False


# ---------------------------------------------------------------------------
# Fallback DM
# ---------------------------------------------------------------------------

async def send_fallback_dm(recipient_id: str) -> None:
    """Send the standard fail-safe fallback message."""
    await _send_dm(recipient_id, FALLBACK_TEXT)


# ---------------------------------------------------------------------------
# Main handler — routes through LangGraph agent
# ---------------------------------------------------------------------------

async def handle_instagram_dm(igsid: str, message_text: str, mid: str | None = None) -> None:
    """
    Full pipeline: identity resolution → agent graph → outbound DM.
    """
    settings = get_settings()

    # 1. Resolve customer identity
    customer = _resolve_customer(igsid, mid)
    session_id = f"ig_{igsid}"

    if customer is None:
        # New customer — needs onboarding
        # For now, send a welcome message asking for name and phone
        welcome = (
            "Welcome to our B2B Trading platform! 🙏\n\n"
            "I'm your AI sales assistant. To help you with product enquiries "
            "and place orders, I'll need a few details:\n\n"
            "Please share your:\n"
            "1. Full Name\n"
            "2. WhatsApp/Phone Number (10 digits)\n\n"
            "This helps us create your trade account."
        )
        await _send_dm(igsid, welcome)
        return

    customer_id = customer['id']

    # 2. Log inbound interaction
    _log_interaction(customer_id, message_text, "inbound")

    # 3. Run through agent graph
    try:
        final_state = run_agent_turn(
            message_text=message_text,
            session_id=session_id,
            customer_id=customer_id,
        )

        response_text = final_state.get("response_text", "")
        escalation = final_state.get("escalation_flag", False)

        if escalation or not response_text:
            # Fail-safe
            await _send_dm(igsid, FALLBACK_TEXT)
            _create_escalation(
                customer_id,
                f"Agent escalation — intent={final_state.get('intent')}, "
                f"confidence={final_state.get('confidence')}",
            )
            _log_interaction(customer_id, FALLBACK_TEXT, "outbound_failsafe")
        else:
            # Success — send response
            await _send_dm(igsid, response_text)
            _log_interaction(customer_id, response_text, "outbound")

    except Exception as exc:
        logger.exception("Agent graph failed for igsid=%s: %s", igsid, exc)
        await _send_dm(igsid, FALLBACK_TEXT)
        _create_escalation(customer_id, f"Runtime error: {exc}")
        _log_interaction(customer_id, FALLBACK_TEXT, "outbound_failsafe")
