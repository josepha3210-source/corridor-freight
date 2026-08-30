# Corridor Freight — Phase 1

Auth + multi-tenant foundation. See the chat walkthrough for the "why"
behind the schema and RLS design; this file is just the setup steps.

## 1. Create a Supabase project

Create a project at supabase.com, then go to **Settings → API** and copy
the Project URL and the `anon public` key.

## 2. Configure env vars

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 3. Run the migration

In the Supabase dashboard, open **SQL Editor**, paste the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
and run it. (Or, if you use the Supabase CLI: `supabase link` then
`supabase db push`.)

## 4. Email confirmation setting

By default Supabase requires email confirmation before a session is
issued. For local development you can turn this off under
**Authentication → Providers → Email → Confirm email** so sign-up logs
you straight in. Leave it **on** for production.

If you keep it on, set the Site URL and Redirect URLs under
**Authentication → URL Configuration** to include
`http://localhost:3000/auth/callback` (and your production URL later).

## 5. Install and run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll land on `/signup`. Create a
company, then check `/dashboard`.

## Deploying to Vercel

Import the repo in Vercel, add the same two env vars in the project
settings, and add your production domain's `/auth/callback` URL to
Supabase's Redirect URLs list.
