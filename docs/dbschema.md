# Database Schema

## Overview

This document presents the CRM database schema in a structured Markdown format for easier review and reference.

## Entity Summary

| Table | Purpose |
| --- | --- |
| users | Manages staff access and role-based permissions for the CRM. |
| customers | The centralized CRM table containing Tally-synced clients and new leads, including geographic and segment data. |
| products | The canonical master catalog, tracking costs, selling prices, and live inventory. |
| orders | The header table for all sales transactions, incorporating shipping and priority data. |
| order_items | Individual line items within an order, capturing point-in-time costs and discounts for accurate historical profit calculation. |
| invoices | Tracks financial receivables, outstanding balances, and aging for the payment nudges. |
| interactions | The audit trail of AI conversations, campaigns, and system nudges to prevent overlapping communications. |
| sync_queues | Manages offline tolerance by queuing records that need to be pushed back to Tally and tracking retries. |

## 1. users

Description: Manages staff access and role-based permissions for the CRM.

| Field | Type | Details |
| --- | --- | --- |
| id | UUID, Primary Key | Unique identifier for the user. Example: 550e8400-e29b-41d4-a716-446655440000 |
| name | String | Full name of the employee. Example: Rahul Sharma |
| email | String, Unique | Login email address. Example: rahul.s@clientdomain.com |
| role | Enum | Defines system access level. Example: Sales (Values: Owner, Sales, Accounts) |
| is_active | Boolean | Indicates if the user account is active. Example: True |

## 2. customers

Description: The centralized CRM table containing Tally-synced clients and new leads, including geographic and segment data.

| Field | Type | Details |
| --- | --- | --- |
| id | UUID, Primary Key | Internal CRM identifier. |
| tally_ledger_id | String, Nullable, Unique | The exact ledger ID from Tally for two-way sync. Example: TALLY-LDG-1045 |
| company_name | String | Registered business name. Example: Apex Manufacturing Pvt Ltd |
| gstin | String, Nullable, Unique | 15-character Indian tax ID used for deduplication. Example: 27AAPFU0939F1Z5 |
| contact_person | String | Name of the primary buyer. Example: Vikram Singh |
| whatsapp_number | String, Unique | Primary number for AI interaction and campaigns. Example: +919876543210 |
| email | String, Nullable | Contact email. Example: purchase@apex.in |
| industry_segment | Enum | Retail/B2B categorization. Example: Hospitality (Values: Manufacturing, Retail, Hospitality, Hospital) |
| city | String | City for geographic mapping. Example: Pune |
| state | String | State for geographic mapping. Example: Maharashtra |
| lead_source | Enum | Origin of the customer record. Example: IndiaMART (Values: Tally_Import, IndiaMART, TradeIndia, Direct) |
| customer_tier | Enum | Business value segmentation (A/B/C). Example: A |
| is_dormant | Boolean | True if no orders within the configured window. Example: False |

## 3. products

Description: The canonical master catalog, tracking costs, selling prices, and live inventory.

| Field | Type | Details |
| --- | --- | --- |
| id | UUID, Primary Key | Internal product ID. |
| tally_item_id | String, Unique | Tally's internal identifier. Example: TALLY-ITM-882 |
| sku_code | String, Unique | Stock Keeping Unit. Example: VALVE-BR-001 |
| product_name | String | Standardized item name. Example: Brass Industrial Valve 50mm |
| category | String | Product grouping. Example: Fittings |
| uom | String | Unit of measure. Example: Box |
| landed_cost | Decimal | Base import or manufacturing cost for margin calculations. Example: 1250.00 |
| selling_price | Decimal | Current catalog price. Example: 1800.00 |
| current_stock | Integer | Live inventory count synced from Tally. Example: 450 |
| seasonality_tag | String, Nullable | High-demand season. Example: Monsoon |
| is_dead_stock | Boolean | Flagged if it's a slow mover. Example: False |

## 4. orders

Description: The header table for all sales transactions, incorporating shipping and priority data.

| Field | Type | Details |
| --- | --- | --- |
| id | UUID, Primary Key | Internal order ID. |
| tally_voucher_id | String, Nullable | Filled when synced back to Tally. Example: SO-2026-089 |
| customer_id | UUID, Foreign Key | Links to customers. |
| order_date | Timestamp | Order placement time. Example: 2026-07-30 14:30:00 |
| ship_date | Timestamp, Nullable | When the order was dispatched. Example: 2026-08-01 10:00:00 |
| order_priority | Enum | Processing priority. Example: High (Values: High, Normal, Low) |
| freight_mode | Enum | Shipping method. Example: Express_Surface |
| freight_cost | Decimal | Shipping expenses applied to the order. Example: 450.00 |
| total_value | Decimal | Gross order amount. Example: 45000.00 |
| handled_by | Enum | Indicates if closed autonomously or by a human. Example: AI_Agent (Values: AI_Agent, Human_Salesperson) |
| status | Enum | Workflow state. Example: Confirmed (Values: Pending, Confirmed, Shipped, Delivered, Synced_To_Tally) |

## 5. order_items

Description: Individual line items within an order, capturing point-in-time costs and discounts for accurate historical profit calculation.

| Field | Type | Details |
| --- | --- | --- |
| id | UUID, Primary Key | Line item ID. |
| order_id | UUID, Foreign Key | Links to orders. |
| product_id | UUID, Foreign Key | Links to products. |
| quantity | Integer | Number of units sold. Example: 25 |
| unit_cost_at_order | Decimal | The landed_cost locked in at the time of sale (vital for historical margin tracking). Example: 1250.00 |
| unit_price_applied | Decimal | The actual selling price charged to the customer. Example: 1750.00 |
| discount_offered | Decimal | Percentage or flat discount applied. Example: 50.00 (representing a 50 INR discount per unit) |

## 6. invoices

Description: Tracks financial receivables, outstanding balances, and aging for the payment nudges.

| Field | Type | Details |
| --- | --- | --- |
| id | UUID, Primary Key | Internal invoice ID. |
| tally_voucher_id | String, Unique | Tally's invoice reference. Example: INV-2526-104 |
| customer_id | UUID, Foreign Key | Links to customers. |
| order_id | UUID, Foreign Key, Nullable | Links to orders (if applicable). |
| invoice_date | Date | Generation date. Example: 2026-07-28 |
| due_date | Date | Payment deadline. Example: 2026-08-28 |
| total_amount | Decimal | Total billable amount. Example: 45450.00 |
| outstanding_amount | Decimal | Remaining unpaid balance. Example: 45450.00 |
| aging_bucket | Enum | Auto-calculated for reporting. Example: 0_30_Days (Values: 0_30_Days, 31_60_Days, 61_90_Days, 90_Plus_Days) |

## 7. interactions

Description: The audit trail of AI conversations, campaigns, and system nudges to prevent overlapping communications.

| Field | Type | Details |
| --- | --- | --- |
| id | UUID, Primary Key | Interaction ID. |
| customer_id | UUID, Foreign Key | Links to customers. |
| channel | Enum | Communication medium. Example: WhatsApp (Values: WhatsApp, Email) |
| interaction_type | Enum | Nature of the log. Example: AI_Chat (Values: AI_Chat, Campaign_Blast, Payment_Reminder, Quote_Sent) |
| content_transcript | Text | The actual message or AI conversation history for human context. Example: "Customer asked for catalog. AI verified stock and sent PDF." |
| timestamp | Timestamp | Exact time of event. Example: 2026-07-30 09:15:00 |

## 8. sync_queues

Description: Manages offline tolerance by queuing records that need to be pushed back to Tally and tracking retries.

| Field | Type | Details |
| --- | --- | --- |
| id | UUID, Primary Key | Queue record ID. |
| entity_type | Enum | Data type being synced. Example: Order (Values: Customer, Order, Invoice) |
| entity_id | UUID | ID of the local CRM record. Example: f47ac10b-58cc-4372-a567-0e02b2c3d479 |
| status | Enum | Sync state. Example: Pending (Values: Pending, Success, Failed) |
| retry_count | Integer | Number of attempts made. Example: 2 |
| last_error | Text, Nullable | Connector error log. Example: "Tally ODBC server unreachable." |

## Database Relationships (ERD Mapping)

### Relationship Summary

- customers ↔ orders: 1-to-Many: One customer can have multiple orders. (orders.customer_id references customers.id)
- customers ↔ invoices: 1-to-Many: One customer can have multiple invoices. (invoices.customer_id references customers.id)
- customers ↔ interactions: 1-to-Many: One customer can have multiple communication logs. (interactions.customer_id references customers.id)
- orders ↔ order_items: 1-to-Many: One order contains multiple line items. (order_items.order_id references orders.id)
- products ↔ order_items: 1-to-Many: One product can appear as a line item in multiple different orders. (order_items.product_id references products.id)
- orders ↔ invoices: 1-to-1 (or 1-to-Many depending on partial billing): An invoice is usually linked to a specific order. (invoices.order_id references orders.id)

### ASCII ER Diagram

```text
customers 1 ───────< * orders
customers 1 ───────< * invoices
customers 1 ───────< * interactions
orders    1 ───────< * order_items
products  1 ───────< * order_items
orders    1 ───────< 0..1 invoices