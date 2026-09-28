"""
Instagram DM Webhook — FastAPI router for Meta Graph API integration.

GET  /api/v1/agent/webhooks/instagram  — Hub Challenge verification
POST /api/v1/agent/webhooks/instagram  — Inbound DM event processing
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response

from agent_service.config.settings import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["instagram"])


# ---------------------------------------------------------------------------
# GET — Meta Hub Challenge verification
# ---------------------------------------------------------------------------

@router.get("/api/v1/agent/webhooks/instagram")
async def verify_webhook(request: Request) -> Response:
    """
    Verify the webhook subscription with Meta.
    Meta sends hub.mode, hub.verify_token, hub.challenge as query params.
    """
    settings = get_settings()
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode == "subscribe" and token == settings.IG_VERIFY_TOKEN:
        logger.info("Instagram webhook verified successfully.")
        return Response(content=challenge, media_type="text/plain")

    logger.warning("Instagram webhook verification failed: mode=%s", mode)
    raise HTTPException(status_code=403, detail="Verification failed")


# ---------------------------------------------------------------------------
# POST — Inbound DM event processing
# ---------------------------------------------------------------------------

@router.post("/api/v1/agent/webhooks/instagram")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> Response:
    """
    Receive inbound Instagram DM events.
    Verifies HMAC-SHA256 signature, then processes asynchronously.
    """
    settings = get_settings()
    raw_body = await request.body()

    # Verify signature
    signature_header = request.headers.get("X-Hub-Signature-256", "")
    if not _verify_signature(raw_body, signature_header, settings.IG_APP_SECRET):
        logger.warning("Instagram webhook: invalid signature")
        raise HTTPException(status_code=403, detail="Invalid signature")

    payload = await request.json()

    # Quick 200 to prevent Meta retries (must respond within 20s)
    background_tasks.add_task(_process_instagram_events, payload)
    return Response(status_code=200)


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------

def _verify_signature(body: bytes, signature_header: str, app_secret: str) -> bool:
    """Validate X-Hub-Signature-256 HMAC."""
    if not signature_header or not app_secret:
        # If no secret configured, skip verification (dev mode)
        logger.warning("Skipping signature verification — IG_APP_SECRET not configured")
        return True

    if not signature_header.startswith("sha256="):
        return False

    expected_sig = signature_header[len("sha256="):]
    computed = hmac.new(
        app_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(computed, expected_sig)


# ---------------------------------------------------------------------------
# Background event processing
# ---------------------------------------------------------------------------

async def _process_instagram_events(payload: dict[str, Any]) -> None:
    """
    Process Instagram DM events in the background.
    Filters for direct messages only (ignores echoes, reads, reactions, comments).
    """
    settings = get_settings()

    if not settings.IG_ENABLED:
        logger.info("Instagram channel disabled — ignoring webhook payload")
        return

    if payload.get("object") != "instagram":
        logger.debug("Ignoring non-instagram webhook object: %s", payload.get("object"))
        return

    for entry in payload.get("entry", []):
        for messaging_event in entry.get("messaging", []):
            await _handle_messaging_event(messaging_event)


async def _handle_messaging_event(event: dict[str, Any]) -> None:
    """Process a single messaging event from the webhook payload."""
    message = event.get("message")
    if not message:
        # Not a message event (could be read receipt, reaction, etc.)
        return

    # Skip echo events (messages sent by us)
    if message.get("is_echo"):
        return

    sender_id = event.get("sender", {}).get("id", "")
    message_text = message.get("text", "")

    if not sender_id:
        logger.warning("Instagram event missing sender.id — skipping")
        return

    if not message_text:
        # Could be an attachment (shared post, reel, etc.)
        attachments = message.get("attachments", [])
        if attachments:
            message_text = f"[Shared media: {attachments[0].get('type', 'unknown')}]"
        else:
            return

    logger.info(
        "Instagram DM received — igsid=%s text_preview=%s",
        sender_id,
        message_text[:50],
    )

    # Route through the agent pipeline
    try:
        from agent_service.channels.instagram_client import handle_instagram_dm
        await handle_instagram_dm(sender_id, message_text)
    except Exception as exc:
        logger.exception("Failed to process Instagram DM from %s: %s", sender_id, exc)
        # Fail-safe: attempt to send fallback message
        try:
            from agent_service.channels.instagram_client import send_fallback_dm
            await send_fallback_dm(sender_id)
        except Exception:
            logger.exception("Failed to send fallback DM to %s", sender_id)
