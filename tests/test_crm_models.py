"""
Unit tests for CRM Models & Schema integrity.
"""

import os
import pytest
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "crm_backend.settings")
django.setup()

from crm.models import Customer, Product, Order, OrderItem, Interaction, SystemConfiguration


def test_customer_model_fields():
    """Verify Customer model structure and key business attributes."""
    assert hasattr(Customer, "company_name")
    assert hasattr(Customer, "contact_person")
    assert hasattr(Customer, "city")
    assert hasattr(Customer, "gstin")
    assert hasattr(Customer, "industry_segment")
    assert hasattr(Customer, "whatsapp_number")


def test_product_model_fields():
    """Verify Product model structure and inventory pricing fields."""
    assert hasattr(Product, "sku_code")
    assert hasattr(Product, "product_name")
    assert hasattr(Product, "selling_price")
    assert hasattr(Product, "landed_cost")
    assert hasattr(Product, "current_stock")
    assert hasattr(Product, "is_dead_stock")


def test_order_model_relationships():
    """Verify Order and OrderItem relationship foreign keys."""
    assert hasattr(Order, "customer")
    assert hasattr(Order, "status")
    assert hasattr(Order, "total_value")
    assert hasattr(OrderItem, "order")
    assert hasattr(OrderItem, "product")
    assert hasattr(OrderItem, "unit_price_applied")


def test_interaction_model_fields():
    """Verify Interaction model for omnichannel interaction tracking."""
    assert hasattr(Interaction, "customer")
    assert hasattr(Interaction, "channel")
    assert hasattr(Interaction, "interaction_type")
    assert hasattr(Interaction, "content_transcript")
