import { MAINTENANCE_LEVELS, UNASSIGNED } from "../../shared/config.js";

export const levelInfo = (value) =>
  MAINTENANCE_LEVELS.find((l) => l.value === value) ?? { value, color: "default", problem: false };

// number of maintenance items marked N (any "problem" level)
export const issueCount = (vehicle) =>
  Object.values(vehicle.maintenance ?? {}).filter((entry) => levelInfo(entry.level).problem).length;

export const recordCount = (vehicle) => Object.keys(vehicle.maintenance ?? {}).length;

// Is this vehicle managed by this account? ("UNASSIGNED" = managed by nobody)
export const managedBy = (vehicle, accountId) =>
  accountId === UNASSIGNED
    ? !vehicle.managerIds?.length
    : (vehicle.managerIds ?? [vehicle.ownerId]).includes(accountId);

// MIDs sort as numbers when they are numbers (21714 before 100000)
export const byMid = (a, b) => a.mid.localeCompare(b.mid, undefined, { numeric: true });

export const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-SG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

// Turn an Excel cell into a maintenance value: "Y", "N" or "" (blank / unknown)
export function normalizeLevel(raw) {
  const value = String(raw ?? "").trim().toUpperCase();
  if (["Y", "YES"].includes(value)) return "Y";
  if (["N", "NO"].includes(value)) return "N";
  return MAINTENANCE_LEVELS.some((l) => l.value === value) ? value : "";
}
