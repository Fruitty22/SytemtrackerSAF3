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
import { BLOCK_FIELDS, MAINTENANCE_FIELDS, MAINTENANCE_LEVELS } from "./config.js";

const isProblemLevel = (level) =>
  MAINTENANCE_LEVELS.some((l) => l.value === level && l.problem);

// Does this value in a blocked-style field take the vehicle out?
export function blocksVehicle(field, value) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (!field.blockValues) return true;
  return field.blockValues.some((b) => b.toUpperCase() === text.toUpperCase());
}

// Returns { ava, reasons, blockRows, itemRows }
//   reasons:  [{ field, value, kind: "block" | "maintenance" }] - why it's NOT AVA
//   *Rows:    every field with its value, whether it's counted, and whether it blocks
export function deployability(vehicle, disregards = {}) {
  const byType = new Set(disregards[vehicle.type] ?? []);
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

  const reasons = [
    ...blockRows.filter((r) => r.blocks).map((r) => ({ ...r, kind: "block" })),
    ...itemRows.filter((r) => r.blocks).map((r) => ({ ...r, kind: "maintenance" })),
  ];
  return { ava: reasons.length === 0, reasons, blockRows, itemRows };
}

// Any blocked-style field filled in (counted or not) - "is it on the blocked list?"
export const hasBlockRecord = (vehicle) =>
  Object.values(vehicle.blocks ?? {}).some((entry) => String(entry?.value ?? "").trim());
