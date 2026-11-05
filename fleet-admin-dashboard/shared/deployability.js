// Is a vehicle deployable (AVA)? The same logic as the Excel criteria:
//
//   ANY BLOCKED   = any counted blocked-style field has text
//                   (VOR STATUS only counts when it is X)
//   ANY ITEM = N  = any counted maintenance item is N   (Y and blank pass)
//   AVA           = NOT (ANY BLOCKED OR ANY ITEM = N)    -> a NOR gate
//
// "Counted" means the field is not ignored:
//   - not disregarded for this vehicle's TYPE (Manage Disregards page), and
//   - for blocked-style fields, not ignored for THIS vehicle only
//     (vehicle.ignoredBlocks, set on Edit Blocked Vehicles)
import {
  BLOCK_FIELDS,
  DEPLOY_LABELS,
  DEPLOYED_FIELDS,
  MAINTENANCE_FIELDS,
  MAINTENANCE_LEVELS,
} from "./config.js";
import { eventField, kindOf } from "./schedule.js";
import { normalizeTitle } from "./titles.js";

const isProblemLevel = (level) =>
  MAINTENANCE_LEVELS.some((l) => l.value === level && l.problem);

// Does this value in a blocked-style field take the vehicle out?
export function blocksVehicle(field, value) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (!field.blockValues) return true;
  // like the macro: VOR STATUS blocks when the value CONTAINS an X ("X", "X 22/9")
  return field.blockValues.some((b) => text.toUpperCase().includes(b.toUpperCase()));
}

// Disregards for a type. Types that differ only in spaces, case or punctuation
// are the same type ("VAMTAC  (CEREMONY)" = "VAMTAC (CEREMONY)"), as in the macro.
export function disregardsFor(disregards, type) {
  if (disregards?.[type]) return disregards[type];
  const key = normalizeTitle(type);
  if (!key) return [];
  const match = Object.keys(disregards ?? {}).find((t) => normalizeTitle(t) === key);
  return match ? disregards[match] : [];
}

// Returns { ava, status, tasking, reasons, blockRows, itemRows, scheduleRows }
//   reasons:  [{ field, value, kind: "block" | "maintenance", scheduled? }] - why it's NOT AVA
//   *Rows:    every field with its value, whether it's counted, and whether it blocks
//
// `scheduled` = calendar bookings that are on TODAY for this vehicle (see
// shared/schedule.js). A tasking booking counts like TASKING (so it can be
// ignored the same way); servicing / maintenance bookings always count.
export function deployability(vehicle, disregards = {}, scheduled = []) {
  const byType = new Set(disregardsFor(disregards, vehicle.type));
  const byVehicle = new Set(vehicle.ignoredBlocks ?? []);

  // ignoredBy: "type" | "vehicle" | null
  const blockRows = BLOCK_FIELDS.map((field) => {
    const value = String(vehicle.blocks?.[field.name]?.value ?? "").trim();
    const ignoredBy = byVehicle.has(field.name) ? "vehicle" : byType.has(field.name) ? "type" : null;
    const counted = !ignoredBy;
    return { field: field.name, value, counted, ignoredBy, blocks: counted && blocksVehicle(field, value) };
  });

  const itemRows = MAINTENANCE_FIELDS.map((field) => {
    const value = vehicle.maintenance?.[field]?.level ?? "";
    const ignoredBy = byType.has(field) ? "type" : null;
    const counted = !ignoredBy;
    return { field, value, counted, ignoredBy, blocks: counted && isProblemLevel(value) };
  });

  const scheduleRows = scheduled
    .filter((e) => kindOf(e.kind).effect !== "none")
    .map((e) => {
      const kind = kindOf(e.kind);
      const field = eventField(e);
      const value = String((kind.key === "tasking" ? e.tasking || e.title : e.title) ?? "").trim() || kind.label.toUpperCase();
      const ignoredBy =
        kind.key === "tasking" ? (byVehicle.has(field) ? "vehicle" : byType.has(field) ? "type" : null) : null;
      return { field, value, counted: !ignoredBy, ignoredBy, blocks: !ignoredBy, eventId: e.id, event: e };
    });

  const reasons = [
    ...blockRows.filter((r) => r.blocks).map((r) => ({ ...r, kind: "block" })),
    ...scheduleRows
      .filter((r) => r.blocks)
      .map(({ event, ...r }) => ({ ...r, kind: "block", scheduled: true })),
    ...itemRows.filter((r) => r.blocks).map((r) => ({ ...r, kind: "maintenance" })),
  ];
  const ava = reasons.length === 0;
  // status: "available" | "deployed" (out on TASKING / SELF DRIVE / TLOAN /
  // OVERSEAS - see DEPLOYED_FIELDS) | "unavailable" (any other reason)
  const deployedBy = reasons.filter((r) => r.kind === "block" && DEPLOYED_FIELDS.includes(r.field));
  const status = ava ? "available" : deployedBy.length ? "deployed" : "unavailable";
  // the TASKING value when the vehicle is on a (counted) tasking, else ""
  const tasking = reasons.find((r) => r.kind === "block" && r.field === "TASKING")?.value ?? "";
  return { ava, status, tasking, reasons, blockRows, itemRows, scheduleRows };
}

// label and chip colour for a status
export const STATUS_STYLE = {
  available: { color: "success" },
  deployed: { color: "info" },
  unavailable: { color: "error" },
};

// Any blocked-style field filled in (counted or not) - "is it on the blocked list?"
export const hasBlockRecord = (vehicle) =>
  Object.values(vehicle.blocks ?? {}).some((entry) => String(entry?.value ?? "").trim());

export const statusLabel = (status) =>
  ({ available: DEPLOY_LABELS.yes, deployed: DEPLOY_LABELS.deployed, unavailable: DEPLOY_LABELS.no })[status] ??
  status;

// "TASKING: XCA" / "AIRCON (N)" - one reason as text
export const reasonText = (r) => (r.kind === "maintenance" ? `${r.field} (N)` : `${r.field}: ${r.value}`);
