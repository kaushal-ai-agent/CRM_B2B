import json

from django.conf import settings
from django.http import Http404
from rest_framework import filters, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Max, F, FloatField, ExpressionWrapper, Q
from django.db.models.functions import ExtractMonth, Coalesce
from django.utils import timezone
from datetime import timedelta
from .models import Customer, Order, Invoice, Product, OrderItem
from .serializers import CustomerListSerializer, Customer360Serializer
import django_filters

class CustomerFilter(django_filters.FilterSet):
    customer_tier = django_filters.CharFilter(method='filter_by_tier')
    lead_source = django_filters.CharFilter(field_name='lead_source', lookup_expr='exact')
    industry_segment = django_filters.CharFilter(field_name='industry_segment', lookup_expr='exact')

    class Meta:
        model = Customer
        fields = ['industry_segment', 'lead_source', 'customer_tier']

    def filter_by_tier(self, queryset, name, value):
        from .serializers import get_sys_config
        from django.db.models import Value, FloatField
        
        tier_letter = value.replace('Tier ', '').strip().upper()
        thresholds = get_sys_config('tiering_thresholds', {'A': 500000, 'B': 250000, 'C': 0})
        sorted_tiers = sorted(thresholds.items(), key=lambda x: x[1], reverse=True)
        
        queryset = queryset.annotate(total_spent=Coalesce(Sum('orders__total_value'), Value(0), output_field=FloatField()))
        
        lower_bound = 0
        upper_bound = None
        
        for i, (tier, threshold) in enumerate(sorted_tiers):
            if tier == tier_letter:
                lower_bound = threshold
                if i > 0:
                    upper_bound = sorted_tiers[i-1][1]
                break
                
        if upper_bound is not None:
            return queryset.filter(total_spent__gte=lower_bound, total_spent__lt=upper_bound)
        else:
            return queryset.filter(total_spent__gte=lower_bound)

class CustomerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows customers to be viewed or searched.
    """
    """
    API endpoint that allows customers to be viewed or searched.
    """
    queryset = Customer.objects.all().order_by('company_name')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    
    # Enable search box functionality in the frontend
    search_fields = ['company_name', 'gstin', 'whatsapp_number']
    
    # Enable dropdown filters in the frontend
    filterset_class = CustomerFilter

    def get_serializer_class(self):
        # If fetching a specific customer ID, return the massive 360 view
        if self.action == 'retrieve':
            return Customer360Serializer
        
        # If fetching the list of all customers, return the lightweight data
        return CustomerListSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def write_frontend_logs(request):
    """Append capped browser diagnostics locally while Django runs in DEBUG mode."""
    if not settings.DEBUG:
        raise Http404

    events = request.data.get('events', [])
    if not isinstance(events, list):
        return Response({'detail': 'events must be a list'}, status=status.HTTP_400_BAD_REQUEST)

    safe_events = events[:50]
    log_directory = settings.BASE_DIR / 'logs'
    log_directory.mkdir(exist_ok=True)
    log_path = log_directory / 'frontend.log'

    with log_path.open('a', encoding='utf-8') as log_file:
        for event in safe_events:
            log_file.write(json.dumps(event, ensure_ascii=False, default=str) + '\n')

    return Response({'accepted': len(safe_events)}, status=status.HTTP_202_ACCEPTED)

@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_analytics_v2(request):
    now = timezone.now()
    
    # 1. KPIs
    mtd_revenue = Order.objects.filter(order_date__year=now.year, order_date__month=now.month).aggregate(total=Sum('total_value'))['total'] or 0
    smly_revenue = Order.objects.filter(order_date__year=now.year-1, order_date__month=now.month).aggregate(total=Sum('total_value'))['total'] or 0
    total_customers = Customer.objects.count()
    
    ninety_days_ago = now - timedelta(days=90)
    dormant_customers = Customer.objects.annotate(last_order=Max('orders__order_date')).filter(
        Q(last_order__lt=ninety_days_ago) | Q(last_order__isnull=True)
    ).count()
    
    # 2. Aging Receivables
    aging_buckets = Invoice.objects.values('aging_bucket').annotate(total=Sum('outstanding_amount'))
    aging_data = []
    for b in aging_buckets:
        aging_data.append({"name": b['aging_bucket'] or 'Current', "value": b['total']})
        
    # 3. Seasonal Demand
    monthly_revenue = Order.objects.filter(order_date__year=now.year).annotate(
        month=ExtractMonth('order_date')
    ).values('month').annotate(total=Sum('total_value')).order_by('month')
    
    month_names = {1:'Jan', 2:'Feb', 3:'Mar', 4:'Apr', 5:'May', 6:'Jun', 7:'Jul', 8:'Aug', 9:'Sep', 10:'Oct', 11:'Nov', 12:'Dec'}
    seasonal_data = [{"name": month_names.get(m['month'], str(m['month'])), "value": m['total']} for m in monthly_revenue]
    
    # 4. Pareto Analysis
    top_customers = Customer.objects.annotate(revenue=Sum('orders__total_value')).order_by('-revenue')[:10]
    pareto_data = [{"companyName": c.company_name, "revenue": c.revenue or 0} for c in top_customers]
    
    # 5. Margin Velocity
    top_products = OrderItem.objects.values(
        'product__product_name', 'product__is_dead_stock', 'product__selling_price', 'product__landed_cost'
    ).annotate(
        total_qty=Sum('quantity'),
        total_rev=Sum(ExpressionWrapper(F('quantity') * F('unit_price_applied'), output_field=FloatField()))
    ).order_by('-total_qty')[:5]
    
    margin_data = []
    for p in top_products:
        sp = float(p['product__selling_price'] or 0)
        lc = float(p['product__landed_cost'] or 0)
        margin = ((sp - lc) / sp * 100) if sp else 0
        margin_data.append({
            "productName": p['product__product_name'],
            "isDeadStock": p['product__is_dead_stock'],
            "revenue": p['total_rev'] or 0,
            "units": p['total_qty'] or 0,
            "margin": margin
        })
        
    return Response({
        "kpis": {
            "mtdRevenue": mtd_revenue,
            "smlyRevenue": smly_revenue,
            "totalCustomers": total_customers,
            "dormantCustomers": dormant_customers,
            "todaysEnquiries": 5 # stubbed
        },
        "charts": {
            "agingReceivables": aging_data,
            "seasonalDemand": seasonal_data,
            "paretoAnalysis": pareto_data,
            "marginVelocity": margin_data
        }
    })

