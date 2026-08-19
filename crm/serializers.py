from rest_framework import serializers
from .models import Customer, Order, Invoice, Interaction

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

class CustomerListSerializer(serializers.ModelSerializer):
    """Used for the lightweight table view of all customers"""
    class Meta:
        model = Customer
        fields = '__all__'

class Customer360Serializer(serializers.ModelSerializer):
    """Used for the detailed Customer 360 screen. Nests all related data."""
    orders = OrderSerializer(many=True, read_only=True)
    invoices = InvoiceSerializer(many=True, read_only=True)
    interactions = InteractionSerializer(many=True, read_only=True)

    class Meta:
        model = Customer
        fields = '__all__'