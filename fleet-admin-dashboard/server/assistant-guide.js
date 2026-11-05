// What the assistant knows about the app: every page and how to use it.
// Keep this in step with the app when you add or change a page - the
// assistant only knows what is written here (plus the live data it looks up).
import { DEPLOY_LABELS, DEPLOYED_FIELDS, SCHEDULE_KINDS } from "../shared/config.js";

export const HELP_GUIDE = `
# Fleet Admin Dashboard - user guide

## Accounts and roles
- Admin: sees every vehicle and every page, imports the Excel files, manages accounts and criteria.
- Fleet Commander: sees and edits only the vehicles of their own worksheet(s).
- Sign up: the first account ever created becomes the Admin; everyone after is a Fleet Commander.
- Menu at the top right (person icon): My account (change display name / username), Change password,
  My worksheet (claim your sheet), Log out.
- On a phone, the sidebar is hidden: tap the ☰ button at the top left to open the menu.

## Vehicle status (how AVAILABLE / NOT AVAILABLE is worked out - same as the Excel criteria)
- ${DEPLOY_LABELS.yes}: nothing stops the vehicle.
- ${DEPLOY_LABELS.deployed}: out on a counted ${DEPLOYED_FIELDS.join(", ")} field (or a tasking booking). The vehicle is fine, just in use.
- ${DEPLOY_LABELS.no}: any other reason - VOR STATUS contains X, STANDBY has text, a maintenance item is N,
  or a servicing / maintenance booking is on today.
- Blocked fields (free text: TASKING, SELF DRIVE, TLOAN, OVERSEAS, STANDBY, VOR STATUS, plus any added as Blocked):
  any text blocks the vehicle; VOR STATUS only blocks when it contains an X.
- Maintenance items (Y / N: AVI SLIP, VC STICKER, MLC, P-PLATE, TYRES, AIRCON, IVC...): only N blocks; Y and blank pass.
- Disregards: a criteria can be IGNORED for a whole vehicle type (Manage Disregards page), e.g. VAMTAC (CEREMONY)
  ignores P-PLATE and CANOPY. A blocked field can also be ignored for ONE vehicle (switch on Edit Blocked Vehicles).

## Pages (sidebar)
### Manage Vehicles (everyone)
- Summary boxes (AVAILABLE, DEPLOYED, UNAVAILABLE, blocked, items N) and the full vehicle table.
- Filters: MID, type, status, Reason (e.g. "AIRCON (N)", "TASKING: DETAIL"), commander.
- Add a vehicle: "+ Add vehicle" -> MID, type, remarks (Admin can choose who manages it) -> Save.
- Edit: pencil icon on a row (MID, type, remarks). Delete: bin icon, or tick rows -> Delete selected.
- Click a vehicle row to open its details: status and why, blocked fields (who set them, when),
  maintenance items, bookings, remarks, with buttons to edit each part or book it.
- Admin only: tick vehicles -> "Assign to" an account; "Import from Excel"; everyone: "Export to Excel".
- "View: Calendar" switches the table to the booking calendar (see Calendar).

### Calendar (Manage Vehicles -> View: Calendar)
- Book: drag across days, or "+ Booking", or New booking in a day's panel -> kind, title, dates, optional times,
  vehicles, notes -> Create. Kinds: ${SCHEDULE_KINDS.map((k) => k.label).join(", ")}.
- While a booking is on (start to end date, whole days) its vehicles change status automatically:
  Tasking -> DEPLOYED (shown as TASKING / SELF DRIVE / TLOAN / OVERSEAS), Servicing / Maintenance -> UNAVAILABLE,
  Other / reminder -> no change. They go back by themselves when it ends.
- Click a booking to edit or delete it; drag it to move it (phones: press and hold, then drag).
- Click a day to see how many vehicles are AVAILABLE / DEPLOYED / UNAVAILABLE that day and why.
- Dashed bars = statuses set on vehicles with no booking; "Put on the calendar" turns one into a dated booking.

### Serviceable Vehicle (everyone)
- Read-only availability overview with filters (MID, status, reason, type, blocked). Click a vehicle to see why.

### Tasking (everyone)
- Vehicles on tasking grouped by the TASKING value (count, types, MIDs), plus a "Not available because" table.

### Edit Maintenance Level (everyone)
- Pick a vehicle type and MID (search box), tick items (AVI SLIP, MLC, TYRES...), choose Y or N, add a remark,
  Apply. Clear one item or all. Items ignored for the vehicle's type are marked.

### Edit Blocked Vehicles (everyone)
- Pick a vehicle, tick fields (TASKING, OVERSEAS, VOR STATUS...), pick a value from the drop-down
  (or "Other..." to type one), Apply. Clear a field to unblock it.
- Each field has a switch to count / ignore it for THIS vehicle only.

### Fleet Commander Dashboard (everyone)
- Your own fleet: available / deployed / on tasking / unavailable totals, readiness %, tasking groups,
  per-type table, not available (and why), blocked fields, items N.

### Manage Disregards (everyone)
- Pick a vehicle type, tick the criteria to IGNORE for that type, Save. Shows who changed it last.
  Applies to every vehicle of that type.

### Manage Criteria (Admin)
- The list of criteria (like the workbook's CriteriaConfig sheet): each column is Maintenance (Y/N),
  Blocked vehicle (free text) or Not a criteria. Reclassify with the drop-down, remove, add, or reset to defaults.

### NC Dashboard (Admin)
- The commander dashboard for the whole fleet; switch to any commander or Unassigned.

### Accounts (Admin)
- Add, edit, reset password, change role, link worksheets, delete (and move their vehicles). Deleted accounts can be restored.

## Importing Excel (Admin): Manage Vehicles -> Import from Excel
One import does everything the Excel macros used to do - no need to import into the macro workbook first.
1. Choose files: select the commanders' own Excel files (several at once) or one whole workbook.
   A commander's own file is named after the file, like the macro's Import File.
2. Check files: every sheet gets the macro's File Check (SOP) report - MID column, Vehicle Type column,
   duplicate MIDs, rows missing MID or type, unrecognized columns. Click the result chip for the full report.
   Column titles are standardised automatically ("Veh No. (MID)" = MID, "Type of Vehicle" = VEHICLE TYPE,
   "WHEEL -CHOKE" = WHEEL-CHOKE, small typos allowed). Choose which account gets each sheet; rename a sheet if needed;
   "Change" fixes the columns by hand.
3. Scan criteria: new columns are listed; tick them and choose Add as Maintenance, Add as Blocked,
   Not a criteria, or Skip for now. Saved for every future import.
4. Review & import: see how many are new / different / the same, vehicles no longer in the files
   (tick to delete), what to do with MIDs already in the app (Update is recommended), then Import.
   An import can be undone straight afterwards ("Undo this import").
- Report sheets the macros made (Dashboard, MID Details, Fleet Dashboard, BlockedVehicles) are not imported by default.
- If the workbook has CriteriaConfig / DisregardConfig sheets, their classifications and disregard rules can be used.

## Worksheets (Fleet Commanders)
- Menu at the top right -> My worksheet -> pick your sheet -> "This sheet is mine". Its Unassigned vehicles move
  to you, and future imports send that sheet to you. If your name is in a shared sheet name you can share it.

## Exporting
- Manage Vehicles -> Export to Excel downloads the vehicles you can see.

## This assistant (robot button, bottom right)
- Answers how-to questions, looks up live fleet data, and can prepare changes (set a blocked field, set a Y/N item,
  edit remarks/type, add a vehicle, make a booking). Every change is shown as a card and is only saved when
  the user presses Confirm. It cannot delete vehicles or change accounts.
- Things to type: "how many vehicles are unavailable?", "which 6 TON GS are down?", "why is 21714 unavailable?",
  "set 21714 aircon N", "put 21717 on tasking XCA", "clear VOR on 21718", "book 21714 for tasking XCA tomorrow",
  "book 21714 servicing 12/11 to 14/11".
`;
