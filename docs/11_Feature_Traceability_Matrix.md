# SalesOS - Feature Traceability Matrix (FTM)

Version: 1.0

Status: Draft

Document Owner: Kaushal Joshi

Last Updated: ______________

---

# Purpose

This document maps every client requirement to the software modules,
backend APIs, frontend screens, database entities, implementation phase,
priority, dependencies, and testing status.

This document acts as the single source of truth during development.

---

# Status Legend

| Status | Meaning |
|---------|---------|
| NS | Not Started |
| IP | In Progress |
| DEV | Development Complete |
| TEST | Tested |
| DONE | Completed |

---

# Priority Legend

P0 = Critical

P1 = High

P2 = Medium

P3 = Low

---

# Phase 1

| Req ID | Requirement | Module | Backend Service | Screen | Database | API | Priority | Depends On | Status | Remarks |
|--------|-------------|---------|-----------------|---------|-----------|-----|----------|------------|--------|---------|
| R1.1 | Historical data import | Data Foundation | Import Service | Import Wizard | Customer, Product, Invoice, Orders | POST /import | P0 | None | NS | Initial migration |
| R1.2 | Customer Deduplication | Data Foundation | Deduplication Service | Import Wizard | Customer | POST /deduplicate | P0 | R1.1 | NS | Fuzzy matching |
| R1.3 | Product Standardization | Data Foundation | Product Normalizer | Import Wizard | Product | POST /normalize-products | P1 | R1.1 | NS | Canonical catalogue |
| R1.4 | Migration Report | Reporting | Migration Service | Import Summary | MigrationReport | GET /migration-report | P1 | R1.1-R1.3 | NS | Import statistics |
| R1.5 | Live Tally Sync | Integration | Tally Connector | Settings | All Business Tables | /sync | P0 | Tally Connector | NS | Two-way sync |
| R1.6 | Queue & Retry | Integration | Sync Engine | Dashboard | SyncLog | /sync/status | P0 | R1.5 | NS | Offline handling |
| R1.7 | Customer 360 | CRM | Customer Service | Customer Details | Customer, Orders, Payments | GET /customers/{id} | P0 | CRM | NS | Core feature |
| R1.8 | Customer Search | CRM | Search Service | Customer List | Customer | GET /customers | P1 | CRM | NS | Filters |

---

## Customer Intelligence

| Req ID | Requirement | Module | Backend Service | Screen | Database | API | Priority | Depends On | Status |
|--------|-------------|---------|-----------------|---------|-----------|-----|----------|------------|--------|
| R1.9 | Customer Tiering | Analytics | Tier Engine | Customer Profile | CustomerTier | POST /tier | P1 | CRM | NS |
| R1.10 | Product Affinity | Analytics | Affinity Engine | Analytics | Orders | GET /affinity | P2 | Orders | NS |
| R1.11 | Dormancy Detection | Analytics | Dormancy Engine | Dashboard | Customer | GET /dormant | P1 | Orders | NS |

---

## Dashboard

| Req ID | Requirement | Module | Screen | API | Status |
|--------|-------------|---------|--------|-----|--------|
| R1.12 | Today's Enquiries | Dashboard | Home | GET /dashboard | NS |
| R1.13 | Revenue MTD | Dashboard | Home | GET /dashboard | NS |
| R1.14 | Receivable Aging | Dashboard | Finance | GET /receivables | NS |
| R1.15 | Top Products | Dashboard | Home | GET /analytics/products | NS |
| R1.16 | Dormant Customers | Dashboard | Home | GET /analytics/dormant | NS |
| R1.17 | Margin Snapshot | Dashboard | Margin | GET /analytics/margin | NS |

---

## Analytics

| Req ID | Requirement | Module | Screen | API | Status |
|--------|-------------|---------|--------|-----|--------|
| R1.18 | Geographic Map | Analytics | Geography | GET /analytics/geo | NS |
| R1.19 | Seasonal Demand | Analytics | Seasonality | GET /analytics/seasonality | NS |
| R1.20 | Pareto Analysis | Analytics | Customer Analysis | GET /analytics/pareto | NS |
| R1.21 | Landed Cost Trend | Analytics | Margin | GET /analytics/cost | NS |
| R1.22 | Dead Stock | Analytics | Inventory | GET /analytics/dead-stock | NS |
| R1.23 | Churn Risk | Analytics | Customer Analysis | GET /analytics/churn | NS |
| R1.24 | YoY Comparison | Analytics | Dashboard | GET /analytics/yoy | NS |
| R1.25 | Excel Export | Reporting | Every Screen | GET /export | NS |

---

## Reporting

| Req ID | Requirement | Module | Status |
|--------|-------------|--------|--------|
| R1.26 | Daily Reports | Reporting | NS |
| R1.27 | Weekly Reports | Reporting | NS |
| R1.28 | Monthly Reports | Reporting | NS |

---

# Phase 2

## Lead Capture

| Req ID | Requirement | Module | API | Status |
|--------|-------------|---------|-----|--------|
| R2.1 | IndiaMART Integration | Lead Management | /integrations/indiamart | NS |
| R2.2 | TradeIndia Integration | Lead Management | /integrations/tradeindia | NS |
| R2.3 | State Portal Integration | Lead Management | /integrations/state | NS |
| R2.4 | Lead Deduplication | Lead Management | /leads/deduplicate | NS |

---

## AI Sales Agent

| Req ID | Requirement | Module | Status |
|--------|-------------|--------|--------|
| R2.5 | Instant Response | AI Agent | NS |
| R2.6 | Response Monitoring | Monitoring | NS |
| R2.7 | Product Q&A | AI Agent | NS |
| R2.8 | Inventory Check | AI Agent | NS |
| R2.9 | Quote Generation | AI Agent | NS |
| R2.10 | Guardrails | AI Agent | NS |
| R2.11 | Multi-language | AI Agent | NS |

---

## Order Processing

| Req ID | Requirement | Module | Status |
|--------|-------------|--------|--------|
| R2.12 | Payment Threshold | Order Engine | NS |
| R2.13 | Stock Validation | Inventory | NS |
| R2.14 | Notifications | Notification Engine | NS |
| R2.15 | Order Sync to Tally | Integration | NS |

---

# Non Functional Requirements

| Req ID | Requirement | Module | Status |
|--------|-------------|--------|--------|
| NFR1 | Response under 10 min | Monitoring | NS |
| NFR2 | Dashboard Freshness | Sync Engine | NS |
| NFR3 | Client Infrastructure | DevOps | NS |
| NFR4 | WhatsApp Compliance | Notification Engine | NS |
| NFR5 | RBAC | Authentication | NS |
| NFR6 | Excel Export Everywhere | Reporting | NS |
| NFR7 | Audit Logging | Audit Service | NS |
| NFR8 | Daily Backup | Infrastructure | NS |

---

# Open Questions

| ID | Question | Impact | Status |
|----|----------|--------|--------|
| TBD-01 | Tally Version | High | Open |
| TBD-02 | Sync Method | High | Open |
| TBD-03 | Tier Rules | Medium | Open |
| TBD-04 | Dormancy Window | Medium | Open |
| TBD-05 | Payment Threshold | Critical | Open |
| TBD-06 | Payment Gateway | Critical | Open |
| TBD-07 | Supported Languages | Medium | Open |
| TBD-08 | Quote Format | Medium | Open |