"""
escalation_views.py
Escalation API for fail-safe red-flag management.

Endpoints:
    GET   /api/v1/escalations/              — list escalations (with filters)
    POST  /api/v1/escalations/<id>/resolve/  — resolve an escalation
"""
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Escalation, AuthToken


# ---------------------------------------------------------------------------
# Auth helper (reused pattern)
# ---------------------------------------------------------------------------

def _get_auth_user(request):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token_str = auth_header[len('Bearer '):]
    try:
        token_obj = AuthToken.objects.select_related('user').get(token=token_str)
    except AuthToken.DoesNotExist:
        return None
    user = token_obj.user
    if not user.is_active:
        return None
    return user


def _auth_required(request):
    user = _get_auth_user(request)
    if user is None:
        return None, Response(
            {'detail': 'Authentication required.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return user, None


# ---------------------------------------------------------------------------
# GET /api/v1/escalations/
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([AllowAny])
def escalations_list(request):
    """List escalations, optionally filtered by status or customer."""
    user, err = _auth_required(request)
    if err:
        return err

    qs = Escalation.objects.select_related('customer', 'assigned_to').all()

    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)

    customer_id = request.query_params.get('customer_id')
    if customer_id:
        qs = qs.filter(customer_id=customer_id)

    limit = min(int(request.query_params.get('limit', 100)), 500)
    offset = int(request.query_params.get('offset', 0))
    total = qs.count()
    escalations = qs[offset:offset + limit]

    data = []
    for e in escalations:
        data.append({
            'id': e.id,
            'customer_id': str(e.customer_id),
            'customer_name': e.customer.company_name,
            'status': e.status,
            'priority': e.priority,
            'error_details': e.error_details,
            'assigned_to': e.assigned_to.name if e.assigned_to else None,
            'resolved_at': e.resolved_at.isoformat() if e.resolved_at else None,
            'resolution_notes': e.resolution_notes,
            'created_at': e.created_at.isoformat(),
        })

    return Response({'total': total, 'results': data})


# ---------------------------------------------------------------------------
# POST /api/v1/escalations/<id>/resolve/
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def resolve_escalation(request, escalation_id):
    """Mark an escalation as resolved."""
    user, err = _auth_required(request)
    if err:
        return err

    try:
        esc = Escalation.objects.get(id=escalation_id)
    except Escalation.DoesNotExist:
        return Response(
            {'detail': 'Escalation not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    esc.status = 'Resolved'
    esc.resolved_at = timezone.now()
    esc.assigned_to = user  # auto-assign to person resolving
    esc.resolution_notes = request.data.get('resolution_notes', '')
    esc.save()

    return Response({
        'id': esc.id,
        'status': esc.status,
        'resolved_at': esc.resolved_at.isoformat(),
        'assigned_to': user.name,
    })
