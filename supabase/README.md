# BellDesk Supabase setup

BellDesk uses a Vercel API endpoint. Employees can open the app without a code; the manager code is required only to enter the manager view and change the roster, task types, or assignment queue. Only the server function reads `SUPABASE_SECRET_KEY`. Do not put the Supabase secret key in `index.html`, a public config file, or Git.

## 1. Create the table

In the Supabase dashboard, open **SQL Editor**, paste and run [`schema.sql`](schema.sql). The table has Row Level Security enabled and no public policies. The browser cannot access it directly.

## 2. Configure Vercel

Open the Vercel project settings and add these Environment Variables for Production (and Preview/Development if needed):

- `SUPABASE_URL`: Project URL from Supabase Project Connect settings.
- `SUPABASE_SECRET_KEY`: A Supabase secret key (`sb_secret_…`). Keep it server-side only.
- `BELLDESK_SHARED_CODE`: A long, hard-to-guess manager code. Share it only with managers.

Redeploy after adding the variables. The deployed site asks for the shared code. Each browser session keeps it in session storage; it is cleared when the session ends.

## 3. Deploy

Deploy the `outputs` directory as the Vercel project root. Vercel will serve `index.html` and deploy `api/state.js` as a serverless function.

Shared employees, task types, task queues, task history, statuses, and shift records are stored in Supabase and refreshed in other open browsers about every eight seconds. The currently selected employee remains local to each browser.

The no-code employee flow means anyone with the deployed URL can read the team data and submit employee-level status updates. The manager code protects manager-only changes; it does not identify individual employees. Rotate the manager code in Vercel if it is shared beyond managers.
