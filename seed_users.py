"""Manually trigger the seed for first-time setup."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'crm_backend.settings')
django.setup()

from crm.apps import _seed_users_handler
_seed_users_handler(None)
print("Seeding complete. Users in DB:")

from crm.models import CRMUser
for u in CRMUser.objects.all():
    print(f"  - {u.username} / {u.role} / active={u.is_active}")
