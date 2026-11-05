# Fleet Admin Dashboard

A fleet management web app for fleet commanders. People sign up for their own
account, each Fleet Commander manages their own list of vehicles, and every
change is saved to the database: a free **Supabase** database when it runs on
Vercel, or a JSON file on your own computer.

**Putting it online: see [DEPLOY.md](DEPLOY.md)** (Vercel + Supabase + the AI assistant).

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
| **Manage Vehicles** | Summary counts (AVAILABLE, DEPLOYED, UNAVAILABLE, blocked, items N), the full vehicle table, filters incl. **Reason** (e.g. `AIRCON (N)`, `TASKING: DETAIL`, any TASKING), **Add / Edit / Delete**, tick + **Assign to**, **Import from Excel** (admin), **Export to Excel** |
| **Manage Vehicles → View: Calendar** | Bookings on a calendar (Month / Week / List). Drag across days to book tasking, servicing, maintenance or a reminder for vehicles; click to edit; drag to move. Every day shows how many vehicles are free |
| **Serviceable Vehicle** | Read-only availability overview: filters (MID, status, reason, type, blocked) and a table. Click a vehicle to see why |
| **Tasking** (everyone) | Vehicles on tasking grouped by the TASKING value (count, types, MIDs), and a "Not available because" table of every reason. Admin can pick a commander |
| **Edit Maintenance Level** | Tick items (AVI SLIP, MLC, TYRES...), choose **Y** or **N**, apply. Clear one item or all. Items ignored for the vehicle's type are marked |
| **Edit Blocked Vehicles** | Tick fields, pick a value from the drop-down, apply. Clear to unblock. Each field has a switch to count / ignore it for **this vehicle only** |
| **Fleet Commander Dashboard** (everyone) | Your OWN fleet: available / **deployed** / **on tasking** / unavailable totals, readiness, tasking groups, per-type table, not available (and why), blocked fields, items N |
| **NC Dashboard** (admin) | The same dashboard for the whole fleet; switch to any commander or Unassigned |
| **Accounts** (admin) | Add, edit, reset password, change role, link worksheets, delete (and move their vehicles). Deleted accounts can be restored |
| **Manage Criteria** (admin, under Pages) | Like the workbook's CriteriaConfig sheet: every column that counts, as Maintenance (Y/N), Blocked (free text) or Not a criteria. Reclassify, remove, add, reset |
| **Fleet assistant** (everyone, robot button bottom right) | Free. Ask how to use any page, ask about your vehicles, or ask for a change ("set 21714 aircon N", "book 21714 for tasking XCA tomorrow"). Changes come back as cards and are only saved when you press **Confirm**. Built-in rules by default (nothing leaves the app); add a free `GROQ_API_KEY` for free-form questions (DEPLOY.md step 5) |
| **Manage Disregards** (everyone, under Pages) | Like the Excel "Special Disregards Criterias" form: pick a vehicle type, tick the criteria to **IGNORE**, Save. Shows who changed it last |
| Hide / Unhide Sheets, Next Day (admin) | Still placeholders |

### How AVA / NOT AVA is worked out

The same logic as the Excel criteria (see `shared/deployability.js`):

- **ANY BLOCKED** = a counted blocked field (TASKING, SELF DRIVE, TLOAN, OVERSEAS,
  STANDBY, plus any criteria added as Blocked) has any text, or VOR STATUS contains an `X` (as in the macro)
- **ANY ITEM = N** = a counted maintenance item (including ones added as Maintenance) is `N` (Y and blank pass)
- **AVAILABLE** = NOT (ANY BLOCKED OR ANY ITEM = N).
- Not available splits into two:
  - **DEPLOYED** = out on a counted TASKING, SELF DRIVE, TLOAN or OVERSEAS
    (`DEPLOYED_FIELDS` in `shared/config.js`). The vehicle is fine, just in use.
  - **UNAVAILABLE** = everything else (VOR, STANDBY, a maintenance item N).
- "Counted" = not ignored for that vehicle type on **Manage Disregards**
  (e.g. VAMTAC (CEREMONY) ignores P-PLATE, CANOPY and CUSHION COVER;
  10 TON TOWER (B4) ignores P-PLATE, CUSHION COVER, FE and IVC 2). The same
  counted / ignored switches are on each vehicle's logic view (Serviceable Vehicle).

### Importing (Admin): one import, no Excel macros needed

Manage Vehicles → **Import from Excel**. The website does what the workbook
macros did (Import File, Check File, Scan Criteria), so the commanders' files are
imported **once**, straight from the files they send:

1. **Choose files**: the commanders' own Excel files (select several at once) or one
   whole workbook. A commander's own file is named after the file, like the macro's
   Import File (rename it in the next step if needed).
2. **Check files**: the macro's File Check (SOP) report for every sheet: MID and Vehicle
   Type columns found, duplicate MIDs, rows missing a MID or type, unrecognized columns.
   Column titles are standardised with the macro's matching rules ("Veh No. (MID)" = MID,
   "Type of Vehicle" = VEHICLE TYPE, "WHEEL -CHOKE" = WHEEL-CHOKE, one-letter typos allowed;
   see `shared/titles.js`). Vehicle types that differ only in spaces / case / punctuation
   become one type. Pick which account gets each sheet.
3. **Scan criteria**: every column not classified yet, from all sheets, with the values in
   it and a suggestion. Tick → **Add as Maintenance**, **Add as Blocked**, **Not a criteria**
   (never asked again) or **Skip for now**. Saved straight away (Manage Criteria page).
   If the file is the macro workbook, its CriteriaConfig answers are offered.
4. **Review & import**: new / different / unchanged counts, vehicles that came from these
   sheets but are no longer in the files (tick to delete), what to do with MIDs already in
   the app (Update recommended), the workbook's DisregardConfig rules (if any). **Import**.

A copy of the database is kept before every import: **Undo this import** puts everything
back. The macros' report sheets (Dashboard, MID Details, Fleet Dashboard, BlockedVehicles)
are not imported unless you choose an account for them. Sheets linked to an account (or
whose name contains the account's name, ranks ignored) go to that account; commander
sheets nobody has linked yet stay **Unassigned** until the commander claims them.

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

- `DEPLOY_LABELS` - the words shown for AVAILABLE / DEPLOYED / UNAVAILABLE
- `DEPLOYED_FIELDS` - which blocked fields count as DEPLOYED (add `"STANDBY"` if you want it to)
- `BLOCK_FIELDS` - the blocked fields, their drop-down options, and which values block (VOR STATUS: X)
- `MAINTENANCE_FIELDS` / `MAINTENANCE_LEVELS` - the Y/N items
- `DEFAULT_DISREGARDS` - starting ignored fields per type (then use Manage Disregards)
- `DEFAULT_VEHICLE_TYPES` - suggested vehicle types
- `GENERAL_SHEETS` - sheets that list the whole fleet rather than one commander
- `BLOCK_FIELDS` / `MAINTENANCE_FIELDS` are only the starting criteria: the live list is
  in the database (Manage Criteria page, or the import's Scan criteria step)

## The database

- **Online (Vercel)**: a free Supabase Postgres database. The whole fleet database is one
  JSON document in the table `fleet_store` (`supabase/schema.sql`). Every save checks a
  version number, so two people saving at the same moment never overwrite each other (the
  later one is simply re-run on the new data). Set up: [DEPLOY.md](DEPLOY.md).
- **On your own computer** (no `SUPABASE_URL` set): **`server/data/db.json`**, created on
  the first run. Each time the server starts it copies the file to `db.backup.json`.
  `npm run db:push` copies it into Supabase once when you move online.
- Deleted accounts are kept in the database (with when, by whom, and who took over their
  vehicles). An Admin can restore them from the Accounts page.
- Passwords are stored hashed (scrypt), never as plain text.
- The storage code is `server/store.js`; the API is `server/api.js`, which runs inside
  `npm run dev`, `npm start` and the Vercel function `api/index.js`.

## The calendar (bookings)

Manage Vehicles → **View: Calendar**. The stat boxes and filters stay; the
calendar shows bookings for the vehicles the filters leave.

- **Click a day** (phones: tap) → that day: how many vehicles are AVAILABLE /
  DEPLOYED / UNAVAILABLE, which ones and why (by reason or vehicle by vehicle),
  and its bookings. Future days are "expected": what's set on the vehicles now
  plus that day's bookings. Click any MID for everything about that vehicle.
- **Book:** drag across days, **+ Booking**, or New booking in the day view →
  kind, title, dates, optional times, vehicles, notes → **Create**. A
  Tasking / deployment booking can show as TASKING, SELF DRIVE, TLOAN or OVERSEAS.
- **Dashed bars** = statuses set on the vehicles (Edit Blocked Vehicles / Excel)
  with no booking, e.g. `OVERSEAS: XCS (26/09 - 16/10) · 5`. They run from the
  dates written in the value (or the day the field was set) to today. Click one
  → **Put on the calendar** turns it into a dated booking and clears the field,
  so it ends by itself. Toggle them with the **Set on vehicles** label.
- **Edit / delete:** click a booking. **Move:** drag it to another day
  (phones: press and hold, then drag).
- **Green · blue · red numbers** on each day from today on = available ·
  deployed · unavailable that day.

Clicking a vehicle in the Manage Vehicles table (or any MID in the calendar)
opens its **details**: status and why, blocked fields (who set them, when),
maintenance items, its bookings, remarks, with buttons to edit each part or
book it. The pencil still edits MID / type / remarks.

While a booking is on (start date to end date, whole days), its vehicles
change status automatically everywhere in the app, and go back by themselves
when it ends:

| Kind | Status while it's on | Reason shown |
| --- | --- | --- |
| Tasking | DEPLOYED | `TASKING: <tasking value>` (counts on the Tasking page) |
| Servicing | UNAVAILABLE | `SERVICING: <title>` |
| Maintenance | UNAVAILABLE | `MAINTENANCE: <title>` |
| Other / reminder | no change | - |

The kinds, their colours and effects are `SCHEDULE_KINDS` in `shared/config.js`.
Bookings are saved in `db.json` (`events`). Commanders see and change bookings
for their own vehicles; the Admin sees all. The dialog warns when a vehicle is
already booked on those dates or is UNAVAILABLE now.

## On a phone

Below 900px wide the sidebar is hidden. Tap the **☰** button at the top left
to drop the menu down under the bar; it closes when you pick a page or tap
outside it. Stat boxes go two per row and tables scroll sideways.

Long lists are cut down so pages open quickly: MID chips show **5** at a time
(**+5 more**, **Show all**, **Show less**; on Tasking pick 5 / 10 / 15 / 20 / All),
dashboard tables show 10 rows, and the Edit Maintenance / Edit Blocked vehicle
list shows 50 (search to find others).

Pages are kept alive between tabs (React `<Activity>` in `src/App.jsx`): after
you log in, every page is built in the background while the phone is idle, and
leaving a page only hides it. Switching tabs just shows a page that is already
built, and each page keeps its filters until you log out.

`npm run dev` is the slow developer mode (React checks everything twice). To
see the real speed, run `npm run build` then `npm start` and open the address it
prints on your phone (same Wi-Fi).

## Letting others use it on your network

```bash
npm run build    # builds the app into dist/
npm start        # serves the app + database on port 5000
```

`npm start` prints the address other computers on the same network can open
(for example `http://192.168.1.20:5000`). Windows may ask you to allow Node
through the firewall. Use a different port with `PORT=8080 npm start` on Mac or
Linux, or `$env:PORT=8080; npm start` in PowerShell.

## Where things live

| To change... | Edit |
| --- | --- |
| Lists (fields, levels, statuses, types) | `shared/config.js` |
| Sidebar menu, routes, who can open which page | `src/navigation.js` |
| Which pages are real vs "not built yet" | `pages` in `src/App.jsx` |
| The API (accounts, vehicles, rules) | `server/api.js` |
| Where the database is kept (file / Supabase) | `server/store.js` |
| The assistant: AI services and tools / built-in rules / what it knows about the pages | `server/assistant.js` / `server/assistant-builtin.js` / `server/assistant-guide.js` |
| The chat window | `src/components/assistant/Assistant.jsx` |
| Import: column matching, File Check, Scan Criteria | `shared/titles.js`, `src/utils/workbook.js`, `src/components/ImportDialog.jsx` |
| Criteria list (CriteriaConfig) | `shared/criteria.js`, `src/scenes/criteria` |
| Production server | `server/index.js` |
| The three Pages screens | `src/scenes/serviceable`, `maintenance`, `blocked` |
| Tasking page / tasking groups | `src/scenes/tasking`, `src/components/TaskingViews.jsx` |
| Calendar | `src/components/calendar/` (`FleetCalendar.jsx`, `EventDialog.jsx`), dates logic in `shared/schedule.js` |
| Phone menu | `src/scenes/global/Topbar.jsx` (uses `NavList` from `Sidebar.jsx`) |
| The type / MID picker they share | `src/components/VehicleWorkspace.jsx` |

## Security notes

Passwords are hashed, sessions expire after 12 hours, repeated wrong passwords
are slowed down, and the server checks who may see and change each vehicle.
On Vercel the site is HTTPS. Anyone who can reach the page can create a Fleet
Commander account until you set **`ALLOW_SIGNUP=false`** (then only an Admin
creates accounts). The database key never reaches the browser. The assistant
only sees what the logged-in user may see, never saves without Confirm, and
sends nothing outside the app unless a `GROQ_API_KEY` is set.
`npm start` on your own network does **not** use HTTPS, so don't expose that
one to the internet.
