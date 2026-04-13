# Hoi-Yong Platform — Finalized Architecture

> **Status:** Approved (2026-04-06, revised same day per lead dev input)
> **Scope:** Finance module (first build), then HR & Sales migration
> **Repos:** 3-repo submodule architecture (Documentation + Frontend + Backend)

---

## 1. Architecture Overview

The platform is a **multi-module business dashboard** for Hoi-Yong, a Malaysian fruit & produce distributor. It consolidates Finance, Sales, and HR analytics into a single application.

**Strategy:** Build the Finance module first on the new architecture. HR and Sales migrate onto the same platform afterward.

```
┌──────────────────────────────────────────────────────────────┐
│                         Users                                │
│    (Admin, Director, Finance, HR, Manager, Sale, Operation)  │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Frontend (Next.js 16 + React 19)                │
│                                                              │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │
│   │ Finance │  │  Sales  │  │   HR    │  │  Shared UI   │  │
│   │ Pages   │  │  Pages  │  │  Pages  │  │  Shell/Auth  │  │
│   │ (7+2)   │  │ (future)│  │(future) │  │  Components  │  │
│   └────┬────┘  └────┬────┘  └────┬────┘  └──────┬───────┘  │
│        └─────────────┴───────────┴───────────────┘          │
│                          │                                   │
│                    API Client (HTTP)                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│   Backend (Express)  │  │     Sync Service (Standalone)    │
│                      │  │                                  │
│  /api/v1/finance/*   │  │  Finance: AutoCount Accounting   │
│  /api/v1/hr/*        │  │           (RDS PostgreSQL)       │
│  /api/v1/sales/*     │  │                                  │
│  /api/v1/auth/*      │  │  HR: AutoCount Cloud Payroll     │
│  /api/v1/users/*     │  │      (REST API)                  │
│  /api/v1/roles/*     │  │                                  │
│                      │  │  Sales: (TBD, future)            │
│  CASL RBAC Engine    │  │                                  │
│  Prisma ORM          │  │  Shared: Cron scheduler,         │
│                      │  │  job/log tracking, HTTP API      │
└──────────┬───────────┘  └──────────────┬───────────────────┘
           │                             │
           └──────────┬──────────────────┘
                      ▼
         ┌──────────────────────┐
         │     PostgreSQL 17    │
         │    (Single Database) │
         │                     │
         │  Finance tables:    │
         │   13 lookups        │
         │   17 pc_* tables    │
         │   sync metadata     │
         │   app_settings      │
         │                     │
         │  HR tables:         │
         │   (migrated later)  │
         │                     │
         │  Shared tables:     │
         │   users, roles,     │
         │   permissions,      │
         │   sessions          │
         └──────────────────────┘
```

---

## 2. Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.1.7 | App Router, React Server Components |
| **React** | 19.x | UI framework |
| **TypeScript** | 5.x | Type safety |
| **shadcn/ui** | latest | Component library (replaces MUI) |
| **Tailwind CSS** | 4.x | Styling framework |
| **Recharts** | 3.x | Charts and data visualization |
| **Lucide React** | latest | Icon set |
| **SWR** | 2.x | Client-side data fetching + caching |
| **ExcelJS** | 4.x | Excel export (.xlsx) |
| **NextAuth** | 4.24.13 (pinned) | Authentication (see Section 4) |

### Backend (API Server)

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Express** | 5.x | HTTP API framework |
| **TypeScript** | 5.x | Type safety |
| **Prisma** | 6.x | ORM + database access |
| **CASL** | 6.x | RBAC / permission engine |
| **Zod** | 4.x | Request validation |
| **Pino** | latest | Structured logging |
| **Helmet** | latest | Security headers |
| **@anthropic-ai/claude-agent-sdk** | latest | AI-powered insights (Claude API) |

### AI (Placeholder — Must Revisit)

| Technology | Purpose |
|-----------|---------|
| **@anthropic-ai/claude-agent-sdk** | AI-Driven Financial Planning & Analysis |

Planned AI features (not yet fully scoped):
- AI Insights Analysis — financial decision support
- Budgeting — formulation and tracking
- Forecasting — predictive financial performance
- Variance Analysis — actual vs budget/forecast

### Sync Service (Standalone)

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Express** | 5.x | HTTP API (trigger, status, history, schedule) |
| **TypeScript** | 5.x | Type safety |
| **node-cron** | 3.x | Cron scheduling |
| **pg** | 8.x | Direct PostgreSQL access (source + target) |

### Testing

| Technology | Purpose |
|-----------|---------|
| **Jest** | Unit + integration testing |
| **React Testing Library** | Component testing |
| **Playwright** | End-to-end testing |

### Package Manager

| Technology | Purpose |
|-----------|---------|
| **Bun** | Package manager for all repos (NOT runtime — keep Node.js) |

- Use text lockfile: `bun install --save-text-lockfile` → `bun.lock` (JSONC, git-friendly)
- Add `trustedDependencies` for Prisma: `["prisma", "@prisma/client"]`

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| **PostgreSQL 17** | Primary database (Docker for local dev) |
| **Docker Compose** | Local development orchestration (postgres only) |
| **AWS Amplify** | Frontend deployment |
| **AWS ECS EC2** | Backend API + Sync Service deployment (always-on containers) |
| **AWS Cognito** | OAuth identity provider |
| **AWS Secrets Manager** | Credential management (replaces .env in deployed environments) |
| **node-cron** | Sync scheduling (in-app, not AWS EventBridge) |

---

## 3. Repository & Project Structure

### Three-Repo Submodule Architecture

| Repo | Purpose | URL |
|------|---------|-----|
| **AI-Agent-Documentation** | Docs only (PRDs, architecture, BMAD, shared specs) | `Hoi-Yong-Fruits/AI-Agent-Documentation.git` |
| **AI-Agent-Sales-Ordering-System-AdminDashboard** | Frontend (Next.js) | `Hoi-Yong-Fruits/AI-Agent-Sales-Ordering-System-AdminDashboard.git` |
| **AI-Agent-Sales-Ordering-System-API** | Backend (Express) + Sync Service | `Hoi-Yong-Fruits/AI-Agent-Sales-Ordering-System-API.git` |

### Branch Naming

Format: `feature/v2-finance-{stagename}`

Examples: `feature/v2-finance-planning`, `feature/v2-finance-epic-1`

All three repos use the same branch naming pattern.

### Documentation Repo (Root)

```
AI-Agent-Documentation/                # Root repo — docs only, no code
├── docs/
│   ├── shared/                        # Cross-module documentation
│   │   ├── architecture.md
│   │   ├── rbac-specification.md
│   │   ├── ui-standards.md
│   │   ├── coding-standards.md
│   │   └── deployment-runbook.md
│   ├── finance/
│   │   ├── prd.md                     # Finance PRD (main)
│   │   ├── prd/                       # Epic-level breakdowns
│   │   ├── stories/
│   │   ├── scp/
│   │   ├── qa/
│   │   └── UI/
│   ├── hr/
│   └── sales/
├── reference/
├── code/
│   ├── frontend/                      # Submodule → AdminDashboard repo
│   └── backend/                       # Submodule → API repo
├── .gitmodules
├── .gitignore                         # Excludes /code/* (loose files only)
└── CLAUDE.md
```

### Frontend Repo (Submodule: code/frontend/)

```
AI-Agent-Sales-Ordering-System-AdminDashboard/
├── src/
│   ├── app/
│   │   ├── (auth)/                    # Login, forgot password (blank layout)
│   │   │   └── login/
│   │   ├── (dashboard)/               # Main dashboard (with sidebar layout)
│   │   │   ├── home/
│   │   │   ├── finance/
│   │   │   │   ├── sales/
│   │   │   │   ├── payment/
│   │   │   │   │   └── settings/
│   │   │   │   ├── return/
│   │   │   │   ├── financial/
│   │   │   │   ├── expenses/
│   │   │   │   ├── customer-margin/
│   │   │   │   └── supplier-performance/
│   │   │   ├── hr/                    # (future — HR migration)
│   │   │   ├── sales/                 # (future — Sales migration)
│   │   │   ├── admin/
│   │   │   │   └── sync/
│   │   │   ├── users/
│   │   │   └── settings/
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth]/
│   ├── components/
│   │   ├── layout/                    # Sidebar, header, dashboard shell
│   │   ├── shared/                    # DataTable, KPICard, ChartWrapper, modals, filters
│   │   ├── profiles/                  # Customer/Supplier profile modals
│   │   ├── finance/                   # Finance module components
│   │   │   ├── sales/
│   │   │   ├── payment/
│   │   │   ├── return/
│   │   │   ├── pnl/
│   │   │   ├── expenses/
│   │   │   ├── customer-margin/
│   │   │   └── supplier-margin/
│   │   └── admin/                     # Sync panel UI
│   ├── hooks/
│   ├── lib/                           # Utilities, formatters, date helpers
│   ├── types/
│   ├── styles/
│   └── proxy.ts                       # Next.js 16 route protection (replaces middleware.ts, must be in src/)
├── tailwind.config.ts
├── bun.lock                           # Bun text lockfile
└── package.json
```

### Backend Repo (Submodule: code/backend/)

```
AI-Agent-Sales-Ordering-System-API/
├── endpoint-api/                      # Express API server
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/                  # Login, JWT, Cognito integration
│   │   │   ├── users/                 # User CRUD
│   │   │   ├── roles/                 # Role management
│   │   │   ├── permissions/           # Permission management
│   │   │   ├── finance/               # Finance API endpoints
│   │   │   │   ├── finance.controller.ts
│   │   │   │   ├── finance.service.ts
│   │   │   │   └── finance.routes.ts
│   │   │   ├── hr/                    # (future — HR migration)
│   │   │   └── sales/                 # (future — Sales migration)
│   │   ├── common/
│   │   │   ├── middlewares/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   └── authorization.middleware.ts
│   │   │   ├── services/
│   │   │   │   └── ability.service.ts # CASL definitions
│   │   │   └── routes.index.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── bun.lock
│   └── package.json
│
├── sync-service/                      # Standalone sync service
│   ├── src/
│   │   ├── index.ts                   # Express server + cron scheduler
│   │   ├── sync-engine.ts             # ETL pipeline orchestrator
│   │   ├── http-api.ts                # REST endpoints
│   │   ├── sources/
│   │   │   ├── finance/               # AutoCount Accounting (RDS direct)
│   │   │   │   ├── table-map.ts
│   │   │   │   ├── builders.ts
│   │   │   │   └── transforms.ts
│   │   │   ├── hr/                    # AutoCount Cloud Payroll (REST API)
│   │   │   └── sales/                 # (future)
│   │   ├── table-sync.ts
│   │   └── run-sync.ts
│   ├── bun.lock
│   └── package.json
│
├── docker-compose.yml                 # PostgreSQL for local dev
└── package.json                       # Root workspace config
```

---

## 4. API Proxy Pattern (Security)

The frontend **never exposes the backend URL** to the browser. All API calls go through Next.js API routes, which proxy to the Express backend server-side.

```
Browser ──→ Next.js API Routes (/api/proxy/*) ──→ Express Backend (/api/v1/*)
              (same-origin, server-side)              (internal, never public)
```

**Implementation:** A single catch-all proxy route handles all forwarding:

```
src/app/api/proxy/[...path]/route.ts
```

**Why:**
- Backend URL is server-only (`API_URL`, no `NEXT_PUBLIC_` prefix)
- No CORS issues (browser only talks to same-origin Next.js)
- Auth tokens forwarded server-side
- Single route to maintain (not 1:1 per endpoint)

**Environment variables:**
- `API_URL` — backend address (server-only, never exposed to browser)
- `.env` — local dev only
- **AWS Secrets Manager** — deployed environments

---

## 5. Authentication & Authorization

### NextAuth v4 (Stable)

NextAuth v4.24.13 officially supports React 19 and Next.js 16 (peer dependencies updated October 2025). This is the same library used in the production HR system — proven, stable, and well-understood by the team.

**Why NextAuth v4 over Auth.js v5:** Auth.js v5 has been in beta for 3+ years, the lead maintainer departed January 2025, the project was absorbed by Better Auth (September 2025) and is effectively in sunset mode. The `signIn` server action is broken on Next.js 16 (GitHub #13388, unresolved). NextAuth v4.24.13 is the safe, production-ready choice.

| Setting | Value |
|---------|-------|
| Package | `next-auth@4.24.13` (exact pin, no caret) |
| Strategy | JWT (no database sessions) |
| Session max age | 7 days |
| Config file | `/app/api/auth/[...nextauth]/route.ts` |
| Route protection | `/proxy.ts` (Next.js 16 renamed from middleware.ts) |

**Auth Providers:**

| Provider | Use Case |
|----------|----------|
| Credentials (phone + password) | Primary login — POST to backend `/api/v1/auth/login` |
| Credentials (email + password) | Secondary login — same backend endpoint |
| Cognito (OAuth/OIDC) | Tertiary — SSO via AWS Cognito user pool |

**JWT Token Payload:**
```typescript
{
  id: string           // User UUID
  email: string
  name: string
  phone: string
  role: string         // One of 7 roles
  accessToken: string
  refreshToken: string
  expiresIn: number
  cognitoSub?: string
  employee_code?: string
  department_code?: string
  permissions: string[] // CASL permission array
}
```

**Next.js 16 Migration Notes (Validated in Spike S1):**
- `middleware.ts` is renamed to `proxy.ts` — place in `src/` directory (same level as `app/`)
- The exported function must be named `proxy` (not `middleware`) — either named or default export
- `getToken()` from `next-auth/jwt` works in proxy.ts — must pass `secret` explicitly
- `config.matcher` syntax is unchanged from middleware
- `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize` in next.config.ts
- Proxy runs exclusively in `nodejs` runtime (not Edge) — no Edge runtime restrictions

### RBAC — 7 System Roles

| Role | Module Access | Data Scope | Finance Access |
|------|--------------|------------|----------------|
| `superadmin` | All | All | Full (read + settings + sync) |
| `sale` | Sales | Scoped | None |
| `operation` | Sales | Scoped | None |
| `hr` | HR | All employees | None |
| `finance` | HR (limited) + Finance | Dept (HR) / All (Finance) | Full (read-only) |
| `director` | HR + Finance | All | Read-only |
| `manager` | HR | Department | None |

**Data Scope Rules:**
- **All:** No filter — unrestricted access
- **Department:** `WHERE department_code = user.department_code`
- **Own Records:** `WHERE created_by = user.id`

**CASL Subjects (Finance):**
New subjects for Finance module:
- `FinanceDashboard` — view finance pages
- `FinanceSync` — trigger/manage finance sync
- `FinanceSettings` — modify credit score weights/thresholds

Existing subjects (shared):
- `User`, `Role`, `Permission` — user management
- `System` — system-level operations
- `HRData`, `HRSync`, `HRSettings` — HR module (future)

**Permission Actions:**
`create`, `read`, `update`, `delete`, `manage`, `list`, `export`, `approve`, `cancel`, `validate`

---

## 6. Data Architecture

### Single Database Strategy

All modules share one PostgreSQL 17 database. Finance builds first; HR and Sales tables are added during migration.

### Dual-Pool Access Pattern

| Pool | Purpose | Used By |
|------|---------|---------|
| **Local PostgreSQL** (via Prisma) | Pre-computed aggregates (pc_* tables), lookup tables, user/auth data | Backend API for dashboard views |
| **RDS Direct** (AutoCount Accounting) | Real-time drill-down queries (customer invoices, product breakdowns) | Backend API for detail/modal views |

The backend exposes unified endpoints — the frontend doesn't know which pool serves which query.

### Finance Database Schema

**13 Lookup Tables** (synced from AutoCount):
`customer`, `customer_type`, `supplier`, `supplier_type`, `product`, `product_group`, `sales_agent`, `gl_account`, `account_type`, `fiscal_year`, `project`, `pl_format`, `bs_format`

**17 Pre-Computed Tables** (built by sync service):

| Domain | Tables | Grain |
|--------|--------|-------|
| Sales | `pc_sales_daily`, `pc_sales_by_customer`, `pc_sales_by_outlet`, `pc_sales_by_fruit` | Daily / Monthly |
| Payment/AR | `pc_ar_monthly`, `pc_ar_customer_snapshot`, `pc_ar_aging_history` | Monthly / Snapshot |
| Returns | `pc_return_monthly`, `pc_return_by_customer`, `pc_return_products`, `pc_return_aging` | Monthly / Snapshot |
| Financial | `pc_pnl_monthly`, `pc_bs_snapshot` | Monthly / Snapshot |
| Customer Margin | (built from sales + purchase data) | Monthly |
| Supplier Margin | `pc_supplier_margin_monthly`, `pc_supplier_item_pricing` | Monthly |

**Sync Metadata:**
`sync_job`, `sync_log`, `app_settings`

### Prisma Naming Conventions

- Table names: `snake_case`
- Column names: `snake_case`
- Primary keys: `id` (UUID, auto-generated)
- Foreign keys: `{entity}_id`
- Timestamps: `created_at`, `updated_at`, `deleted_at`, `synced_at`
- Soft deletes: `deleted_at` (nullable DateTime)

---

## 7. Sync Service Architecture

### Overview

The sync service is a **standalone Express application** — separate from the backend API server. It is shared by all modules (Finance, HR, Sales), each with its own data source.

```
┌──────────────────────────────────────────────────┐
│              Sync Service (Express)               │
│                  Port: 4000                       │
│                                                   │
│  ┌─────────────┐  ┌────────────┐  ┌───────────┐ │
│  │   Finance   │  │     HR     │  │   Sales   │ │
│  │   Source    │  │   Source   │  │  Source   │ │
│  │             │  │            │  │  (future) │ │
│  │ AutoCount   │  │ AutoCount  │  │           │ │
│  │ Accounting  │  │ Cloud      │  │           │ │
│  │ (RDS PG)   │  │ Payroll    │  │           │ │
│  │             │  │ (REST API) │  │           │ │
│  └──────┬──────┘  └─────┬──────┘  └─────┬─────┘ │
│         └───────────────┼────────────────┘       │
│                         ▼                         │
│              Shared Sync Engine                   │
│         (ETL pipeline, job tracking,              │
│          savepoint error isolation,               │
│          atomic table swaps)                      │
│                         │                         │
│              Shared HTTP API                      │
│         POST /api/sync/trigger                    │
│         GET  /api/sync/status                     │
│         GET  /api/sync/history                    │
│         GET  /api/sync/logs/:id                   │
│         GET  /api/sync/schedule                   │
│         PUT  /api/sync/schedule                   │
└─────────────────────────┬────────────────────────┘
                          ▼
                   PostgreSQL 17
                 (Target Database)
```

### Sync Process (Finance)

| Phase | Action | Details |
|-------|--------|---------|
| **1: Lookup Sync** | Truncate-reload 13 reference tables | Direct copy from RDS → local |
| **1b: Transform** | Enrich products | Parse `UDF_BoC` → FruitName, FruitCountry, FruitVariant |
| **2: Build** | Aggregate into 17 pc_* staging tables | Complex SQL against RDS, write to `stg_*` tables |
| **2b: Swap** | Atomic swap staging → live | Within transaction, per-table SAVEPOINT isolation |

### Error Handling

- Each builder runs inside a **SAVEPOINT** — individual failure doesn't roll back the entire sync
- Partial success: Sync marked as `partial` (not `error`)
- Job + log records persisted for admin dashboard audit trail
- Data Freshness Indicator reflects sync health globally

### Schedule

- Default: `0 6 * * *` (6 AM MYT daily)
- Configurable via admin UI or `app_settings` table
- Manual trigger available via HTTP API
- Full rebuild: ~30 seconds for ~128K aggregated rows

---

## 8. Navigation Structure

### Sidebar

The sidebar is a **collapsible navigation panel** shared across all modules.

```
┌─────────────────────────┐
│  [Logo]  Hoi-Yong       │
├─────────────────────────┤
│  🏠 Home                │
├─────────────────────────┤
│  📊 Finance  ▾          │
│    ├─ Sales Report      │
│    ├─ Payment           │
│    ├─ Returns           │
│    ├─ Financials        │
│    ├─ Expenses          │
│    ├─ Customer Margin   │
│    └─ Supplier Perf.    │
├─────────────────────────┤
│  👥 HR  ▸  (future)     │
├─────────────────────────┤
│  🛒 Sales  ▸  (future)  │
├─────────────────────────┤
│  ⚙️ Admin               │
│    ├─ Data Sync         │
│    ├─ Users             │
│    └─ Settings          │
└─────────────────────────┘
```

**Behavior:**
- Expanded: 224px width, icon + label
- Collapsed: 64px width, icon only with hover tooltips
- Active page highlighted; sub-pages highlight parent
- Module groups collapsed by default
- Role-based visibility: Users only see modules they have access to

---

## 9. Design System

The comprehensive design standards from the Finance demo (`docs/prd/09-design-standards.md`) become the **single source of truth** for all modules. Key highlights:

### Readability (Non-Negotiable)

- **Target users:** Older executives (50+)
- **Minimum font size:** 14px for all data-bearing text
- **Banned sizes:** 10px, 11px absolutely forbidden
- **Text contrast:** Full-contrast near-black (#1A1A1A) for data labels — **never gray/muted for important data**
- **WCAG AA minimum:** 4.5:1 for normal text, 3:1 for large text

### Colour System

| Purpose | Colour |
|---------|--------|
| Primary | Dark navy (#1F4E79) |
| Positive/Profit | Emerald green (#10B981) |
| Negative/Loss | Red (#EF4444) |
| Warning | Amber (#F59E0B) |
| Invoice | Dark blue |
| Cash Sale | Green |
| Credit Note | Red |
| OPEX | Orange |

### Component Patterns

| Component | Standard |
|-----------|----------|
| **KPI Cards** | Label (uppercase), Value (24-36px bold), Subtitle (formula), conditional colouring |
| **Charts** | Recharts, 360px full-width / 320px compact, legends below, no click toggles |
| **Data Tables** | Text left / numeric right + monospace, 25 rows default, all columns sortable |
| **Modals** | 90% viewport, multi-view architecture, section-level loading |
| **Filters** | Date range (2 month pickers + presets), segmented button groups for toggles |
| **Loading** | Skeleton placeholders matching final layout |
| **Empty** | Centred text "No [entity] data for selected period" |
| **Errors** | Per-section error + "Try again" button, non-blocking |

### Data Formatting

| Type | Format |
|------|--------|
| Currency | "RM X,XXX" (no decimals), "RM X.XX" (unit prices), "RM X.XM" (tooltips) |
| Percentages | Signed (+12.3%, −4.1%) for growth; unsigned (18.5%) for margins |
| Dates | "DD MMM YYYY" in tables, "MMM YY" on chart axes |
| Null/missing | "—" (em-dash), never "0" |
| Estimated | "Est." prefix with info-icon tooltip |

---

## 10. Epic Structure (Finance PRD)

| # | Epic | Scope Summary |
|---|------|---------------|
| **1a** | Platform Foundation | Project scaffold, Next.js 16, shadcn/ui, Tailwind 4, Express backend, Prisma, Docker, monorepo |
| **1b** | Auth & RBAC | Auth.js v5, Cognito, JWT, CASL, 7 roles, login page, route protection, proxy.ts |
| **1c** | Shared UI Shell | Dashboard layout, sidebar navigation, DataFreshnessIndicator, responsive grid, shared components |
| **1d** | Sync Service Foundation | Standalone service, multi-source architecture, HTTP API, sync panel UI, scheduler, job tracking |
| **1e** | Finance Database | Prisma schema (30+ tables), migrations, seed data |
| **2** | Sales Page | Net sales tracking (daily/weekly/monthly), KPIs, charts, table, breakdown dimensions |
| **3** | Payment + Score & Risk Setting | AR management, aging analysis, credit health scoring, configurable weights/thresholds |
| **4** | Return | Credit note tracking, reconciliation, product return analysis |
| **5** | Financial Statements | P&L + Balance Sheet, hierarchical tables, multi-year comparison, financial year selector |
| **6** | Expenses | COGS + OPEX breakdown, trend analysis, top expenses, cost composition |
| **7** | Customer Margin | Profit by customer, margin distribution, trend sparklines, credit note impact |
| **8** | Supplier Performance | Profit by supplier, price comparison, scatter chart, item pricing panel |
| **9** | Customer Profile | Multi-view modal (profile, outstanding invoices, returns, sales transactions) |
| **10** | Supplier Profile | Multi-view modal (profile, items supplied, margin performance) |

---

## 11. Migration Path (HR & Sales)

After Finance is stable on the new platform:

1. **HR Migration:** Port from `Hoi-Yong_HR/code/` to `Hoi-Yong_Platform/apps/`
   - Rebuild all MUI components in shadcn/ui
   - Move Express modules to new backend structure
   - Integrate HR sync source into shared sync service
   - Port Prisma schema (HR tables already defined)

2. **Sales Migration:** Port from `Hoi-Yong_HR/code/` (legacy modules)
   - Rebuild product, purchase order, inventory pages in shadcn/ui
   - Add Sales sync source to shared sync service

3. **Shared Infrastructure:** Already built by Finance (auth, RBAC, navigation, layout, sync panel, design system) — HR/Sales modules plug in.

---

## 12. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI framework | shadcn/ui + Tailwind 4 | More UI freedom than MUI (tech lead recommendation) |
| Auth library | NextAuth v4 (pinned `4.24.13`) | Stable, production-proven (HR system); v4.24.12+ patched React 19 + Next.js 16 support. Auth.js v5 rejected — 3yr beta, maintainer departed, sunset by Better Auth |
| Sync service | Standalone Express (inside backend repo) | Separation of concerns; best practice (tech lead) |
| Database | Single PostgreSQL 17 | Simpler ops; can rebuild from scratch since Finance builds first |
| ORM | Prisma 6.x | Consistent with production patterns; type-safe |
| Backend | Split into `endpoint-api/` + `sync-service/` | Clear separation within same repo |
| Pre-computed tables | 17 pc_* tables | Dashboard reads are simple SELECTs; ~24hr data lag acceptable |
| Dual-pool | Local (Prisma) + RDS direct | Aggregates from local; drill-down from source |
| API proxy | Catch-all Next.js proxy (`/api/proxy/[...path]`) | Security — backend URL never exposed to browser |
| Credentials | AWS Secrets Manager (deployed); `.env` (local only) | No hardcoded secrets in deployed environments |
| Design system | Finance standards → shared | Comprehensive readability rules for older executive users |
| Repo strategy | Existing 3-repo submodule architecture | Follow production patterns per lead dev |
| Package manager | Bun (package manager only, Node runtime) | Speed; per team lead instruction |
| Deployment | AWS Amplify (frontend) + AWS ECS EC2 (backend + sync) | Always-on containers for API and sync service |
| Sync scheduling | node-cron (in-app) | Service is always running; admin UI controls schedule; self-contained |
| AI | Claude SDK (`@anthropic-ai/claude-agent-sdk`) | FP&A features (placeholder, must revisit) |
| Branch strategy | `feature/v2-finance-{stagename}` | Clear pivot identification across all repos |

---

## 13. Source Reference Documents

The Finance module specification is based on 10 PRD source documents in the demo repo (`Hoi-Yong_Finance/docs/prd/`):

| Document | Content |
|----------|---------|
| `00-business-domain.md` | Company profile, data model, business rules, formulas |
| `01-sales.md` | Sales Report page specification |
| `02-payment.md` | Payment Collection page specification |
| `03-return.md` | Returns page specification |
| `04-financial-statements.md` | P&L + Balance Sheet specification |
| `05-expenses.md` | Expenses page specification |
| `06-customer-margin.md` | Customer Margin page specification |
| `07-supplier-margin.md` | Supplier Performance page specification |
| `08-settings-and-profiles.md` | Settings + Profile modal specifications |
| `09-design-standards.md` | Comprehensive UI/UX design system |
| `ref-data-dictionary.md` | Complete data dictionary for all tables |
| `ref-fruit-taxonomy.md` | Product classification rules |

These documents are **tech-stack agnostic** and serve as the authoritative feature specification for PRD creation.
