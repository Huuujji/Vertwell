<p align="center">
  <img src="Frontend/public/assets/be809.png" alt="Happy Hentie Hobbies logo" width="150">
</p>

<h1 align="center">Vertwell</h1>

<p align="center">
  <strong>DualCounter: Inventory &amp; Sales Management System</strong><br>
  Two shops, one system.
</p>

<p align="center">System Fundamentals Project · BSCS 3A</p>

---

## About the Project

DualCounter is a web application developed by the Vertwell team for **Happy Hentie Café & Hobby Shop**. It brings café operations and hobby retail into one workspace, connecting product inventory, point of sale, daily sales review, and business reports.

The system supports Food, Beverage, and Hobby products, with separate tools for Owners, Admins, and Staff. From preparing a drink with ingredient-based recipes to selling retail items and bundles, each sale stays connected to the stock it uses.

## Features

| Workspace | What it offers |
| :--- | :--- |
| **Dashboard** | Sales overview, stock attention, Daily Sales Review, and saved in-app alerts for pending void requests and potentially repeated sales. |
| **Inventory** | Products, ingredients, receipt batches, expiry tracking, stock receiving, and stock adjustments. Supports recipes, stocked products, variants, bundles, and reusable modifier groups. |
| **Point of Sale** | Product customization, discounts, stock availability checks, Cash and manual GCash payment recording, and itemized receipts. |
| **Audit Trail** | Recorded sales, review history, void requests and decisions, and actor attribution. |
| **Reports** | Sales and inventory usage reports, stock balances, date filters, CSV/PDF downloads, and printing from the same PDF layout. |
| **Users** | Managed accounts with Owner, Admin, and Staff access, account activation controls, and password recovery. |

The interface adapts to desktop, tablet, and phone screens. Saved workspaces receive private automatic updates while retaining active drafts, cart contents, and filters.

### Roles and Access

| Role | Main responsibilities |
| :--- | :--- |
| **Owner** | Manage the business workspace and all account roles, confirm Daily Sales Reviews, and configure alert settings. |
| **Admin** | Manage inventory, checkout, reports, void requests and decisions, and Staff accounts. Daily Sales Review confirmation remains Owner-only. |
| **Staff** | Process checkout, view their own current-day sales, and submit eligible void requests. |

### Payments and Stock

Checkout records purchased items and deducts usable stock together. Recipes use ingredients, stocked products and variants use their linked SKU, and bundles use their component stock. Expired or unsellable stock is excluded from checkout availability.

GCash uses a **manual QR and reference-number workflow**: the cashier checks the payment and records its reference. The included QR is a sample to be replaced with the shop’s actual QR before use. Payment-provider integration is not part of this workflow.

## Team Members

| Name | Role / Focus Area |
| :--- | :--- |
| **Aquino** | Project Manager / Research Developer / Quality Assurance |
| **Alba** | Lead Backend Developer / Frontend Developer |
| **Santiago** | Lead Frontend Developer / UI/UX Designer |
| **Mejia** | Backend Developer / Research Developer / Database Manager |
| **Yoingco** | Frontend Developer / UI/UX Designer |

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React, Vite, TypeScript, CSS |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL through Supabase |
| **Authentication & Storage** | Supabase Auth and private Supabase Storage |
| **Automatic Updates** | Supabase Realtime private WebSocket channels |
| **PDF Reports** | jsPDF |
| **Testing** | Playwright, Node.js test runner, PGlite |
| **Deployment Configuration** | Vercel, with separate frontend and backend projects |

## Getting Started

### Requirements

- Node.js **24.x** and npm.
- A configured Supabase project for saved accounts and business data. The sample preview can run without Supabase credentials.

### Run Locally

From the repository root, install the dependencies:

```powershell
npm install
```

For a new checkout, create the local environment files from the provided examples. Keep existing environment files if you already configured the project.

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item Frontend/.env.example Frontend/.env
```

To use real accounts and saved data, configure the environment values and follow the [database setup guide](backend/supabase/README.md) and [authentication guide](backend/supabase/AUTHENTICATION.md). Keep secret keys on the backend; only publishable keys belong in frontend variables.

Start both applications:

```powershell
npm run dev
```

| Application | Local address |
| :--- | :--- |
| Frontend | [localhost:5173](http://localhost:5173) |
| Backend | [localhost:3001](http://localhost:3001) |

For a frontend-only demonstration, run `npm run dev:frontend`, select a **Preview role** and **Preview person** on the login screen, then choose **Open preview**. No password is needed. Preview data is separate from saved business records and resets when the page is refreshed.

### Development Commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Run the frontend and backend together. |
| `npm run dev:frontend` | Run the frontend only. |
| `npm run dev:backend` | Run the backend only. |
| `npm run typecheck` | Check frontend and backend TypeScript. |
| `npm test` | Run backend, database, and frontend unit tests. |
| `npm run build` | Build both applications. |
| `npm run test:e2e --workspace Frontend` | Run frontend browser tests. |

## Repository Structure

```text
Vertwell/
├── Frontend/              # React application
│   ├── src/               # Pages, shared components, data access, and styles
│   ├── public/assets/     # App artwork, fonts, and license notices
│   ├── tests/             # Browser and unit tests
│   └── design-reference/  # Preserved design assets and relocation manifest
├── backend/               # Express API
│   ├── src/               # Routes, authentication, and service helpers
│   ├── supabase/          # Database migrations and technical guides
│   ├── scripts/           # Database and integration tooling
│   └── tests/             # API and database tests
├── package.json           # Shared npm workspace commands
├── README.md              # Project introduction
└── HandsOff.md            # Development context and task history
```

Use the exact `Frontend` capitalization when working on Linux or configuring hosting.

## Technical Documentation

| Guide | Contents |
| :--- | :--- |
| [Database Setup](backend/supabase/README.md) | Database workspace and setup commands. |
| [Database Design](backend/supabase/DESIGN.md) | Schema, stock models, and data relationships. |
| [Authentication](backend/supabase/AUTHENTICATION.md) · [Authorization](backend/supabase/AUTHORIZATION.md) | Account access, recovery, and role permissions. |
| [Inventory & Accounts](backend/supabase/CRUD.md) · [Checkout](backend/supabase/CHECKOUT.md) | Saved management operations and stock-aware checkout. |
| [Sales Workflows](backend/supabase/SALES_WORKFLOWS.md) · [Reports](backend/supabase/REPORTS.md) | Daily review, void handling, reporting, and reconciliation. |
| [Live Updates](backend/supabase/LIVE_UPDATES.md) · [Notifications](backend/supabase/NOTIFICATIONS.md) | Private updates and saved in-app alerts. |
| [Development Handoff](HandsOff.md) | Original requirements, task progress, verification evidence, and continuation notes. |
