import uuid
from django.db import models

class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tally_ledger_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    company_name = models.CharField(max_length=255)
    gstin = models.CharField(max_length=15, null=True, blank=True, unique=True)
    contact_person = models.CharField(max_length=255)
    whatsapp_number = models.CharField(max_length=20, unique=True)
    email = models.EmailField(null=True, blank=True)
    industry_segment = models.CharField(max_length=50)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    lead_source = models.CharField(max_length=50)

    def __str__(self):
        return self.company_name

class SystemConfiguration(models.Model):
    key = models.CharField(max_length=50, unique=True)
    value = models.JSONField(default=dict)

    def __str__(self):
        return self.key


class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tally_item_id = models.CharField(max_length=100, unique=True)
    sku_code = models.CharField(max_length=100, unique=True)
    product_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    uom = models.CharField(max_length=20)
    landed_cost = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    current_stock = models.IntegerField(default=0)
    seasonality_tag = models.CharField(max_length=50, null=True, blank=True)
    is_dead_stock = models.BooleanField(default=False)

    def __str__(self):
        return self.product_name

class Order(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tally_voucher_id = models.CharField(max_length=100, null=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='orders')
    order_date = models.DateTimeField()
    ship_date = models.DateTimeField(null=True, blank=True)
    order_priority = models.CharField(max_length=50)
    freight_mode = models.CharField(max_length=50)
    freight_cost = models.DecimalField(max_digits=10, decimal_places=2)
    total_value = models.DecimalField(max_digits=12, decimal_places=2)
    handled_by = models.CharField(max_length=50)
    status = models.CharField(max_length=50)

class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.IntegerField()
    unit_cost_at_order = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price_applied = models.DecimalField(max_digits=10, decimal_places=2)
    discount_offered = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

class Invoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tally_voucher_id = models.CharField(max_length=100, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='invoices')
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True)
    invoice_date = models.DateField()
    due_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    outstanding_amount = models.DecimalField(max_digits=12, decimal_places=2)
    aging_bucket = models.CharField(max_length=50, null=True, blank=True)

class Interaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='interactions')
    channel = models.CharField(max_length=50)
    interaction_type = models.CharField(max_length=50)
    content_transcript = models.TextField()
    timestamp = models.DateTimeField()