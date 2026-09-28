"""
health_views.py
Health-check endpoint for the Django CRM backend.

Endpoint:
    GET /api/v1/health/ — returns {"status": "ok", ...}
"""
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Simple health check — verifies DB connectivity."""
    db_ok = False
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_ok = True
    except Exception:
        pass

    return Response({
        'status': 'ok' if db_ok else 'degraded',
        'database': 'connected' if db_ok else 'unreachable',
        'service': 'crm_backend',
    })
