# KMF Schools: notes for working on this repo

- Multi-school platform. Never write a query without filtering by `school_id`, and never rely on the app alone for access control: every table has row level security in `supabase/migrations`. Add RLS policies and a check in `supabase/tests/access-rules.test.mjs` for every new table.
- Grant access in the same migration that creates a table (Supabase stopped granting it automatically on 30 Oct 2026): `grant select, insert, update, delete on public.<table> to authenticated, service_role;` and nothing to `anon` unless signed-out visitors truly need it. The database tests fail if a table has no grants.
- Next.js 16: request handling lives in `apps/portal/proxy.ts` (not `middleware.ts`). Read the docs in `node_modules/next/dist/docs` before using an API you're unsure of.
- Design follows the Academica reference: Academica green (`#1a8754`) as the default, Ubuntu headings, Nunito Sans body, rounded cards, pill buttons. Use tokens from `packages/ui/src/theme.css`; never hard-code a school colour, use `bg-brand`, `text-brand-text` and friends.
- Each school's colour comes from `brandCssVars` in `packages/core`, which darkens colours as needed to keep text readable.
- Demo mode (no Supabase env vars) must keep working: every data function in `apps/portal/lib/data.ts` has a demo branch, and demo filtering must mirror the database rules.
- Keep it lean: the schools are in Taraba State and across Nigeria, on phones and mobile data. No feature that adds running cost without clear value.
- Copy is plain, sentence case, written for proprietors, teachers and parents.
