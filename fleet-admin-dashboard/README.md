# Fleet Admin Dashboard

A fleet management web app for fleet commanders. People sign up for their own
account, each Fleet Commander manages their own list of vehicles, and every
change is saved to a JSON database file on the computer that runs the app.

## Getting started

Requires Node 20.19+ (or 22.12+).

```bash
npm install
npm run dev      # app + database server on http://localhost:5000
```

`npm run dev` starts both the screens and the small database server, so you
only need one terminal. There is nothing else to install.

### First run

1. Open http://localhost:5000. There are no accounts yet, so it opens on **Sign up**.
2. The **first account you create becomes the Admin.** It sees
   every vehicle and the **Accounts** page.
3. Everyone after that signs up as a **Fleet Commander** and sees only their
   own vehicles. The administrator can promote, rename, reset or delete
   accounts on the Accounts page.
 
## What's in it

| Page | What you can do |
| --- | --- |
| **Manage Vehicles** | Summary counts (AVA, NOT AVA, blocked, items N), the full vehicle table, **Add / Edit / Delete**, tick + **Assign to**, **Import from Excel** (admin), **Export to Excel** |
| **Serviceable Vehicle** | Read-only availability overview: AVA per type, filters (MID number, AVA / NOT AVA, type, blocked), and a table. Click a vehicle to see why it is AVA / NOT AVA |
| **Edit Maintenance Level** | Tick items (AVI SLIP, MLC, TYRES...), choose **Y** or **N**, apply. Clear one item or all. Items ignored for the vehicle's type are marked |
| **Edit Blocked Vehicles** | Tick fields, pick a value from the drop-down, apply. Clear to unblock. Each field has a switch to count / ignore it for **this vehicle only** |
| **Fleet Commander Dashboard** (everyone) | Your OWN fleet: AVA counts and readiness, per-type table, NOT AVA (and why), blocked fields, items N |
| **NC Dashboard** (admin) | The same dashboard for the whole fleet; switch to any commander or Unassigned |
| **Accounts** (admin) | Add, edit, reset password, change role, link worksheets, delete (and move their vehicles). Deleted accounts can be restored |
| **Manage Disregards** (everyone, under Pages) | Like the Excel "Special Disregards Criterias" form: pick a vehicle type, tick the criteria to **IGNORE**, Save. Shows who changed it last |
| Hide / Unhide Sheets, Next Day (admin) | Still placeholders |

### How AVA / NOT AVA is worked out

The same logic as the Excel criteria (see `shared/deployability.js`):

- **ANY BLOCKED** = a counted blocked field (TASKING, SELF DRIVE, TLOAN, OVERSEAS,
  STANDBY) has any text, or VOR STATUS is `X`
- **ANY ITEM = N** = a counted maintenance item is `N` (Y and blank pass)
- **AVA** = NOT (ANY BLOCKED OR ANY ITEM = N). Otherwise **NOT AVA**.
- "Counted" = not ignored for that vehicle type on **Manage Disregards**
  (e.g. VAMTAC (CEREMONY) ignores P-PLATE, CANOPY and CUSHION COVER;
  10 TON TOWER (B4) ignores P-PLATE, CUSHION COVER, FE and IVC 2). The same
  counted / ignored switches are on each vehicle's logic view (Serviceable Vehicle).

### Importing your workbook (Admin)

Only Admins import: the workbook is the master list. Manage Vehicles →
**Import from Excel** → choose the workbook → **Import**. Nothing to select.

- Every sheet is read. On each one it finds the `MID` heading, the vehicle type,
  and every column whose heading is a blocked field or maintenance item
  (`VOR STATUS`, `OVERSEAS`, `MLC`, `SAFETY BELTS / STRAP`...). If a sheet is read
  wrong, click **Change** next to it.
- **Sheets linked to an account** (or whose name contains the account's name,
  ranks ignored) go to that account.
- **Commander sheets nobody has linked yet** stay **Unassigned** until the
  commander claims them. Only Admins see Unassigned vehicles.
- **Whole-fleet sheets** (`GENERAL_SHEETS` in `shared/config.js`) fill in values
  missing elsewhere; vehicles only on them stay Unassigned.
- If a MID already exists: leave it, move it (keeps values entered in the app),
  or move it **and overwrite** its type, blocked fields and Y/N items from the workbook.

### Your worksheet (Fleet Commanders)

Menu at the top right → **My worksheet** → pick your sheet → **This sheet is mine**.
Its Unassigned vehicles move to you, and future imports send that sheet to you.

**Shared sheets:** if your name is in a sheet name that someone already has
("3SG Jungwoo" in "3SG Chong_3SG Kim Jungwoo"), you can **share** it: everyone on
the sheet sees and edits its vehicles. Otherwise an Admin can add you on the
Accounts page. **Leave** a sheet from the same dialog.

### Assigning vehicles (admin)

Tick vehicles in the Manage Vehicles table → **Assign to** an account → **Assign**.
You can also **Delete selected**. A single vehicle can be moved with Edit → Managed by.

### Your own account

Everyone can change their **display name and username** from the menu at the top
right (**My account**). It's saved to `db.json` straight away; log in with the new
username next time. Admins can also change anyone's username and linked worksheets
on the Accounts page.

## Changing the lists

Edit `shared/config.js`, then restart `npm run dev`:

- `BLOCK_FIELDS` - the blocked fields, their drop-down options, and which values block (VOR STATUS: X)
- `MAINTENANCE_FIELDS` / `MAINTENANCE_LEVELS` - the Y/N items
- `DEFAULT_DISREGARDS` - starting ignored fields per type (then use Manage Disregards)
- `DEFAULT_VEHICLE_TYPES` - suggested vehicle types
- `GENERAL_SHEETS` - sheets that list the whole fleet rather than one commander

## The database

- Everything is stored in **`server/data/db.json`**. It is created on the first run.
- Each time the server starts it copies the file to `server/data/db.backup.json`.
- **Back up `db.json` yourself** (copy it somewhere safe). Deleting it deletes
  every account and vehicle.
- Deleted accounts are moved to **`server/data/deleted-accounts.json`** (with
  when, by whom, and who took over their vehicles). An Admin can restore them
  from the Accounts page; they log in again with their old password.
- Passwords are stored hashed (scrypt), never as plain text.

## Letting others use it on your network

```bash
npm run build    # builds the app into dist/
npm start        # serves the app + database on port 5000
```

`npm start` prints the address other computers on the same network can open
(for example `http://192.168.1.20:5000`). Windows may ask you to allow Node
through the firewall. Use a different port with `PORT=8080 npm start` on Mac or
Linux, or `$env:PORT=8080; npm start` in PowerShell.

## Deploying on Vercel

The app also runs on Vercel. There the data is kept in an **Upstash Redis**
database instead of `server/data/db.json`, because Vercel doesn't keep files.

1. Push this folder to the GitHub repo your Vercel project deploys from
   (replace the old files; keep the repo's `.git` folder).
2. Vercel → your project → **Storage** → **Create Database** → **Upstash for Redis**
   (free plan) → **Connect** it to this project (all environments).
3. **Deployments** → **Redeploy** (or push a commit). `vercel.json` already tells
   Vercel how to build the app and route `/api/...` to `api/index.js`.
4. Open the site. With an empty database it opens on **Sign up**, and the first
   account becomes the Admin (same as locally).

**Moving your local data online (optional):** copy `KV_REST_API_URL` and
`KV_REST_API_TOKEN` from the database's **.env.local** tab in Vercel into a
`.env.local` file in this folder, then run `npm run push-db`. It refuses to
replace an online database that already has accounts unless you add `-- --force`.

| File | What it does |
| --- | --- |
| `vercel.json` | Build settings, `/api/...` routing, page refresh fallback |
| `api/index.js` | Runs `server/api.js` for each request on Vercel |
| `server/vercel-store.js` | Loads and saves the data in Redis; if two people save at once, neither change is lost |
| `scripts/push-db.js` | Uploads a local `db.json` to Redis |

On Vercel the site is on the internet, so anyone with the link can sign up
as a Fleet Commander (they only see their own vehicles). Keep an eye on the
Accounts page.

## Where things live

| To change... | Edit |
| --- | --- |
| Lists (fields, levels, statuses, types) | `shared/config.js` |
| Sidebar menu, routes, who can open which page | `src/navigation.js` |
| Which pages are real vs "not built yet" | `pages` in `src/App.jsx` |
| The API (accounts, vehicles, rules) | `server/api.js` |
| Production server | `server/index.js` |
| The three Pages screens | `src/scenes/serviceable`, `maintenance`, `blocked` |
| The type / MID picker they share | `src/components/VehicleWorkspace.jsx` |

## Security notes

This is built for a trusted internal network: passwords are hashed, sessions
expire after 12 hours, repeated wrong passwords are slowed down, and the
server checks who may see and change each vehicle. It does **not** use HTTPS,
so don't expose it to the internet. Anyone who can reach the page can create a
Fleet Commander account. They only see the vehicles they add themselves, and
an administrator can delete accounts.
