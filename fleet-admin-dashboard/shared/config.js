// ---------------------------------------------------------------------------
// FLEET SETTINGS - edit these lists to match your workbook.
//
// Both the server and the app read this file, so a change here applies
// everywhere. Restart `npm run dev` after editing it.
// ---------------------------------------------------------------------------

// Account roles. The very first account that signs up becomes "admin".
export const ROLES = {
  admin: "Admin", // sees every vehicle and every page, incl. NC Dashboard
  commander: "Fleet Commander", // sees the vehicles of their own sheet(s)
};

// Vehicles nobody manages yet (e.g. a commander sheet nobody has claimed).
// Only Admins see them.
export const UNASSIGNED = "UNASSIGNED";

// What each vehicle status is called (see shared/deployability.js):
//   yes      = available (nothing stops it)
//   deployed = not available because it's out on a DEPLOYED_FIELDS field (e.g. TASKING)
//   no       = not available for any other reason (VOR, standby, maintenance item N)
export const DEPLOY_LABELS = { yes: "AVAILABLE", deployed: "DEPLOYED", no: "UNAVAILABLE" };

// Blocked-style fields that mean the vehicle is OUT ON A JOB (deployed) rather
// than broken or held back. A vehicle with a value in one of these is DEPLOYED.
// Add "STANDBY" here if standby should count as deployed.
export const DEPLOYED_FIELDS = ["TASKING", "SELF DRIVE", "TLOAN", "OVERSEAS"];

// Kinds of booking on the calendar (Manage Vehicles -> View: Calendar).
// While a booking is on (from its start date to its end date, whole days),
// its vehicles automatically get:
//   effect "deployed"    -> DEPLOYED, as if TASKING (or the field chosen on the
//                           booking: SELF DRIVE, TLOAN, OVERSEAS) had the booking's value
//   effect "unavailable" -> UNAVAILABLE, with the reason "<field>: <title>"
//   effect "none"        -> shown on the calendar only, status unchanged
// When the booking ends the vehicle goes back to normal by itself.
export const SCHEDULE_KINDS = [
  { key: "tasking", label: "Tasking / deployment", effect: "deployed", field: "TASKING", color: "#2196f3" },
  { key: "servicing", label: "Servicing", effect: "unavailable", field: "SERVICING", color: "#ab47bc" },
  { key: "maintenance", label: "Maintenance", effect: "unavailable", field: "MAINTENANCE", color: "#ff9800" },
  { key: "other", label: "Other / reminder", effect: "none", field: "", color: "#78909c" },
];

// Suggested vehicle types (you can still type any other type).
export const DEFAULT_VEHICLE_TYPES = [
  "6 TON GS",
  "VAMTAC CREW",
  "VAMTAC FAM SYSTEM",
  "VAMTAC (CEREMONY)",
  "VAMTAC FAM STORE",
  "12 TON CRANE",
  "AGILIS AUTO (LUV)",
  "FORD EVEREST (OUV)",
];

// "Select Fields" on Edit Blocked Vehicles. Any text in one of these takes the
// vehicle out (NOT AVA), except fields with `blockValues`: only a value that
// contains one of those blocks (VOR STATUS only blocks with an X, like the macro).
//
// These two lists are only the STARTING criteria. Like the workbook's
// CriteriaConfig sheet, the real list lives in the database: new columns found
// when importing are classified as Maintenance / Blocked on the import screen
// (or on the Criteria page), and the app adds them to these lists while it runs
// (see shared/criteria.js).
// `options` are the choices in the drop-down; values already used in the fleet
// are added to the list automatically, and "Other..." lets you type a new one.
export const BLOCK_FIELDS = [
  { name: "TASKING", options: [] },
  { name: "SELF DRIVE", options: [] },
  { name: "TLOAN", options: [] },
  { name: "OVERSEAS", options: [] },
  { name: "STANDBY", options: [] },
  { name: "VOR STATUS", options: ["X"], blockValues: ["X"] },
];

// "Select Fields" on Edit Maintenance Level (Y / N items).
// Check the end of this list against your workbook.
export const MAINTENANCE_FIELDS = [
  "AVI SLIP",
  "VC STICKER",
  "MLC",
  "P-PLATE",
  "WHEEL-CHOKE",
  "KEY/FUEL TAG",
  "CLEANINESS",
  "CANOPY",
  "CUSHION COVER",
  "SEATS CONDITION",
  "TYRES",
  "SAFETY BELTS / STRAP",
  "FE",
  "BII TOOL",
  "AIRCON",
  "IVC",
  "IVC 2",
];

// The value each maintenance item can have. Only a `problem` value (N) makes
// the vehicle NOT AVA; Y and blank pass.
// color: success | warning | error | info | default
export const MAINTENANCE_LEVELS = [
  { value: "Y", color: "success", problem: false },
  { value: "N", color: "error", problem: true },
];

// Starting "disregards": fields that are ignored (not counted) for a vehicle
// type. Anyone can change them on the Manage Disregards page. A type listed
// here is added when the server starts, unless that type has already been set
// on the page (then the page's setting wins).
export const DEFAULT_DISREGARDS = {
  "VAMTAC (CEREMONY)": ["P-PLATE", "CANOPY", "CUSHION COVER"],
  "10 TON TOWER (B4)": ["P-PLATE", "CUSHION COVER", "FE", "IVC 2"],
};

// Worksheets that list the WHOLE fleet (not one commander's vehicles).
// On import their vehicles stay Unassigned and fill in missing types/records;
// every other sheet with MIDs is treated as a commander's sheet they can claim.
export const GENERAL_SHEETS = [
  "Dashboard",
  "MID Details",
  "Sheet1",
  "BlockedVehicles",
  "Fleet Dashboard",
];
