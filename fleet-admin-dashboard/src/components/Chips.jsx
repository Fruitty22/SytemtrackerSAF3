import { memo } from "react";
import { Box, Chip } from "@mui/material";

// Hover text uses the plain HTML title, not MUI's <Tooltip>: these chips appear
// hundreds of times on a page and a Tooltip each made pages slow to open on phones.
import { issueCount, levelInfo } from "../utils/vehicle";
import { useVehicles } from "../data/VehiclesContext";
import { DEPLOYED_FIELDS } from "../../shared/config.js";
import { hasBlockRecord, reasonText, statusLabel, STATUS_STYLE } from "../../shared/deployability.js";

// AVAILABLE / DEPLOYED / UNAVAILABLE, worked out from the blocked fields and
// maintenance items. Hover to see why it's not available.
export const DeployChip = memo(({ vehicle, ...props }) => {
  const { deployOf } = useVehicles();
  const { status, reasons } = deployOf(vehicle);
  return (
    <Chip
      size="small"
      label={statusLabel(status)}
      color={STATUS_STYLE[status].color}
      title={status === "available" ? undefined : `Because ${reasons.map(reasonText).join(", ")}`}
      {...props}
    />
  );
});

export const LevelChip = ({ level, ...props }) => (
  <Chip size="small" label={level} color={levelInfo(level).color} {...props} />
);

// Shown when any blocked-style field (TASKING, OVERSEAS...) has a value
export const BlockedChip = memo(({ vehicle, ...props }) => {
  if (vehicle && !hasBlockRecord(vehicle)) return null;
  const fields = vehicle
    ? Object.entries(vehicle.blocks ?? {})
        .filter(([, e]) => String(e?.value ?? "").trim())
        .map(([f, e]) => `${f}: ${e.value}`)
        .join(", ")
    : "";
  return <Chip size="small" label="BLOCKED" color="error" variant="outlined" title={fields || undefined} {...props} />;
});

// "2 × N" when maintenance items are N, nothing otherwise
export const IssuesChip = ({ vehicle, ...props }) => {
  const issues = issueCount(vehicle);
  if (issues === 0) return null;
  const items = Object.entries(vehicle.maintenance ?? {})
    .filter(([, e]) => levelInfo(e.level).problem)
    .map(([f]) => f)
    .join(", ");
  return <Chip size="small" color="warning" label={`${issues} × N`} title={items} {...props} />;
};

// What makes a vehicle NOT AVA, item by item: "AIRCON", "BII TOOL" (items marked N)
// and "OVERSEAS: EX WALLABY" (blocked fields). Disregarded ones are left out,
// so this always agrees with AVA / NOT AVA.
export const ReasonChips = memo(({ vehicle }) => {
  const { deployOf } = useVehicles();
  const { reasons } = deployOf(vehicle);
  if (reasons.length === 0) return null;
  return (
    <Box
      title={reasons.map(reasonText).join(", ")}
      sx={{ display: "flex", gap: 0.5, overflow: "hidden", alignItems: "center" }}
    >
      {reasons.map((r) => {
        const deployed = r.kind === "block" && DEPLOYED_FIELDS.includes(r.field);
        return (
          <Chip
            key={`${r.field}|${r.value}`}
            size="small"
            color={r.kind === "maintenance" ? "warning" : deployed ? "info" : "error"}
            variant={r.kind === "maintenance" ? "filled" : "outlined"}
            label={r.kind === "maintenance" ? r.field : reasonText(r)}
          />
        );
      })}
    </Box>
  );
});