"""Fix orphan interaction rows that reference non-existent customers."""
import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'crm_backend.settings'
django.setup()

from django.db import connection

with connection.cursor() as cur:
    cur.execute("""
        DELETE FROM crm_interaction
        WHERE customer_id NOT IN (SELECT id FROM crm_customer)
    """)
    print(f"Deleted {cur.rowcount} orphan interaction rows.")
