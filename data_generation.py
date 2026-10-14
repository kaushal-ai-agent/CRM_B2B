import os
import pandas as pd
import numpy as np
import uuid
import random
from datetime import datetime, timedelta
from faker import Faker

# Initialize Faker with Indian locale for realistic B2B data
fake = Faker('en_IN')
Faker.seed(42)
random.seed(42)

# Ensure data directory exists
DATA_DIR = 'data'
os.makedirs(DATA_DIR, exist_ok=True)

# Helper function to generate UUIDs
def generate_uuid():
    return str(uuid.uuid4())

# Configuration for data volume
NUM_USERS = 5
NUM_CUSTOMERS = 150
NUM_PRODUCTS = 50
NUM_ORDERS = 500

print(f"Creating CRM demo data in '{DATA_DIR}' directory...")

# ==========================================
# 1. USERS
# ==========================================
roles = ['Owner', 'Sales', 'Accounts']
users_data = []
for _ in range(NUM_USERS):
    users_data.append({
        'id': generate_uuid(),
        'name': fake.name(),
        'email': fake.company_email(),
        'role': random.choice(roles),
        'is_active': True
    })
df_users = pd.DataFrame(users_data)
df_users.to_excel(f'{DATA_DIR}/users.xlsx', index=False)
print("users.xlsx created")

# ==========================================
# 2. CUSTOMERS
# ==========================================
industry_segments = ['Manufacturing', 'Retail', 'Hospitality', 'Hospital']
lead_sources = ['Tally_Import', 'IndiaMART', 'TradeIndia', 'Direct']
cities = ['Pune', 'Mumbai', 'Delhi', 'Ahmedabad', 'Bangalore', 'Surat']

customers_data = []
for i in range(NUM_CUSTOMERS):
    is_tally_import = random.random() > 0.3
    customers_data.append({
        'id': generate_uuid(),
        'tally_ledger_id': f"TALLY-LDG-{1000+i}" if is_tally_import else None,
        'company_name': fake.company(),
        'gstin': f"{random.randint(10, 37)}{fake.lexify(text='?????')}{random.randint(1000, 9999)}{fake.lexify(text='?')}1Z{fake.lexify(text='?')}".upper(),
        'contact_person': fake.name(),
        'whatsapp_number': f"+91{fake.numerify(text='##########')}",
        'email': fake.company_email(),
        'industry_segment': random.choice(industry_segments),
        'city': random.choice(cities),
        'state': 'Maharashtra' if random.random() > 0.2 else fake.state(),
        'lead_source': random.choice(lead_sources)
    })
df_customers = pd.DataFrame(customers_data)
df_customers.to_excel(f'{DATA_DIR}/customers.xlsx', index=False)
print("✅ customers.xlsx created")

# ==========================================
# 3. PRODUCTS
# ==========================================
categories = ['Fittings', 'Pipes', 'Valves', 'Pumps', 'Fasteners']
uoms = ['Box', 'Nos', 'Kg', 'Meters']
seasonality = [None, 'Monsoon', 'Summer', 'Winter']

products_data = []
for i in range(NUM_PRODUCTS):
    landed_cost = round(random.uniform(100, 5000), 2)
    selling_price = round(landed_cost * random.uniform(1.15, 1.40), 2) # 15% to 40% margin
    products_data.append({
        'id': generate_uuid(),
        'tally_item_id': f"TALLY-ITM-{800+i}",
        'sku_code': f"{fake.lexify(text='???').upper()}-{random.randint(100, 999)}",
        'product_name': f"Industrial {fake.word().capitalize()} {random.randint(10, 100)}mm",
        'category': random.choice(categories),
        'uom': random.choice(uoms),
        'landed_cost': landed_cost,
        'selling_price': selling_price,
        'current_stock': random.randint(0, 1000),
        'seasonality_tag': random.choice(seasonality),
        'is_dead_stock': random.random() < 0.05
    })
df_products = pd.DataFrame(products_data)
df_products.to_excel(f'{DATA_DIR}/products.xlsx', index=False)
print("✅ products.xlsx created")

# ==========================================
# 4. ORDERS & 5. ORDER_ITEMS
# ==========================================
priorities = ['High', 'Normal', 'Low']
freight_modes = ['Express_Air', 'Express_Surface', 'Regular']
handled_by_options = ['AI_Agent', 'Human_Salesperson']
statuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Synced_To_Tally']

orders_data = []
order_items_data = []

customer_ids = df_customers['id'].tolist()
product_records = df_products.to_dict('records')

for i in range(NUM_ORDERS):
    order_id = generate_uuid()
    order_date = fake.date_time_between(start_date='-1y', end_date='now')
    ship_date = order_date + timedelta(days=random.randint(1, 5)) if random.random() > 0.2 else None
    
    # Generate Line Items
    num_items = random.randint(1, 5)
    order_total = 0
    
    for _ in range(num_items):
        prod = random.choice(product_records)
        qty = random.randint(1, 50)
        discount = round(random.uniform(0, 50), 2) if random.random() > 0.7 else 0.0
        unit_price = prod['selling_price'] - discount
        
        order_items_data.append({
            'id': generate_uuid(),
            'order_id': order_id,
            'product_id': prod['id'],
            'quantity': qty,
            'unit_cost_at_order': prod['landed_cost'],
            'unit_price_applied': unit_price,
            'discount_offered': discount
        })
        order_total += (unit_price * qty)
    
    # Generate Order Header
    orders_data.append({
        'id': order_id,
        'tally_voucher_id': f"SO-2026-{1000+i}" if random.random() > 0.3 else None,
        'customer_id': random.choice(customer_ids),
        'order_date': order_date,
        'ship_date': ship_date,
        'order_priority': random.choice(priorities),
        'freight_mode': random.choice(freight_modes),
        'freight_cost': round(random.uniform(100, 1000), 2),
        'total_value': round(order_total, 2),
        'handled_by': random.choice(handled_by_options),
        'status': random.choice(statuses)
    })

df_orders = pd.DataFrame(orders_data)
df_orders.to_excel(f'{DATA_DIR}/orders.xlsx', index=False)
print("✅ orders.xlsx created")

df_order_items = pd.DataFrame(order_items_data)
df_order_items.to_excel(f'{DATA_DIR}/order_items.xlsx', index=False)
print("✅ order_items.xlsx created")

# ==========================================
# 6. INVOICES
# ==========================================
aging_buckets = ['0_30_Days', '31_60_Days', '61_90_Days', '90_Plus_Days']
invoices_data = []

# Generate invoices for about 70% of the orders
for order in random.sample(orders_data, int(NUM_ORDERS * 0.7)):
    inv_date = order['order_date'] + timedelta(days=random.randint(1, 3))
    total_amt = order['total_value'] + order['freight_cost']
    
    # 40% chance the invoice is fully paid (outstanding = 0)
    outstanding = 0.0 if random.random() < 0.4 else round(random.uniform(100, total_amt), 2)
    
    invoices_data.append({
        'id': generate_uuid(),
        'tally_voucher_id': f"INV-2526-{random.randint(10000, 99999)}",
        'customer_id': order['customer_id'],
        'order_id': order['id'],
        'invoice_date': inv_date.date(),
        'due_date': (inv_date + timedelta(days=30)).date(),
        'total_amount': round(total_amt, 2),
        'outstanding_amount': outstanding,
        'aging_bucket': random.choice(aging_buckets) if outstanding > 0 else None
    })

df_invoices = pd.DataFrame(invoices_data)
df_invoices.to_excel(f'{DATA_DIR}/invoices.xlsx', index=False)
print("✅ invoices.xlsx created")

# ==========================================
# 7. INTERACTIONS
# ==========================================
channels = ['WhatsApp', 'Email']
interaction_types = ['AI_Chat', 'Campaign_Blast', 'Payment_Reminder', 'Quote_Sent']
interactions_data = []

for _ in range(300):
    interactions_data.append({
        'id': generate_uuid(),
        'customer_id': random.choice(customer_ids),
        'channel': random.choice(channels),
        'interaction_type': random.choice(interaction_types),
        'content_transcript': fake.sentence(nb_words=10),
        'timestamp': fake.date_time_between(start_date='-3m', end_date='now')
    })

df_interactions = pd.DataFrame(interactions_data)
df_interactions.to_excel(f'{DATA_DIR}/interactions.xlsx', index=False)
print("✅ interactions.xlsx created")

# ==========================================
# 8. SYNC_QUEUES
# ==========================================
entity_types = ['Customer', 'Order', 'Invoice']
sync_statuses = ['Pending', 'Success', 'Failed']
sync_data = []

for _ in range(50):
    status = random.choice(sync_statuses)
    sync_data.append({
        'id': generate_uuid(),
        'entity_type': random.choice(entity_types),
        'entity_id': generate_uuid(),
        'status': status,
        'retry_count': random.randint(0, 3) if status != 'Success' else 1,
        'last_error': "Tally ODBC server unreachable." if status == 'Failed' else None
    })

df_sync = pd.DataFrame(sync_data)
df_sync.to_excel(f'{DATA_DIR}/sync_queues.xlsx', index=False)
print("✅ sync_queues.xlsx created")

# ==========================================
# 9. SYSTEM_CONFIGURATIONS
# ==========================================
configs_data = [
    {
        'key': 'tiering_thresholds',
        'value': {'A': 500000, 'B': 250000, 'C': 0}
    },
    {
        'key': 'dormancy_days',
        'value': 90
    },
    {
        'key': 'churn_risk_baseline',
        'value': 'selling_price' # Can be a string referencing which column or catalog to use
    }
]
import json
for c in configs_data:
    c['value'] = json.dumps(c['value'])

df_configs = pd.DataFrame(configs_data)
df_configs.to_excel(f'{DATA_DIR}/system_configurations.xlsx', index=False)
print("✅ system_configurations.xlsx created")

print(f"\n🎉 All 9 datasets successfully generated in the '{DATA_DIR}' folder!")