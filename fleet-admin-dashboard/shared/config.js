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

// What the deployability result is called (see shared/deployability.js)
export const DEPLOY_LABELS = { yes: "AVA", no: "NOT AVA" };

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
// vehicle out (NOT AVA), except fields with `blockValues`: only those values
// block (VOR STATUS only blocks with an X).
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
