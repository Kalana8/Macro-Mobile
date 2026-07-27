# Macro

Two separate Next.js 16 apps sharing one Supabase backend:

- **apps/employee-app** — mobile-first PWA (login + geofence, home/sites, attendance, audits, checklists, communication, profile).
- **apps/admin-dashboard** — desktop web console (dashboard, companies, employees, attendance, audits, checklists, communication, roles & access).
- **packages/shared** — Supabase clients, Firebase (chat) clients, geofence/RBAC logic, DB types, and design tokens used by both apps.
- **supabase/** — SQL schema, Row-Level Security policies, seed data, and Edge Function stubs.
- **mockups/** — the original design prototypes (`.dc.html`) and Architecture Document this build was implemented from. Kept for reference.

See `Architecture Document.dc.html` in `mockups/` for the full system design this implementation follows, and the plan this was built from for what's fully wired up vs. scaffolded-only in this first pass.

## Getting started

```bash
npm install
```

### 1. Create a Supabase project

Apply the schema in order:

```bash
# in the Supabase SQL editor, or via the Supabase CLI:
supabase db execute -f supabase/migrations/0001_init.sql
supabase db execute -f supabase/migrations/0002_rls.sql
supabase db execute -f supabase/seed.sql
```

This creates all tables, enums, storage buckets, RLS policies, and the three default roles (Admin, Supervisor, Field Employee).

You'll then need to manually create your first Admin login: create a user in Supabase Auth, then insert a matching row into `employees` with `access_role_id` set to the seeded "Admin" role's id. After that, use the Admin Dashboard's Employees page to provision everyone else.

### 2. Configure environment variables

Copy each app's `.env.example` to `.env.local` and fill in your Supabase project URL/anon key (and, for the admin dashboard, the service role key — required to provision employee logins).

```bash
cp apps/employee-app/.env.example apps/employee-app/.env.local
cp apps/admin-dashboard/.env.example apps/admin-dashboard/.env.local
```

Firebase config is optional for now — Communication screens run on read-only Postgres data until a Firebase project + the `mint-firebase-token` Edge Function are connected (see `supabase/functions/`).

### 3. Run the apps

```bash
npm run dev:app     # employee-app   → http://localhost:3000
npm run dev:admin   # admin-dashboard → http://localhost:3001
```

## What's fully wired up vs. scaffolded

**Live (real Supabase reads/writes):**
- Employee app: Login (incl. geofenced login for field roles), Home (assigned sites), Attendance (clock in/out/break — re-checks the geofence server-side on every clock-in), Create Audit, Change Password.
- Admin dashboard: Dashboard stat counts, Companies (full CRUD + assign/remove employees), Employees (full CRUD, provisions real Supabase Auth logins), Attendance (daily view).

**Scaffolded (real layout + read queries, write/interactive flows stubbed with a visible note):**
- Employee app: Checklists, Communication, Audits list marks display.
- Admin dashboard: Audits (add/score modal), Checklists (create template / assign modals), Communication (respond), Roles & Access (create/edit role modal).

Search for `follow-up pass` in either app to find every stubbed action.
