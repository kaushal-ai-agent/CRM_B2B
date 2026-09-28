"""Quick import test for auth_views."""
import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'crm_backend.settings'
django.setup()
from crm.auth_views import login_view, users_view, user_detail_view
from crm.user_serializers import CRMUserSerializer, CreateUserSerializer, PatchUserSerializer
from crm.models import CRMUser, AuthToken
print("All auth imports OK")
print(f"Users in DB: {CRMUser.objects.count()}")
