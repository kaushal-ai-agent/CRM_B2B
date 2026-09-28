"""
order_views.py
Order analytics API for the Orders Dashboard.

Endpoints:
    GET  /api/v1/orders/           — list all orders (paginated, filterable)
    GET  /api/v1/orders/analytics/ — KPI summary for dashboard cards
"""
from django.db.models import (
    Sum, Count, Avg, Max, F, Q, Value, CharField,
    DecimalField,
)
from django.db.models.functions import (
    TruncMonth, TruncDate, ExtractYear, Coalesce,
)
from django.utils import timezone
from datetime import timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Order, Customer


# ---------------------------------------------------------------------------
# Helper — resolve Bearer token to any active CRM user
# ---------------------------------------------------------------------------

def _get_auth_user(request):
    from .models import AuthToken
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
# GET /api/v1/orders/
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([AllowAny])
def orders_list(request):
    """Return orders with optional status and date filters."""
    user, err = _auth_required(request)
    if err:
        return err

    qs = Order.objects.select_related('customer').all().order_by('-order_date')

    # Filters
    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)

    handled_by = request.query_params.get('handled_by')
    if handled_by:
        qs = qs.filter(handled_by=handled_by)

    # Simple pagination
    limit = min(int(request.query_params.get('limit', 200)), 500)
    offset = int(request.query_params.get('offset', 0))
    total = qs.count()
    orders = qs[offset:offset + limit]

    data = []
    for o in orders:
        data.append({
            'id': str(o.id),
            'order_date': o.order_date.isoformat() if o.order_date else None,
            'ship_date': o.ship_date.isoformat() if o.ship_date else None,
            'customer_name': o.customer.company_name,
            'customer_id': str(o.customer.id),
            'total_value': float(o.total_value),
            'handled_by': o.handled_by,
            'status': o.status,
            'order_priority': o.order_priority,
            'freight_mode': o.freight_mode,
            'freight_cost': float(o.freight_cost),
        })

    return Response({'total': total, 'results': data})


# ---------------------------------------------------------------------------
# GET /api/v1/orders/analytics/
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([AllowAny])
def orders_analytics(request):
    """Return aggregate KPIs for the Orders Dashboard."""
    user, err = _auth_required(request)
    if err:
        return err

    now = timezone.now()
    current_year = now.year
    current_month = now.month

    all_orders = Order.objects.all()

    # ── KPI Cards ────────────────────────────────────────────────────────
    total_orders = all_orders.count()
    total_revenue = all_orders.aggregate(
        total=Coalesce(Sum('total_value'), Value(0), output_field=DecimalField())
    )['total']
    avg_order_value = all_orders.aggregate(
        avg=Coalesce(Avg('total_value'), Value(0), output_field=DecimalField())
    )['avg']

    # MTD
    mtd_orders = all_orders.filter(
        order_date__year=current_year, order_date__month=current_month
    )
    mtd_count = mtd_orders.count()
    mtd_revenue = mtd_orders.aggregate(
        total=Coalesce(Sum('total_value'), Value(0), output_field=DecimalField())
    )['total']

    # ── Status breakdown ─────────────────────────────────────────────────
    status_breakdown = list(
        all_orders.values('status')
        .annotate(count=Count('id'), value=Sum('total_value'))
        .order_by('-count')
    )

    # ── Handled-by breakdown (AI vs Human) ───────────────────────────────
    handler_breakdown = list(
        all_orders.values('handled_by')
        .annotate(count=Count('id'), value=Sum('total_value'))
        .order_by('-count')
    )

    # ── Monthly trend (current year) ─────────────────────────────────────
    monthly_trend = list(
        all_orders.filter(order_date__year=current_year)
        .annotate(month=TruncMonth('order_date'))
        .values('month')
        .annotate(count=Count('id'), value=Sum('total_value'))
        .order_by('month')
    )
    # Serialize dates
    for item in monthly_trend:
        item['month'] = item['month'].strftime('%b %Y') if item['month'] else ''
        item['value'] = float(item['value'] or 0)

    # ── Priority breakdown ───────────────────────────────────────────────
    priority_breakdown = list(
        all_orders.values('order_priority')
        .annotate(count=Count('id'), value=Sum('total_value'))
        .order_by('-count')
    )

    # ── Top customers by order value ─────────────────────────────────────
    top_customers = list(
        all_orders.values('customer__company_name')
        .annotate(order_count=Count('id'), total_value=Sum('total_value'))
        .order_by('-total_value')[:10]
    )

    # ── Distinct statuses / handlers for filter dropdowns ────────────────
    distinct_statuses = list(
        all_orders.values_list('status', flat=True).distinct()
    )
    distinct_handlers = list(
        all_orders.values_list('handled_by', flat=True).distinct()
    )

    return Response({
        'kpis': {
            'totalOrders': total_orders,
            'totalRevenue': float(total_revenue),
            'avgOrderValue': round(float(avg_order_value), 2),
            'mtdOrders': mtd_count,
            'mtdRevenue': float(mtd_revenue),
        },
        'charts': {
            'statusBreakdown': [
                {'name': s['status'], 'count': s['count'], 'value': float(s['value'] or 0)}
                for s in status_breakdown
            ],
            'handlerBreakdown': [
                {'name': h['handled_by'], 'count': h['count'], 'value': float(h['value'] or 0)}
                for h in handler_breakdown
            ],
            'monthlyTrend': monthly_trend,
            'priorityBreakdown': [
                {'name': p['order_priority'], 'count': p['count'], 'value': float(p['value'] or 0)}
                for p in priority_breakdown
            ],
            'topCustomers': [
                {'name': c['customer__company_name'], 'count': c['order_count'], 'value': float(c['total_value'] or 0)}
                for c in top_customers
            ],
        },
        'filters': {
            'statuses': distinct_statuses,
            'handlers': distinct_handlers,
        },
    })
