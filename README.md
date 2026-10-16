# KMF Schools

School websites and management portals for Nigerian schools, by [KMF Enterprise](https://www.kmfenterprise.ng/).

One codebase and one database serve every school. Each school is recognised by its web address and sees only its own name, colours and records.

## What's here

| Folder | What it is |
| --- | --- |
| `apps/portal` | The school portal (Next.js 16, App Router) |
| `packages/core` | Shared logic: school detection from the address, brand colours, roles, starter curriculum, grading scales |
| `packages/ui` | Design system in the Academica style: tokens, buttons, cards, badges, forms |
| `supabase/migrations` | Database schema with row level security |
| `supabase/seed.sql` | Brightfield Academy, a fictional demo school |
| `supabase/tests` | Checks that each school's data stays separate and each role sees only what it should |

## Run it locally

Requires Node 20.9 or newer.

```bash
npm install
npm run build
npm start
```

Then open:

- http://localhost:3000 for the KMF Schools platform page
- http://brightfield.localhost:3000 for the demo school portal

With no Supabase settings, the portal runs in **demo mode** on built-in sample data. The login page then offers "Explore the demo" buttons to sign in as an admin, teacher, parent or student. This is useful for showing schools the portal before anything is set up.

For development with live reload, use `npm run dev`.

## Connect a real database

1. Create a Supabase project.
2. Run the files in `supabase/migrations` in order (SQL editor, or `supabase db push` with the Supabase CLI), then `supabase/seed.sql` if you want the demo school.
3. In Supabase, under **Authentication → Sign In / Providers**, keep email sign-in on and turn **off** "Confirm email". Students sign in with admission numbers, which map to private addresses that can't receive mail.
4. Copy `apps/portal/.env.example` to `apps/portal/.env.local` and fill in the project URL and publishable key. In production, set the same values in Vercel.
5. Create the first admin: add a user under **Authentication → Users**, then in the SQL editor:

```sql
insert into public.school_members (school_id, user_id, role, display_name)
values ('<school id>', '<user id>', 'owner', 'Mrs Example');
```

Tools for adding schools, staff and students from the portal itself come in the next milestones.

## How schools are recognised

| Address | How it's matched |
| --- | --- |
| `brightfield.kmfschools.ng` | The subdomain is the school's slug |
| `portal.brightfield.com.ng` | Exact match in the `school_domains` table |
| `brightfield.localhost:3000` | Local development, same as a subdomain |

To connect a school's own domain: the school adds a DNS record pointing to Vercel, KMF adds the domain to the Vercel project, then adds a row to `school_domains`.

## Security model

- Every school-owned table has a `school_id`, and composite foreign keys stop any record from linking to another school's records.
- Row level security decides what each person sees: staff see their school's records, parents see only their own children, students see only themselves, and signed-out visitors see only public announcements.
- Signed-out visitors can look up a school's public branding through `resolve_school`, and nothing else.
- Pages check the signed-in person's role on the server as well; the database rules are the final guard.

## Checks

```bash
npm run typecheck
npm run lint
npm test          # unit tests and database access rules
```
