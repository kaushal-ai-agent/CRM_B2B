from pathlib import Path
import pandas as pd
from django.db import transaction
from crm.models import Customer, Product, Order, OrderItem, Invoice, Interaction

class ExcelIngestionService:
    def __init__(self, data_folder: Path):
        self.data_folder = data_folder

    def run_full_import(self):
        """Processes all Excel files inside database transactions."""
        with transaction.atomic():
            self.import_customers()
            self.import_products()
            self.import_orders()
            self.import_order_items()
            self.import_invoices()
            self.import_interactions()

    def import_customers(self):
        file_path = self.data_folder / "customers.xlsx"
        if not file_path.exists():
            return
            
        df = pd.read_excel(file_path)
        
        # Helper to convert NaN (blank cells) to None for Django
        def clean_val(val):
            if pd.isna(val):
                return None
            return val

        for _, row in df.iterrows():
            Customer.objects.update_or_create(
                id=row["id"],
                defaults={
                    "tally_ledger_id": clean_val(row.get("tally_ledger_id")),
                    "company_name": row["company_name"],
                    "gstin": clean_val(row.get("gstin")),
                    "contact_person": clean_val(row.get("contact_person")),
                    "whatsapp_number": row["whatsapp_number"],
                    "email": clean_val(row.get("email")),
                    "industry_segment": row["industry_segment"],
                    "city": row["city"],
                    "state": row["state"],
                    "lead_source": row["lead_source"],
                    "customer_tier": row["customer_tier"],
                    "is_dormant": row["is_dormant"],
                }
            )

    def import_products(self):
        file_path = self.data_folder / "products.xlsx"
        if not file_path.exists():
            return
            
        df = pd.read_excel(file_path)
        
        # Helper to convert NaN (blank cells) to None for Django
        def clean_val(val):
            if pd.isna(val):
                return None
            return val

        for _, row in df.iterrows():
            Product.objects.update_or_create(
                id=row["id"],
                defaults={
                    "tally_item_id": row["tally_item_id"],
                    "sku_code": row["sku_code"],
                    "product_name": row["product_name"],
                    "category": row["category"],
                    "uom": row["uom"],
                    "landed_cost": row["landed_cost"],
                    "selling_price": row["selling_price"],
                    "current_stock": row["current_stock"],
                    "seasonality_tag": clean_val(row.get("seasonality_tag")),
                    "is_dead_stock": row["is_dead_stock"]
                }
            )
    
    def import_orders(self):
        file_path = self.data_folder / "orders.xlsx"
        if not file_path.exists():
            return
        df = pd.read_excel(file_path)
        
        def clean_val(val):
            return None if pd.isna(val) else val

        for _, row in df.iterrows():
            customer = Customer.objects.filter(id=row["customer_id"]).first()
            if not customer:
                continue # Skip if customer doesn't exist
                
            Order.objects.update_or_create(
                id=row["id"],
                defaults={
                    "tally_voucher_id": clean_val(row.get("tally_voucher_id")),
                    "customer": customer,
                    "order_date": row["order_date"],
                    "ship_date": clean_val(row.get("ship_date")),
                    "order_priority": row["order_priority"],
                    "freight_mode": row["freight_mode"],
                    "freight_cost": row["freight_cost"],
                    "total_value": row["total_value"],
                    "handled_by": row["handled_by"],
                    "status": row["status"]
                }
            )

    def import_order_items(self):
        file_path = self.data_folder / "order_items.xlsx"
        if not file_path.exists():
            return
        df = pd.read_excel(file_path)
        
        for _, row in df.iterrows():
            order = Order.objects.filter(id=row["order_id"]).first()
            product = Product.objects.filter(id=row["product_id"]).first()
            if not order or not product:
                continue
                
            OrderItem.objects.update_or_create(
                id=row["id"],
                defaults={
                    "order": order,
                    "product": product,
                    "quantity": row["quantity"],
                    "unit_cost_at_order": row["unit_cost_at_order"],
                    "unit_price_applied": row["unit_price_applied"],
                    "discount_offered": row["discount_offered"]
                }
            )

    def import_invoices(self):
        file_path = self.data_folder / "invoices.xlsx"
        if not file_path.exists():
            return
        df = pd.read_excel(file_path)
        
        for _, row in df.iterrows():
            customer = Customer.objects.filter(id=row["customer_id"]).first()
            order = Order.objects.filter(id=row["order_id"]).first() if pd.notna(row.get("order_id")) else None
            if not customer:
                continue
                
            Invoice.objects.update_or_create(
                id=row["id"],
                defaults={
                    "tally_voucher_id": row["tally_voucher_id"],
                    "customer": customer,
                    "order": order,
                    "invoice_date": row["invoice_date"],
                    "due_date": row["due_date"],
                    "total_amount": row["total_amount"],
                    "outstanding_amount": row["outstanding_amount"],
                    "aging_bucket": None if pd.isna(row.get("aging_bucket")) else row["aging_bucket"]
                }
            )

    def import_interactions(self):
        file_path = self.data_folder / "interactions.xlsx"
        if not file_path.exists():
            return
        df = pd.read_excel(file_path)
        
        for _, row in df.iterrows():
            customer = Customer.objects.filter(id=row["customer_id"]).first()
            if not customer:
                continue
                
            Interaction.objects.update_or_create(
                id=row["id"],
                defaults={
                    "customer": customer,
                    "channel": row["channel"],
                    "interaction_type": row["interaction_type"],
                    "content_transcript": row["content_transcript"],
                    "timestamp": row["timestamp"]
                }
            )