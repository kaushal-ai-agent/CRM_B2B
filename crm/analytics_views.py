from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Sum, Count, F, FloatField, ExpressionWrapper, Q
from django.utils import timezone
from datetime import timedelta
from .models import Order, Invoice, Customer, Product, OrderItem
from .serializers import get_sys_config

@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_kpis(request):
    today = timezone.now().date()
    # Mocking today's enquiries since we don't have an Enquiry model. Using interactions instead.
    enquiries_today = 14 # hardcoded for demo or use Interaction count today
    
    # MTD Revenue
    start_of_month = today.replace(day=1)
    mtd_revenue = Order.objects.filter(order_date__gte=start_of_month).aggregate(
        total=Sum('total_value')
    )['total'] or 0

    # SMLY (Same Month Last Year)
    start_of_last_year_month = start_of_month.replace(year=start_of_month.year - 1)
    # approximated end of month
    smly_revenue = Order.objects.filter(
        order_date__gte=start_of_last_year_month,
        order_date__lt=start_of_last_year_month + timedelta(days=31)
    ).aggregate(total=Sum('total_value'))['total'] or 0

    return Response({
        "enquiries_today": enquiries_today,
        "mtd_revenue": mtd_revenue,
        "smly_revenue": smly_revenue
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_aging(request):
    buckets = {
        '0_30_Days': Sum('outstanding_amount', filter=Q(aging_bucket='0_30_Days')),
        '31_60_Days': Sum('outstanding_amount', filter=Q(aging_bucket='31_60_Days')),
        '61_90_Days': Sum('outstanding_amount', filter=Q(aging_bucket='61_90_Days')),
        '90_Plus_Days': Sum('outstanding_amount', filter=Q(aging_bucket='90_Plus_Days'))
    }
    agings = Invoice.objects.aggregate(**buckets)
    
    return Response({
        "buckets": [
            {"label": "0-30 Days", "value": agings['0_30_Days'] or 0},
            {"label": "31-60 Days", "value": agings['31_60_Days'] or 0},
            {"label": "61-90 Days", "value": agings['61_90_Days'] or 0},
            {"label": "90+ Days", "value": agings['90_Plus_Days'] or 0},
        ]
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_products(request):
    # Top 5 products by revenue
    top_products = OrderItem.objects.values('product__product_name').annotate(
        total_revenue=Sum(ExpressionWrapper(F('quantity') * F('unit_price_applied'), output_field=FloatField()))
    ).order_by('-total_revenue')[:5]

    # Margin snapshots: we take products and their landed_cost vs selling_price
    margins = Product.objects.all()[:5].values('product_name', 'landed_cost', 'selling_price')

    return Response({
        "top_velocity": [{"name": p['product__product_name'], "revenue": p['total_revenue']} for p in top_products],
        "margins": list(margins)
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def analytics_geo(request):
    geo_data = Customer.objects.values('city').annotate(
        revenue=Sum('orders__total_value')
    ).order_by('-revenue')[:10]
    
    return Response({"geo_sales": list(geo_data)})

@api_view(['GET'])
@permission_classes([AllowAny])
def analytics_pareto(request):
    customers = Customer.objects.annotate(
        total_spent=Sum('orders__total_value')
    ).order_by('-total_spent')
    
    total_sales = sum((c.total_spent or 0) for c in customers)
    
    pareto_data = []
    running_total = 0
    for c in customers:
        if not c.total_spent: continue
        running_total += c.total_spent
        perc = (running_total / total_sales) * 100 if total_sales > 0 else 0
        pareto_data.append({
            "company_name": c.company_name,
            "revenue": c.total_spent,
            "cumulative_percent": perc
        })
        if perc >= 80:
            break
            
    return Response({"pareto": pareto_data})
