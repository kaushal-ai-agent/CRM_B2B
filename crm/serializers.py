from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
import json
from .models import Customer, Order, Invoice, Interaction, SystemConfiguration

def get_sys_config(key, default):
    try:
        conf = SystemConfiguration.objects.get(key=key)
        if isinstance(conf.value, str):
            try:
                return json.loads(conf.value)
            except json.JSONDecodeError:
                return conf.value
        return conf.value
    except SystemConfiguration.DoesNotExist:
        return default

class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = '__all__'

class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = '__all__'

class InteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interaction
        fields = '__all__'

class DynamicCustomerMixin:
    """Provides dynamic profiling fields for Customers"""
    
    def get_is_dormant(self, obj):
        dormancy_days = get_sys_config('dormancy_days', 90)
        last_order = obj.orders.order_by('-order_date').first()
        if not last_order:
            return True
        cutoff = timezone.now() - timedelta(days=dormancy_days)
        return last_order.order_date < cutoff

    def get_customer_tier(self, obj):
        thresholds = get_sys_config('tiering_thresholds', {'A': 500000, 'B': 250000, 'C': 0})
        total_spent = sum(o.total_value for o in obj.orders.all())
        # Sort thresholds descending by value
        sorted_tiers = sorted(thresholds.items(), key=lambda x: x[1], reverse=True)
        for tier, threshold in sorted_tiers:
            if total_spent >= threshold:
                return tier
        return 'C'

class CustomerListSerializer(serializers.ModelSerializer, DynamicCustomerMixin):
    """Used for the lightweight table view of all customers"""
    is_dormant = serializers.SerializerMethodField()
    customer_tier = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = '__all__'

class Customer360Serializer(serializers.ModelSerializer, DynamicCustomerMixin):
    """Used for the detailed Customer 360 screen. Nests all related data."""
    orders = OrderSerializer(many=True, read_only=True)
    invoices = InvoiceSerializer(many=True, read_only=True)
    interactions = InteractionSerializer(many=True, read_only=True)
    
    is_dormant = serializers.SerializerMethodField()
    customer_tier = serializers.SerializerMethodField()
    product_affinity = serializers.SerializerMethodField()
    churn_risk_flag = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = '__all__'

    def get_product_affinity(self, obj):
        from collections import Counter
        categories = []
        for o in obj.orders.all():
            for item in o.items.all():
                categories.append(item.product.category)
        if not categories:
            return "None"
        most_common = Counter(categories).most_common(1)
        return most_common[0][0]

    def get_churn_risk_flag(self, obj):
        # Churn-Risk Flagging (R1.23): Compare last purchase price to baseline
        baseline = get_sys_config('churn_risk_baseline', 'selling_price')
        last_order = obj.orders.order_by('-order_date').first()
        if not last_order:
            return False
        
        for item in last_order.items.all():
            baseline_val = getattr(item.product, baseline, None)
            if baseline_val and item.unit_price_applied > baseline_val:
                return True
        return False