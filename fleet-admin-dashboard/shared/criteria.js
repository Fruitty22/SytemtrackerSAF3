// The criteria list (the workbook's CriteriaConfig sheet), kept in the database.
//
// Each criteria is { name, category, addedAt?, addedBy? }:
//   BLOCKED      a free-text field (TASKING, STANDBY...) - any text takes the vehicle out
//   MAINTENANCE  a Y / N item (MLC, TYRES...) - N takes the vehicle out
//   IGNORE       a column that is not a criteria (AVI Due Date, Battery...) -
//                never asked about again on import, never counted
//
// applyCriteria() updates BLOCK_FIELDS and MAINTENANCE_FIELDS in shared/config.js
// IN PLACE, so every page and the server use the current list without each of
// them having to load it.
import { BLOCK_FIELDS, MAINTENANCE_FIELDS } from "./config.js";
import { cleanTitle, normalizeTitle } from "./titles.js";

export const CATEGORIES = {
  MAINTENANCE: "Maintenance (Y / N)",
  BLOCKED: "Blocked vehicle (free text)",
  IGNORE: "Not a criteria (ignore)",
};

// the lists as written in config.js, before anything was added
const BASE_BLOCKS = BLOCK_FIELDS.map((f) => ({ ...f }));
const BASE_MAINTENANCE = [...MAINTENANCE_FIELDS];

// what a brand-new database starts with (same as the macro's SeedDefaultCriteria)
export const DEFAULT_CRITERIA = [
  ...BASE_BLOCKS.map((f) => ({ name: f.name, category: "BLOCKED" })),
  ...BASE_MAINTENANCE.map((name) => ({ name, category: "MAINTENANCE" })),
];

export const criteriaKey = normalizeTitle;

export function cleanCriteriaName(value) {
  return cleanTitle(value).slice(0, 40);
}

export function applyCriteria(list) {
  if (!Array.isArray(list) || list.length === 0) return;
  const blocked = list.filter((c) => c.category === "BLOCKED");
  const maintenance = list.filter((c) => c.category === "MAINTENANCE");
  const nextBlocks = blocked.map(
    (c) => BASE_BLOCKS.find((f) => normalizeTitle(f.name) === normalizeTitle(c.name)) ?? { name: c.name, options: [] }
  );
  BLOCK_FIELDS.splice(0, BLOCK_FIELDS.length, ...nextBlocks.map((f) => ({ ...f })));
  MAINTENANCE_FIELDS.splice(0, MAINTENANCE_FIELDS.length, ...maintenance.map((c) => c.name));
}
