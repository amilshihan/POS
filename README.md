# Spare Parts Shop POS

A point-of-sale system for a spare parts shop: billing, inventory, customer credit tracking, supplier purchases, cheque tracking, and reports.

## Stack

Next.js (App Router, TypeScript) + Supabase (Postgres, Auth, Row Level Security) + Vercel.

## Local setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in your Supabase project's URL, anon key, and service role key.
3. Run the SQL in `supabase/migrations/0001_init.sql` once in your Supabase project's SQL editor.
4. Create your first user in Supabase Auth (Dashboard → Authentication → Users → Add user), then set that user's `role` to `admin` in the `profiles` table.
5. `npm run dev`
