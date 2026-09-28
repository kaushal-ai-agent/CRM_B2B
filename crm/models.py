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
    CHANNEL_CHOICES = [
        ("Instagram", "Instagram"),
        ("Web", "Web"),
        ("WhatsApp", "WhatsApp"),
    ]
    channel = models.CharField(max_length=50, choices=CHANNEL_CHOICES)
    interaction_type = models.CharField(max_length=50)
    content_transcript = models.TextField()
    timestamp = models.DateTimeField()


# ---------------------------------------------------------------------------
# Auth — CRMUser & AuthToken
# ---------------------------------------------------------------------------

ROLE_CHOICES = [
    ('Owner', 'Owner'),
    ('Sales', 'Sales'),
    ('Accounts', 'Accounts'),
]


class CRMUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(blank=True, null=True)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Sales')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def set_password(self, raw_password):
        from django.contrib.auth.hashers import make_password
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password_hash)

    def __str__(self):
        return f"{self.username} ({self.role})"


class AuthToken(models.Model):
    user = models.ForeignKey(CRMUser, on_delete=models.CASCADE, related_name='tokens')
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Token for {self.user.username}"


# -------------------------------------------------
# Instagram linking – separate table to avoid touching existing CRMCustomer rows
# Phone number is the natural key across channels
class InstagramCustomerLink(models.Model):
    phone_number = models.CharField(
        max_length=20,
        primary_key=True,
        help_text="Primary key – matches CRMCustomer.phone_number"
    )
    instagram_id = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        help_text="Instagram scoped user ID (igsid)"
    )
    customer = models.ForeignKey(
        'Customer',
        on_delete=models.CASCADE,
        related_name='instagram_links',
        to_field='whatsapp_number',
        db_constraint=False,
        help_text="FK to Customer via phone_number"
    )
    lead_source = models.CharField(max_length=32, default='Instagram')

    class Meta:
        db_table = 'crm_instagram_customer_link'


# Escalation model for fail‑safe handling
class Escalation(models.Model):
    customer = models.ForeignKey('Customer', on_delete=models.CASCADE, related_name='escalations')
    interaction = models.ForeignKey('Interaction', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=16, default='Escalated')
    priority = models.CharField(max_length=16, default='High')
    error_details = models.TextField(blank=True)
    assigned_to = models.ForeignKey(CRMUser, null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_escalations', help_text='User handling the escalation')
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
