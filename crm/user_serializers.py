"""
user_serializers.py
Serializers for CRMUser CRUD and auth operations.
"""
from rest_framework import serializers
from .models import CRMUser


class CRMUserSerializer(serializers.ModelSerializer):
    """Read-only representation of a CRM user (safe — no password hash)."""

    class Meta:
        model = CRMUser
        fields = ['id', 'name', 'username', 'email', 'role', 'is_active', 'created_at']


class CreateUserSerializer(serializers.Serializer):
    """Validates payload for creating a new team member."""
    name = serializers.CharField(max_length=255)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=['Sales', 'Accounts'])

    def validate_username(self, value):
        if CRMUser.objects.filter(username=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value


class PatchUserSerializer(serializers.Serializer):
    """Validates partial update payload — password reset and/or active toggle."""
    password = serializers.CharField(write_only=True, min_length=6, required=False)
    is_active = serializers.BooleanField(required=False)
