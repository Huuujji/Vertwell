# DualCounter: Inventory & Sales Management System

DualCounter is a web application developed by **Vertwell** for **Happy Hentie Café & Hobby Shop**. The platform brings café operations and hobby retail into one workspace, connecting inventory, point of sale, daily sales review, and business reporting.

**System Fundamentals Project · BSCS 3A**

## Tech Stack

### Core
![TypeScript](https://img.shields.io/badge/TYPESCRIPT-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/NODE.JS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

### Web App
![React](https://img.shields.io/badge/REACT-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/VITE-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-663399?style=for-the-badge&logo=css&logoColor=white)

### Backend & Real-Time
![Express.js](https://img.shields.io/badge/EXPRESS.JS-000000?style=for-the-badge&logo=express&logoColor=white)
![Supabase Realtime](https://img.shields.io/badge/SUPABASE_REALTIME-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)

### Database, Authentication & Storage
![PostgreSQL](https://img.shields.io/badge/POSTGRESQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Supabase Auth](https://img.shields.io/badge/SUPABASE_AUTH-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Supabase Storage](https://img.shields.io/badge/SUPABASE_STORAGE-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)

### Reporting & Testing
![jsPDF](https://img.shields.io/badge/JSPDF-EF4444?style=for-the-badge)
![Playwright](https://img.shields.io/badge/PLAYWRIGHT-2EAD33?style=for-the-badge)
![PGlite](https://img.shields.io/badge/PGLITE-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

### Tooling
![Git](https://img.shields.io/badge/GIT-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GITHUB-181717?style=for-the-badge&logo=github&logoColor=white)
![Figma](https://img.shields.io/badge/FIGMA-F24E1E?style=for-the-badge&logo=figma&logoColor=white)
![npm Workspaces](https://img.shields.io/badge/NPM_WORKSPACES-CB3837?style=for-the-badge&logo=npm&logoColor=white)

### Hosting Target
![Vercel](https://img.shields.io/badge/VERCEL-000000?style=for-the-badge&logo=vercel&logoColor=white)

The repository includes a single-project Vercel configuration for the frontend and API under one origin.

## System Features

- **Unified Dashboard:** Sales overview, stock attention, Daily Sales Review, and actionable alerts for Owners and Admins.
- **Inventory Management:** Product and ingredient records, stock receiving, receipt batches, expiry tracking, stock adjustments, and archival.
- **Flexible Stock Models:** Ingredient-based recipes, stocked products, SKU variants, bundles, and reusable modifier groups for Food, Beverage, and Hobby products.
- **Stock-Aware Point of Sale:** Product customization, discounts, usable-stock checks, atomic checkout, and recorded stock consumption linked to each sale.
- **Manual GCash & Cash Payments:** Cashier-verified payment recording, GCash QR/reference entry, and itemized receipts. The bundled GCash QR is a sample to be replaced with the shop-approved QR before use.
- **Sales Review & Audit Trail:** Owner confirmation of Daily Sales Reviews, void requests and decisions, recorded actor attribution, and preserved transaction history.
- **Reports & Exports:** Date-filtered sales and inventory usage reports, stock balances, CSV downloads, and matching PDF download/print layouts.
- **Role-Based Access Control:** Owner, Admin, and Staff permissions with protected account management and password recovery. Staff access is limited to checkout and their own current-day sales workflows.
- **Saved In-App Notifications:** Persistent alerts and per-account read status for Owners and Admins, delivered through private automatic updates.
- **Responsive Interface:** Desktop, tablet, and phone layouts with shared navigation, accessible controls, and protection for unsaved drafts.

## Monorepo Architecture

This project is organized as a **monorepo managed with npm workspaces**, containing a React frontend and an Express backend:

```text
.
├── Frontend/
│   ├── public/assets/     # Artwork, fonts, and license notices
│   ├── src/               # Pages, shared components, data access, and styles
│   ├── tests/             # Browser and unit tests
│   └── design-reference/  # Preserved design assets
├── backend/
│   ├── src/               # Express routes, authentication, and service helpers
│   ├── supabase/
│   │   └── migrations/    # Database schema and business operations
│   ├── scripts/           # Database and integration tooling
│   └── tests/             # API and database tests
├── api/                   # Vercel API entry point
├── package.json           # Shared npm workspace commands
├── vercel.json            # Unified frontend/API hosting configuration
└── HandsOff.md            # Development context and task history
```

Use the exact `Frontend` capitalization on case-sensitive systems and in hosting configuration.

## Team & Domain Responsibilities

- **Aquino:** Project Manager / Research Developer / Quality Assurance.
- **Alba:** Lead Backend Developer / Frontend Developer.
- **Santiago:** Lead Frontend Developer / UI/UX Designer.
- **Mejia:** Backend Developer / Research Developer / Database Manager.
- **Yoingco:** Frontend Developer / UI/UX Designer.

## Setup Instructions

**Requirements:** Node.js **24.x**, npm, and a configured Supabase project. Application access requires an authorized account.

1. Clone the repository:

   ```powershell
   git clone https://github.com/Huuujji/Vertwell.git
   cd Vertwell
   ```

2. Install dependencies across both workspaces:

   ```powershell
   npm install
   ```

3. Create the local environment files from the provided examples. Keep existing environment files if the project is already configured:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   Copy-Item Frontend/.env.example Frontend/.env
   ```

   Configure the Supabase connection values using the [database setup guide](backend/supabase/README.md) and [authentication guide](backend/supabase/AUTHENTICATION.md). Initialize the required database schema and account access before signing in. Secret keys belong only on the backend; frontend environment variables must contain publishable values only.

4. Start the frontend and backend development servers:

   ```powershell
   npm run dev
   ```

   Open [localhost:5173](http://localhost:5173) for the application. The backend runs at [localhost:3001](http://localhost:3001), with local `/api` requests forwarded by Vite.

   To run the applications separately, use `npm run dev:frontend` and `npm run dev:backend` in separate terminals.

## Development Workflow

1. Coordinate the base branch with the Project Manager, update it, and create a feature branch for the assigned work:

   ```powershell
   git switch -c feat/your-feature
   ```

2. Validate changes with the shared project checks:

   ```powershell
   npm run typecheck
   npm test
   npm run build
   ```

   For interface changes, run the frontend browser checks as well:

   ```powershell
   npm run test:e2e --workspace Frontend
   ```

   Browser tests use Microsoft Edge on Windows. On other systems, install Playwright Chromium from `Frontend` with `npx playwright install chromium`.

3. Review the diff, keep environment secrets and generated artifacts out of commits, and open a Pull Request against the team-agreed target branch for code review.

4. Record implementation progress and verification results in [HandsOff.md](HandsOff.md). Keep this README focused on the public project introduction; edit it only when the Project Manager explicitly requests a README change.

## Technical Documentation

- [Database Setup & Design](backend/supabase/README.md) · [Schema Design](backend/supabase/DESIGN.md)
- [Authentication](backend/supabase/AUTHENTICATION.md) · [Role Permissions](backend/supabase/AUTHORIZATION.md)
- [Inventory & Accounts](backend/supabase/CRUD.md) · [Checkout](backend/supabase/CHECKOUT.md)
- [Sales Workflows](backend/supabase/SALES_WORKFLOWS.md) · [Reports](backend/supabase/REPORTS.md)
- [Live Updates](backend/supabase/LIVE_UPDATES.md) · [In-App Notifications](backend/supabase/NOTIFICATIONS.md)
