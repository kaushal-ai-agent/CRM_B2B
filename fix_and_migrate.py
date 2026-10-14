"""
fix_and_migrate.py
1. Cleans orphaned crm_interaction rows (bad FK to non-existent customer)
2. Creates CRMUser + AuthToken tables via direct SQL (bypassing schema editor FK check)
3. Marks migration 0003 as applied
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'crm_backend.settings')
django.setup()

from django.db import connection

print("Step 1: Cleaning orphaned crm_interaction rows...")
with connection.cursor() as c:
    c.execute("""
        DELETE FROM crm_interaction
        WHERE customer_id NOT IN (SELECT id FROM crm_customer)
    """)
    deleted = c.rowcount
    print(f"  Deleted {deleted} orphaned rows.")

print("Step 2: Creating crm_crmuser table...")
with connection.cursor() as c:
    c.execute("""
        CREATE TABLE IF NOT EXISTS "crm_crmuser" (
            "id" char(32) NOT NULL PRIMARY KEY,
            "name" varchar(255) NOT NULL,
            "username" varchar(150) NOT NULL UNIQUE,
            "email" varchar(254) NULL,
            "password_hash" varchar(255) NOT NULL,
            "role" varchar(20) NOT NULL,
            "is_active" bool NOT NULL,
            "created_at" datetime NOT NULL
        )
    """)

print("Step 3: Creating crm_authtoken table...")
with connection.cursor() as c:
    c.execute("""
        CREATE TABLE IF NOT EXISTS "crm_authtoken" (
            "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
            "token" varchar(64) NOT NULL UNIQUE,
            "created_at" datetime NOT NULL,
            "user_id" char(32) NOT NULL REFERENCES "crm_crmuser" ("id")
        )
    """)
    c.execute("""
        CREATE INDEX IF NOT EXISTS "crm_authtoken_token_idx"
        ON "crm_authtoken" ("token")
    """)

print("Step 4: Marking migration 0003 as applied...")
from django.core.management import call_command
call_command('migrate', '--fake', 'crm', '0003_crmuser_authtoken')

print("Done. Now seeding users...")
call_command('migrate', '--run-syncdb')
print("All done!")
