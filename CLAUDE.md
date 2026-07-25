# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

IT Manager Portal — a private, single-admin IT management portal for a 20–25 person company. Every record (employees, systems, credentials, software licenses, network configs, documents, notes, tasks) lives in one lightweight local app backed by a single SQLite file.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn/ui-style components · Prisma + SQLite · Framer Motion

## Commands

```bash
npm run dev          # http://localhost:3000 (redirects to /login)
npm run build         # production build
npm run start          # run the production build

npm run typecheck     # tsc --noEmit
npm run lint            # next lint

npm run db:migrate    # prisma migrate dev — creates prisma/dev.db and applies the schema
npm run db:seed         # tsx prisma/seed.ts — admin account + sample data (safe to re-run; upserts admin, skips samples if employees already exist)
npm run db:push        # prisma db push
npm run db:generate  # prisma generate (also runs automatically via postinstall)
npm run db:studio      # prisma studio
```

There is no test runner configured in this project (no `test` script, no test framework in `package.json`). Verification is `typecheck` + `lint` + `build`, all of which must complete with zero errors before considering a change done.

Requires two secrets in `.env` (see `.env.example`): `AUTH_SECRET` (`openssl rand -base64 32`) and `ENCRYPTION_KEY` (`openssl rand -hex 32`, must be exactly 64 hex chars).

## Architecture

### The module system is the core abstraction

`src/config/modules.ts` defines `MODULE_KEYS` (`employees`, `systems`, `credentials`, `software`, `network`, `documents`, `notes`, `tasks`) as the single source of truth. Every cross-cutting feature — custom fields, categories, tags, attachments, record notes, activity timeline, quick-add, global search — is keyed off this `ModuleKey` string rather than a per-module relation, so adding a module means extending this list plus the shared engine, not touching each shared feature individually.

This module-string discriminator pattern shows up throughout the schema and code instead of foreign keys:
- `CustomFieldDefinition`, `Category` are scoped by a `module` string.
- `TagAssignment`, `RecordNote`, `Attachment` are keyed by `module` + `recordId` (no FK — a generic join usable by every module).
- `ActivityLog.entityType` is the module key.
- `src/lib/module-tables.ts` dispatches by module key when an operation (e.g. clearing a category) needs to touch the right Prisma table.

When working on a module-scoped feature, always check whether the change belongs in the shared engine (`src/features/{categories,tags,custom-fields,activity,attachments,record-notes,search}/`) rather than duplicated per-module.

### Typed core + JSON extension (not full EAV)

Each module model (`Employee`, `System`, `Credential`, etc.) has well-typed core columns for fast queries, plus one `customFields String?` column storing a JSON blob for admin-defined fields (see `CustomFieldDefinition`, 11 field types, rendered dynamically via `src/lib/custom-fields/`). Don't add ad hoc columns for one-off admin-configurable fields — that's what the custom fields system is for.

### Server Actions, not API routes, for CRUD

Feature logic lives in `src/features/<module>/actions.ts` as `"use server"` functions (see `src/features/employees/actions.ts` for the canonical pattern: `getX`, `createX`, `updateX`, `archiveX`, `restoreX`, `deleteX`, `duplicateX`). Every mutating action:
1. Calls `requireAdmin()` first (from `src/lib/auth/dal.ts`).
2. Parses input through a Zod schema (`src/features/<module>/schema.ts`), then validates custom fields via `buildCustomFieldsSchema(defs)`.
3. Writes tags via `setRecordTags`/`copyRecordTags` (`src/features/tags/actions.ts`).
4. Logs the action via `logActivity()` (`src/lib/activity.ts`) — this powers both the Dashboard feed and the record's Timeline tab.
5. Calls `revalidatePath()` for the module's list page (and `/dashboard`).

Follow this five-step shape for any new mutation rather than inventing a new pattern. Archive/restore/delete are distinct: archive sets `archivedAt` (soft delete, default list views filter it out), delete is permanent.

`src/app/api/` is reserved for things that aren't plain server actions: authenticated file streaming (`api/files/[id]`) and backup download/export (`api/backup/`).

### Auth: defense in depth, Edge + Node split

- `src/middleware.ts` runs on the Edge runtime and does a first-pass check using `jose` (`jwtVerify`, Web Crypto) — Edge cannot use `node:crypto`.
- `src/lib/auth/dal.ts`'s `requireAdmin()` / `getCurrentAdmin()` is the second, authoritative check that Server Components and Server Actions call directly (Next.js's recommended defense-in-depth pattern — don't rely on middleware alone for a page or action that touches sensitive data).
- Session is a signed JWT cookie (`src/lib/auth/session.ts`), payload `{ adminId, username }`, built "one admin today, more tomorrow" — promoting to multi-user later only changes where `adminId` comes from.
- `bcryptjs` and `node:crypto`-based AES-GCM (`src/lib/security/encryption.ts`) are Node-only — never import them into `middleware.ts` or anything that might run on the Edge runtime.

### Secrets at rest

Credential Vault passwords and WiFi passwords are AES-256-GCM encrypted (`src/lib/security/encryption.ts`, `encrypt`/`decrypt`, storing `ciphertext`/`iv`/`authTag` — see `Credential` and `NetworkConfig` models). `ENCRYPTION_KEY` must be a 64-char hex string; never log or expose decrypted values outside the specific reveal/copy UI paths.

### RecordSheet: the shared slide-over shell

`src/components/shared/record-sheet.tsx` is the slide-over every module's create/edit form renders inside. When `recordId` is present it wraps the module's own form (passed as `children`, rendered under the "Details" tab) with three generic tabs — Notes, Files ("attachments"), Activity — each lazily fetching from the shared engine (`listRecordNotes`, `listAttachments`, `getRecordTimeline`) only when selected, not up front. New modules get these three tabs for free by using `RecordSheet`; don't build bespoke notes/files/activity UI per module.

### Custom fields validation detail

`buildCustomFieldsSchema()` (`src/lib/custom-fields/schema.ts`) builds a Zod object with `.passthrough()` — deliberately, so that if an admin deletes a `CustomFieldDefinition` after records already have a value stored under that key, existing records don't fail validation on their next unrelated save. Keep `.passthrough()` if you touch this function.

### Global search

`globalSearch()` (`src/features/search/actions.ts`) is one server action that fans a single query out to all 8 module tables in parallel (`Promise.all`, `contains` filters, `PER_MODULE_LIMIT = 5` each) plus a `Tag` lookup that surfaces records via matching tag name, deduped against direct hits. This is what powers ⌘K — there's no search index; it's plain SQLite `LIKE` queries per request.

### Attachments

Files are stored under `storage/uploads/<module>/<recordId>/<filename>` (gitignored, created at runtime) — never in `public/`. They're served only through `/api/files/[id]`, which checks auth and resolves the path from the `Attachment` row in the database, preventing path traversal. `src/lib/storage.ts` handles local file I/O.

### Backups

SQLite file-copy backups (not JSON reconstruction) via `src/lib/backup.ts`, stored in `storage/backups/`, up to 20 kept per type (`manual` / `auto` / `pre-import`) with oldest pruned automatically. Auto-backup runs on startup + every 24h via `src/instrumentation.ts`. Restore takes a `pre-import` safety backup first and validates the SQLite magic header before overwriting.

### Directory map

```
src/app/(portal)/     Route group behind auth — layout has Sidebar + Topbar + ShortcutsDialog; one folder per module + dashboard/settings
src/app/api/           backup download/export, authenticated file streaming — not general CRUD
src/components/data-table/   Generic TanStack Table + faceted filters, reused by every module
src/components/shared/       RecordSheet, QuickAddFab, ConfirmDialog, ShortcutsDialog
src/components/ui/           shadcn/ui-style primitives
src/config/modules.ts        Single source of truth for module keys/labels/icons — read this first for any cross-module change
src/features/<module>/       actions.ts (server actions), schema.ts (Zod), components/
src/features/{activity,attachments,backup,categories,custom-fields,record-notes,search,tags}/  shared engine, used by all modules
src/hooks/use-draft.ts       localStorage draft auto-save (500ms) for forms
src/hooks/use-hotkey.ts      single-key shortcuts, ignores typing targets (inputs/textareas)
src/lib/auth/                session, dal (requireAdmin), rate-limit
src/lib/security/            AES-256-GCM encrypt/decrypt (Node-only)
src/lib/module-tables.ts     module-key → Prisma table dispatch (e.g. clearCategoryFromModule)
prisma/schema.prisma         full schema — read the header comment block per model group before adding models
prisma/seed.ts                admin account + sample data
```

## Conventions to follow

- New module-scoped feature → check `MODULE_KEYS`/`MODULES` in `src/config/modules.ts` first; wire into the shared engine (categories, tags, custom fields, attachments, activity) rather than reimplementing per-module.
- New mutating action → follow the `requireAdmin` → Zod parse → custom-fields validate → tags → `logActivity` → `revalidatePath` sequence from `src/features/employees/actions.ts`.
- Never import `node:crypto`-based code (`src/lib/security/encryption.ts`, bcryptjs) into anything that runs in `middleware.ts` or the Edge runtime — use `jose` there instead.
- Never write uploaded/generated files under `public/`; route them through `storage/uploads/` + `/api/files/[id]`.
- Categories/tags/custom fields use string discriminators, not Prisma relations — don't "fix" this into a hard FK per module, it's deliberate (see `prisma/schema.prisma` header comment).
- `npm run typecheck`, `npm run lint`, and `npm run build` should all pass with zero errors before treating a change as complete — this project has no automated test suite, so these are the verification gates.
