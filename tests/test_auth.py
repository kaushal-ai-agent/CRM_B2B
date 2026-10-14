"""
Unit tests for CRM Authentication and User Roles (RBAC).
"""

import os
import pytest
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "crm_backend.settings")
django.setup()

from crm.models import CRMUser, AuthToken
from crm.auth_views import login_view, _get_owner
from crm.user_serializers import CRMUserSerializer, CreateUserSerializer


def test_auth_views_import():
    """Verify auth views and handlers are cleanly importable."""
    assert login_view is not None
    assert _get_owner is not None


def test_crm_user_serializer():
    """Verify CRMUserSerializer serializes expected user fields."""
    user = CRMUser(
        username="test_owner",
        name="Rahul Sharma",
        role="Owner",
        is_active=True,
    )
    serializer = CRMUserSerializer(user)
    data = serializer.data
    assert data["username"] == "test_owner"
    assert data["name"] == "Rahul Sharma"
    assert data["role"] == "Owner"
