# IT Manager Portal — Phase 2

A private, single-admin IT management portal built for a 20–25 person company. Every record is tracked here: employees, systems, credentials, software licenses, network configs, documents, notes, and tasks — all in one lightweight local app.

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS · shadcn/ui-style components · Prisma + SQLite · Framer Motion

---

## Important — read this first

This codebase was written in a sandboxed environment with **no access to the npm registry**, so it could not be installed, compiled, or type-checked during development. Every file was written carefully against known-correct Next.js 15 / React 19 / Prisma / shadcn conventions. Treat the first `npm run build` on your machine as the real verification step. If it surfaces TypeScript or ESLint errors, send them back and they'll be fixed immediately.

---

## Prerequisites

- Node.js 20 or later
- npm 10 or later

---

## Setup

```bash
cd it-manager-portal
npm install

# Copy the env template and fill in real secrets
cp .env.example .env
```

Generate the two secrets `.env` needs:

```bash
# AUTH_SECRET — any long random string (signs JWT session cookies)
openssl rand -base64 32

# ENCRYPTION_KEY — must be exactly 64 hex characters (32 bytes for AES-256-GCM)
openssl rand -hex 32
```

Paste those into `.env`. Also set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_EMAIL` to real values — the defaults (`admin` / `ChangeMe@123`) are only for first-run.

### Database

```bash
npm run db:migrate   # creates prisma/dev.db and applies the full v2 schema
npm run db:seed      # creates the admin account + sample data (employees, systems, credentials, software, notes, tasks, categories, tags, custom fields)
```

`db:seed` is safe to re-run — it upserts the admin account and skips sample data if any employees already exist.

### Run

```bash
npm run dev          # http://localhost:3000  →  redirects to /login
```

Default credentials (change these via `.env`):
- **Username:** `admin`
- **Password:** `ChangeMe@123`

---

## Verify the build

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run build        # production build
```

All three should complete with zero errors.

---

## What's in Phase 2

### Eight fully working modules

Every module has: full CRUD (create / edit / duplicate / archive / restore / delete), validated forms, auto-save drafts, a TanStack Table with search + sort + faceted filters, a floating "+ Add" button (hotkey **C**), and a slide-over record sheet with three tabs — **Notes**, **Files**, and **Activity timeline**.

| Module | Key features |
|--------|-------------|
| **Employees** | Name, department, email, phone, joining date, status, category, tags |
| **Systems** | Asset ID, specs (CPU/RAM/storage/OS/Office), warranty, allocation history, quick event logger |
| **Credentials** | AES-256-GCM encrypted passwords, reveal/copy/auto-hide, password generator |
| **Software** | License keys, expiry warnings, installation tracking per system |
| **Network** | WiFi (encrypted password), router IP/gateway/DNS, ISP details |
| **Documents** | File upload (PDF/images/ZIP/any), title, category, download |
| **Notes** | Rich-text editor, pin to top, categories |
| **Tasks** | Priority, due date, reminder, inline completion checkbox, overdue styling |

### Shared engine (used by every module)

- **Custom fields** — admin can create/rename/hide/reorder/delete fields of 11 types: Text, Textarea, Number, Date, Checkbox, Dropdown, Email, Phone, URL, Password, Tag list. Values stored in a `customFields Json` column; definitions in `CustomFieldDefinition`.
- **Custom categories** — unlimited per module, colour-coded, managed in Settings.
- **Tags** — shared across all modules; multi-select on every record; filter any table by tag.
- **Attachments** — drag-and-drop or click-to-upload on every record; stored in `storage/uploads/` (never `public/`); served through an authenticated route handler. 25 MB per file; no file-type restriction.
- **Private notes** — per-record notes distinct from the standalone Notes module.
- **Activity timeline** — every create/edit/archive/restore/delete/duplicate action is logged and shown on the record's Timeline tab.
- **Global search** — ⌘K command palette searches across all 8 modules + tags simultaneously.
- **Smart filters** — every table has a global text search, sortable columns, and faceted filter popovers for Status, Category, and Tags.
- **Draft auto-save** — forms auto-save to `localStorage` every 500 ms while the admin types; draft is cleared on successful save.

### Settings page

Tabs: **Profile** (name / email / username) · **Fields & Categories** (module picker → custom field manager + category manager) · **Tags** (global tag manager) · **Backup** · **Security** (change password) · **Appearance** (light / dark / system) · **About**.

### Backup & restore

| Action | How |
|--------|-----|
| Create backup | Settings → Backup → "Create backup now" (also runs automatically 60 s after startup, then every 24 h via `src/instrumentation.ts`) |
| Download SQLite file | `GET /api/backup/database` — streams the live `.db` file |
| Export JSON | `GET /api/backup/export` — dumps all 18 tables as a human-readable JSON snapshot |
| Restore | Upload a `.db` file in Settings → Backup; a `pre-import` safety backup is taken first; validates SQLite magic header before overwriting |

Up to 20 backups kept per type (`manual` / `auto` / `pre-import`) — oldest pruned automatically.

### UX & keyboard shortcuts

| Key | Action |
|-----|--------|
| **C** | Open "create" sheet on the current module page |
| **⌘K** | Global search |
| **?** | Show keyboard shortcuts reference |
| **Esc** | Close any open sheet or dialog |

Additional UX: loading skeletons on every page, toast notifications for every action, confirmation dialogs for destructive operations, beautiful empty states, responsive layout (mobile sidebar in a slide-over `Sheet`), light/dark/system theme.

---

## Architecture

```
src/
├── app/
│   ├── (portal)/              # Route group — everything behind auth
│   │   ├── layout.tsx         # Sidebar + Topbar + ShortcutsDialog
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── systems/
│   │   ├── credentials/
│   │   ├── software/
│   │   ├── network/
│   │   ├── documents/
│   │   ├── notes/
│   │   ├── tasks/
│   │   └── settings/
│   ├── api/
│   │   ├── backup/            # database download, JSON export
│   │   └── files/[id]/        # authenticated file streaming
│   └── login/
├── components/
│   ├── data-table/            # Generic TanStack Table + faceted filters
│   ├── layout/                # Sidebar, Topbar, ThemeToggle, UserMenu
│   ├── shared/                # RecordSheet, QuickAddFab, ConfirmDialog, ShortcutsDialog …
│   └── ui/                    # shadcn/ui-style primitives (Button, Input, Card, Dialog …)
├── config/
│   ├── modules.ts             # Single source of truth for all 8 modules
│   └── nav.ts
├── features/
│   ├── activity/              # Record timeline actions
│   ├── attachments/           # Upload/download/delete
│   ├── backup/                # Manual backup, restore
│   ├── categories/            # Per-module CRUD
│   ├── credentials/
│   ├── custom-fields/         # Definitions + dynamic form rendering
│   ├── dashboard/
│   ├── documents/
│   ├── employees/
│   ├── network/
│   ├── notes/
│   ├── record-notes/          # Per-record private notes
│   ├── search/                # globalSearch() server action
│   ├── settings/              # Profile + password actions
│   ├── software/
│   ├── systems/
│   ├── tags/
│   └── tasks/
├── hooks/
│   ├── use-draft.ts           # localStorage draft auto-save
│   └── use-hotkey.ts          # Single-key shortcuts (ignores typing targets)
├── instrumentation.ts         # Auto-backup on startup + every 24 h
└── lib/
    ├── activity.ts            # logActivity() shared helper
    ├── auth/                  # session, dal, rate-limit
    ├── backup.ts              # SQLite file backup/restore
    ├── colors.ts              # Category/tag colour swatches
    ├── custom-fields/         # Types + Zod schema builder
    ├── generate-password.ts   # Client-side crypto.getRandomValues
    ├── module-tables.ts       # clearCategoryFromModule dispatch
    ├── prisma.ts
    ├── security/              # AES-256-GCM encrypt/decrypt
    ├── storage.ts             # Local file I/O (uploads, copy, delete)
    └── validations/

prisma/
├── schema.prisma              # Full v2 schema (18 models, CustomFieldDefinition, Tag, etc.)
└── seed.ts                    # Admin account + realistic sample data

storage/                       # Created at runtime — gitignored
├── uploads/                   # Attachments and documents
└── backups/                   # SQLite backup copies
```

### Key design decisions

- **Single SQLite file** — zero infrastructure, instant startup, trivially portable. The whole database is one `.db` file you can copy anywhere.
- **Typed core + JSON extension** — each module has well-typed core fields (fast queries) plus a `customFields Json?` column for admin-defined fields. No full EAV complexity.
- **No hard FK for Category/Tag** — categories and tags are keyed by a `module` string discriminator so they're shared without a relation explosion across 8 modules.
- **Backups = file copy** — copying the SQLite file is the safest backup for this scale. No JSON reconstruction risk, no FK ordering headaches.
- **Attachments never in `public/`** — files are served through `/api/files/[id]` which checks auth and resolves the path from the database, preventing path traversal.
- **Edge-compatible middleware** — `jose` (Web Crypto) for JWT verification in middleware; `bcryptjs` and `node:crypto` (AES-GCM) only in Node.js Server Actions.

---

## Storage

Two directories are created at runtime and should be **gitignored** (already in `.gitignore`):

- `storage/uploads/` — all uploaded attachments and documents, organised as `<module>/<recordId>/<filename>`
- `storage/backups/` — automatic and manual SQLite backups, named `<prefix>-<ISO-timestamp>.db`

For production use, back these up regularly alongside the database file.

---

## Environment variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | `file:./dev.db` | Path to SQLite file (relative to `prisma/`) |
| `AUTH_SECRET` | Yes | — | Signs JWT session cookies; generate with `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Yes | — | AES-256-GCM key for passwords; must be 64 hex chars (`openssl rand -hex 32`) |
| `ADMIN_USERNAME` | No | `admin` | Seed-time only |
| `ADMIN_PASSWORD` | No | `ChangeMe@123` | Seed-time only — change this |
| `ADMIN_EMAIL` | No | `admin@company.com` | Seed-time only |
| `ADMIN_NAME` | No | `IT Administrator` | Seed-time only |
| `SESSION_COOKIE_NAME` | No | `itmp_session` | Cookie name for the session JWT |
| `NODE_ENV` | No | `development` | Set to `production` for `next build` / `next start` |
