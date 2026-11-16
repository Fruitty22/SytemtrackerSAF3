# Putting the Fleet Admin Dashboard online (Vercel + free Supabase database)

Everything here is **free**: the site runs on **Vercel** (Hobby plan), the data is in a
**Supabase** Postgres database (free plan), and the assistant is built in (optionally
made smarter with Groq's free tier).

```
Browser ──> Vercel (the app + /api function) ──> Supabase (table fleet_store)
                                         └────> Groq (optional, only if GROQ_API_KEY is set)
```

Nothing in Supabase is reachable from the browser: only the Vercel function has the key.

---

## 1. Create the free database (Supabase), about 5 minutes

1. Go to <https://supabase.com> → **Start your project** → sign in (GitHub is easiest).
2. **New project**: give it a name (e.g. `fleet-tracker`), set a database password
   (keep it somewhere safe), and pick the region **Southeast Asia (Singapore)**. Create.
3. When it's ready: left menu → **SQL Editor** → **New query**. Open
   `supabase/schema.sql` from this project, paste all of it, press **Run**.
   You should see "Success. No rows returned".
4. Left menu → **Project Settings** → **API** (or **API Keys**). Copy:
   - **Project URL**: looks like `https://abcdefgh.supabase.co`
   - the **service_role** key (or the **secret** key, `sb_secret_...`). This key can
     read and change everything, so never put it in the browser code or on GitHub.

> Free-plan note: Supabase pauses a free project after **7 days with no use at all**.
> A daily-used tracker never hits this. If it does get paused, open the Supabase
> dashboard and press **Restore**; no data is lost.

## 2. Put the code on GitHub

Vercel deploys from a GitHub repository.

1. Create a **private** repository on GitHub (e.g. `systemtracker-saf`).
2. Upload this folder **without** `node_modules`, `dist` and `server/data`
   (the `.gitignore` file already leaves them out if you use git):
   ```bash
   git init
   git add .
   git commit -m "Fleet tracker with cloud database and assistant"
   git branch -M main
   git remote add origin https://github.com/<you>/systemtracker-saf.git
   git push -u origin main
   ```

## 3. Connect it to Vercel

Your existing project `systemtracker-saf-2` can be reused:

1. Vercel → project **systemtracker-saf-2** → **Settings** → **Git** → **Connect Git Repository** → pick
   the repository. (Or **Add New → Project** → import the repository.)
2. Framework preset: **Vite** (already set by `vercel.json`). Build command `npm run build`,
   output `dist`. Leave the defaults.
3. **Settings → Environment Variables**: add these for **Production** (and Preview if you use it):

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | the Project URL from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role / secret key from step 1 |
   | `GROQ_API_KEY` | optional: free Groq key for the smarter assistant (step 5) |
   | `ALLOW_SIGNUP` | `false` once your accounts exist (step 6) |

4. **Deployments** → **Redeploy** (env variables only apply to new deployments).
5. Open the site. With an empty database it opens on **Sign up**: the first account
   you create becomes the **Admin**.

## 4. Bring your existing data across (optional)

If you've been using the app on your own computer, copy `server/data/db.json` (accounts,
vehicles, bookings, disregards) to Supabase once. On your computer, in the project folder:

```bash
# Mac / Linux
SUPABASE_URL=https://abcdefgh.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run db:push

# Windows PowerShell
$env:SUPABASE_URL="https://abcdefgh.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."; npm run db:push
```

It refuses to overwrite a cloud database that already has accounts or vehicles
(add `--force` if you really mean to). Everyone logs in again afterwards with their
usual username and password.

Otherwise: log in as Admin → **Manage Vehicles → Import from Excel** → choose the commanders'
files. That's the only import needed: no Excel macros first.

## 5. The assistant (free)

The robot button at the bottom right works **straight away, with no key and no cost**.

**Built-in assistant (default):** no AI service, nothing leaves your app. It understands
short, direct requests:

| Type | Example |
| --- | --- |
| How-to | "how do I import Excel files?", "how do I unblock a vehicle?", "what does DEPLOYED mean?" |
| Counts | "how many vehicles are unavailable?", "summary" |
| Lists | "which 6 TON GS are down?", "which vehicles are on tasking?", "show overseas vehicles", "which have aircon N" |
| One vehicle | "21714", "why is 21714 unavailable?" |
| Changes (cards to Confirm) | "set 21714 aircon N", "21714 tyres Y and MLC N", "put 21717 on tasking XCA", "clear VOR on 21718", "mark 21829 and 21843 VOR X" |
| Bookings (cards to Confirm) | "book 21714 for tasking XCA tomorrow", "book 21714 servicing 12/11 to 14/11" |

**Optional, smarter and still free: Groq.** For free-form questions ("anything due for
servicing that's also on standby?"), add a free Groq key:

1. <https://console.groq.com> → sign up (no credit card) → **API Keys** → **Create API Key**.
2. Vercel → Settings → Environment Variables → `GROQ_API_KEY` = the key → **Redeploy**.
3. The assistant's header changes to "AI (Groq, free tier)".

The free tier allows roughly 1,000 questions a day for the default model
(`openai/gpt-oss-120b`) across your whole team; check the exact limits on Groq's Limits
page. When the quota runs out or Groq is down, the **built-in assistant answers instead**,
so it never stops working. Each person is limited to 10 AI questions a minute so one
user can't use up the quota.

**Data:** with Groq switched on, questions and the vehicle details the assistant looks up
(MIDs, types, statuses, remarks) go to Groq. Groq says inference data isn't kept by default
except up to 30 days for abuse and reliability checks, and you can switch on **Zero Data
Retention** under Data Controls in the Groq console. Check your unit allows fleet data to
leave before adding the key. **Without a key, nothing is ever sent anywhere.**

Either way: changes are only saved when the user presses **Confirm**, each user only sees
their own vehicles, and it can't delete vehicles or change accounts.

(Other options: any OpenAI-compatible service with `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`,
or the paid Claude API with `ANTHROPIC_API_KEY`.)

## 6. Lock it down

The site is now on the public internet, so:

- Once everyone has an account, set **`ALLOW_SIGNUP=false`** in Vercel and redeploy. The Sign up
  tab disappears and only an Admin can create accounts (Accounts page → Add).
- Optional: Vercel → Settings → **Deployment Protection** can put a password or Vercel login
  in front of the whole site.
- Passwords are stored hashed (scrypt), logins expire after 12 hours, and traffic is HTTPS.

## Running it on your own computer (still works)

```bash
npm install
npm run dev        # http://localhost:5000
```

Without `SUPABASE_URL` it uses `server/data/db.json` exactly as before. To test against
the cloud database or Groq locally, copy `.env.example` to `.env.local` and fill it in.

## If something goes wrong

| What you see | Fix |
| --- | --- |
| "No database is connected" | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing in Vercel; add them and **Redeploy** |
| "The table fleet_store doesn't exist yet" | Run `supabase/schema.sql` in the Supabase SQL Editor |
| "Database error (401)" | Wrong key: use the **service_role / secret** key, not the anon / publishable key |
| Assistant says "the AI service isn't answering" | Groq key wrong or free quota used up; the built-in assistant answers meanwhile. Check the key in Vercel, or wait for the quota to reset |
| An import went wrong | Straight after it, press **Undo this import** in the import window |
| Vercel logs | Vercel → project → **Logs** (errors from `/api` show up there) |
