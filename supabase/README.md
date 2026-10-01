# BellDesk Supabase setup

BellDesk uses a shared team code and a Vercel API endpoint. The browser sends the code to `/api/state`; only that server function reads `SUPABASE_SECRET_KEY` and accesses Supabase. Do not put the Supabase secret key in `index.html`, a public config file, or Git.

## 1. Create the table

In the Supabase dashboard, open **SQL Editor**, paste and run [`schema.sql`](schema.sql). The table has Row Level Security enabled and no public policies. The browser cannot access it directly.

## 2. Configure Vercel

Open the Vercel project settings and add these Environment Variables for Production (and Preview/Development if needed):

- `SUPABASE_URL`: Project URL from Supabase Project Connect settings.
- `SUPABASE_SECRET_KEY`: A Supabase secret key (`sb_secret_…`). Keep it server-side only.
- `BELLDESK_SHARED_CODE`: A long, hard-to-guess code shared with the team.

Redeploy after adding the variables. The deployed site asks for the shared code. Each browser session keeps it in session storage; it is cleared when the session ends.

## 3. Deploy

Deploy the `outputs` directory as the Vercel project root. Vercel will serve `index.html` and deploy `api/state.js` as a serverless function.

Shared employees, task types, task queues, task history, statuses, and shift records are stored in Supabase and refreshed in other open browsers about every eight seconds. The currently selected employee and manager access prompt remain local to each browser.

The shared code grants the same app access to everyone who knows it; it does not identify individual staff members or provide a secure distinction between staff and managers. Rotate the code in Vercel if it is shared beyond the team.
