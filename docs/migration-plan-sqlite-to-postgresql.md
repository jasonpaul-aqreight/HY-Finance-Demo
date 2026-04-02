# Migration Plan: SQLite to PostgreSQL with Sync Service

**Date:** 2026-03-31
**Status:** Complete — All 5 phases done

## Context

The Hoi-Yong Finance dashboard currently runs on 7 separate SQLite databases (one per page, built incrementally). The same source data is duplicated across databases (e.g., `debtor` in 4 DBs, `iv` in 3 DBs). All databases are read-only, loaded from CSV exports of AutoCount Accounting (PostgreSQL on AWS RDS).

**Goal:** Consolidate into a single PostgreSQL database (Docker), with a sync service that pulls data directly from the AutoCount PostgreSQL source, and materialized views for fast dashboard reads. The dashboard must show identical numbers after migration.

**Source:** AutoCount PostgreSQL on AWS RDS (credentials in `/.env`)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                AutoCount PostgreSQL (AWS RDS)             │
│                   (source, read-only)                    │
└──────────────────────┬──────────────────────────────────┘
                       │  (sync service reads via pg)
                       ▼
┌─── Docker Compose ─────────────────────────────────────┐
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  next-app   │  │ sync-service │  │   postgres    │ │
│  │  port 3000  │  │ port 4000    │  │  port 5433    │ │
│  │  (public)   │  │ (internal)   │  │  DB: hoiyong  │ │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘ │
│         │                │                   │         │
│         └────────────────┴─── reads ──┘         │
│                                                         │
└─────────────────────────────────────────────────────────┘

PostgreSQL contains:
  Layer 1: 38 normalized base tables (single source of truth)
  Layer 2: ~20 materialized views (pre-computed per dashboard)
  Layer 3: 4 sync metadata tables + 1 app_settings table
```

---

## Database Design

### Indexes vs Materialized Views (Both Are Used)

- **Indexes** speed up finding specific rows in large tables. Applied to all key columns (dates, customer codes, item codes). Makes individual queries fast.
- **Materialized views** pre-compute expensive JOINs and aggregations. Dashboard reads from these small pre-computed tables instead of running complex queries. Makes page loads near-instant.

### Base Tables (38 total)

**Lookup (17):** `customer`, `customer_type`, `supplier`, `supplier_type`, `product`, `product_group`, `sales_agent`, `payment_term`, `gl_account`, `account_type`, `fiscal_year`, `project`, `fruit`, `country`, `fruit_alias`, `pl_format`, `bs_format`

**Sales headers (4):** `invoice`, `cash_sale`, `credit_note`, `debit_note` — each with `doc_date_myt DATE` and `month_myt TEXT` columns populated by sync

**Sales details (4):** `invoice_line`, `cash_sale_line`, `credit_note_line`, `debit_note_line`

**Sales derived (3):** `sales_detail_invoice`, `sales_detail_cash`, `sales_detail_credit_note` (pre-joined with fruit data)

**Purchase (4):** `goods_receipt`, `goods_receipt_line`, `purchase_invoice`, `purchase_invoice_line`

**AR (7):** `ar_invoice`, `ar_payment`, `ar_payment_knock_off`, `ar_credit_note`, `ar_refund`, `ar_refund_line`, `ar_refund_knock_off`

**GL (3):** `gl_transaction`, `period_balance`, `opening_balance`

### Materialized Views (~20)

| View | Dashboard Page | Purpose |
|------|---------------|---------|
| `mv_sales_monthly` | Sales | Trend chart |
| `mv_sales_by_customer` | Sales | Customer breakdown |
| `mv_sales_by_type` | Sales | Customer type breakdown |
| `mv_sales_by_agent` | Sales | Agent breakdown |
| `mv_sales_by_location` | Sales | Location breakdown |
| `mv_sales_by_fruit` | Sales | Fruit breakdown |
| `mv_payment_aging` | Payment | Aging buckets |
| `mv_payment_dso_monthly` | Payment | DSO trend |
| `mv_payment_collection` | Payment | Collection trend |
| `mv_return_overview` | Return | KPIs + trend |
| `mv_return_trend` | Return | Monthly trend |
| `mv_return_by_customer` | Return | Top debtors |
| `mv_return_products` | Return | Product analysis |
| `mv_customer_margin` | Customer Margin | Customer margin table |
| `mv_customer_margin_trend` | Customer Margin | Margin trend |
| `mv_supplier_summary` | Supplier | Supplier table |
| `mv_supplier_items` | Supplier | Item-level analysis |
| `mv_expense_monthly` | Expenses | Cost trends |
| `mv_pnl_period` | Finance | P&L statement |

### Sync Metadata Tables (4)

- `sync_schedule` — Cron configuration (editable from admin panel)
- `sync_job` — History of every sync run (status, duration, rows)
- `sync_log` — Per-table detailed log entries
- `sync_table_stat` — Row counts and last-sync timestamps per table

### App Settings Table (1)

- `app_settings` — Key-value store (JSONB) replacing `data/settings.json`

---

## Phase 1: Foundation

### 1.1 Baseline Screenshots
- Capture all 7 dashboard pages + payment settings using Playwright
- Pages: `/sales`, `/payment`, `/payment/settings`, `/return`, `/financial`, `/expenses`, `/customer-margin`, `/supplier-performance`
- Default date range: Nov 2024 - Oct 2025
- Save to `docs/screenshots/baseline-pre-migration/`

### 1.2 Docker Compose
- **Create:** `/docker-compose.yml`
- Services: `postgres` (port 5433), `sync` (port 4000), `app` (port 3000)
- PostgreSQL 16 Alpine with health checks

### 1.3 PostgreSQL Schema
- `migrations/001_base_tables.sql` — 38 tables
- `migrations/002_indexes.sql` — All indexes
- `migrations/003_materialized_views.sql` — ~20 materialized views
- `migrations/004_sync_metadata.sql` — 4 sync tables
- `migrations/005_app_settings.sql` — Settings table with seed data

### 1.4 Add PostgreSQL Client
- Add `pg` + `@types/pg` to `finalize/package.json`
- Create `finalize/src/lib/postgres.ts`

### 1.5 Update Environment
- Create `/.env.example`
- Update `/.env` with new vars

---

## Phase 2: Sync Service

### 2.1 Scaffold `sync-service/` Directory
- Node.js + TypeScript + Express + node-cron + pg

### 2.2 Core Modules
- `src/index.ts` — HTTP server + cron scheduler
- `src/sync-engine.ts` — Core ETL logic
- `src/table-sync.ts` — Per-table sync with column mapping
- `src/transforms.ts` — Compute derived columns and tables
- `src/views.ts` — Materialized view refresh
- `src/http-api.ts` — REST API for manual trigger, status, schedule

### 2.3 Strategy
- Full truncate-and-reload (~2M rows, <60s)
- Dependency-ordered: lookups → headers → details → derived → GL → refresh views
- Progress tracking via `sync_job` and `sync_log` tables

### 2.4 Table Mapping (AutoCount → Local)
- `Debtor` → `customer`, `Item` → `product`, `GLMast` → `gl_account`, etc.
- Column names within tables: keep PascalCase to minimize query changes

---

## Phase 3: Migrate Dashboard Queries

### 3.1 Replace DB Connection Layer
- Rewrite `src/lib/db.ts` and all 7 domain `db.ts` wrappers
- Remove `ATTACH DATABASE` pattern from return module

### 3.2 Migrate Query Files (one domain at a time)

**Key SQL changes:**
- `db.prepare(sql).all()` → `await pool.query(sql, [])`
- `?` → `$1, $2, ...` positional params
- `DATE(col, '+8 hours')` → `doc_date_myt` column
- `strftime('%Y-%m', col, '+8 hours')` → `month_myt` column
- `GROUP_CONCAT` → `STRING_AGG`
- All functions become `async`

**Order:** Sales → Expenses → Return → Payment → Customer Margin → Supplier Margin → P&L

### 3.3 Update API Routes
- 85 routes: add `await` before query calls
- Convert routes with inline SQL
- Migrate settings from file I/O to PostgreSQL

---

## Phase 4: Sync Admin Panel

### 4.1 API Routes
- `GET/POST /api/admin/sync/trigger`
- `GET /api/admin/sync/status`
- `GET/PUT /api/admin/sync/schedule`
- `GET /api/admin/sync/history`
- `GET /api/admin/sync/logs/[jobId]`

### 4.2 UI Components
- `SyncStatusCard` — Idle/running status, last/next sync time
- `SyncProgressBar` — Live progress during sync
- `SyncHistoryTable` — Recent sync jobs
- `SyncScheduleForm` — Cron editor
- `SyncTriggerButton` — Manual sync trigger

### 4.3 Admin Page
- Route: `/admin/sync`
- Added to sidebar navigation

---

## Phase 5: Cleanup

- Remove `better-sqlite3` dependency
- Delete `data/*.db` files and `data/settings.json`
- Update Dockerfile (remove native module build, SQLite copy)
- Final regression: compare all pages against baseline screenshots

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Forgotten `await` → undefined data | TypeScript strict + `@typescript-eslint/no-floating-promises` |
| Date conversion errors | Pre-computed `doc_date_myt` column eliminates timezone logic |
| `ref_` tables not in AutoCount | Seed data in migration SQL (static reference tables) |
| `sales_detail_*` tables are derived | Sync service builds them from joins |
| Materialized view staleness | Refresh only after successful full sync |

---

## Files Summary

**Rewrite:** `src/lib/db.ts`, 7 domain `db.ts`, 11 query files (~87 functions), `settings.ts`, ~5 routes with inline SQL
**No change:** `credit-score-v2.ts`, all frontend components, all hooks
**New:** `docker-compose.yml`, `migrations/*.sql`, `sync-service/*`, `postgres.ts`, admin panel components
**Delete (Phase 5):** `data/*.db`, `data/settings.json`, `better-sqlite3` dependency
