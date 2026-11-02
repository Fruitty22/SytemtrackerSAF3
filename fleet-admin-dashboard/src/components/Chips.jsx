import { Box, Chip, Tooltip } from "@mui/material";
import { issueCount, levelInfo } from "../utils/vehicle";
import { useVehicles } from "../data/VehiclesContext";
import { DEPLOY_LABELS } from "../../shared/config.js";
import { hasBlockRecord } from "../../shared/deployability.js";

// AVA / NOT AVA, worked out from the blocked fields and maintenance items.
// Hover to see why it's NOT AVA.
export const DeployChip = ({ vehicle, ...props }) => {
  const { deployOf } = useVehicles();
  const { ava, reasons } = deployOf(vehicle);
  const chip = (
    <Chip
      size="small"
      label={ava ? DEPLOY_LABELS.yes : DEPLOY_LABELS.no}
      color={ava ? "success" : "error"}
      {...props}
    />
  );
  if (ava) return chip;
  return (
    <Tooltip title={`Because ${reasons.map((r) => `${r.field}: ${r.value}`).join(", ")}`}>
      {chip}
    </Tooltip>
  );
};

export const LevelChip = ({ level, ...props }) => (
  <Chip size="small" label={level} color={levelInfo(level).color} {...props} />
);

// Shown when any blocked-style field (TASKING, OVERSEAS...) has a value
export const BlockedChip = ({ vehicle, ...props }) => {
  if (vehicle && !hasBlockRecord(vehicle)) return null;
  const fields = vehicle
    ? Object.entries(vehicle.blocks ?? {})
        .filter(([, e]) => String(e?.value ?? "").trim())
        .map(([f, e]) => `${f}: ${e.value}`)
        .join(", ")
    : "";
  const chip = <Chip size="small" label="BLOCKED" color="error" variant="outlined" {...props} />;
  return fields ? <Tooltip title={fields}>{chip}</Tooltip> : chip;
};

// "2 × N" when maintenance items are N, nothing otherwise
export const IssuesChip = ({ vehicle, ...props }) => {
  const issues = issueCount(vehicle);
  if (issues === 0) return null;
  const items = Object.entries(vehicle.maintenance ?? {})
    .filter(([, e]) => levelInfo(e.level).problem)
    .map(([f]) => f)
    .join(", ");
  return (
    <Tooltip title={items}>
      <Chip size="small" color="warning" label={`${issues} × N`} {...props} />
    </Tooltip>
  );
};

// What makes a vehicle NOT AVA, item by item: "AIRCON", "BII TOOL" (items marked N)
// and "OVERSEAS: EX WALLABY" (blocked fields). Disregarded ones are left out,
// so this always agrees with AVA / NOT AVA.
export const ReasonChips = ({ vehicle }) => {
  const { deployOf } = useVehicles();
  const { reasons } = deployOf(vehicle);
  if (reasons.length === 0) return null;
  const all = reasons
    .map((r) => (r.kind === "maintenance" ? `${r.field} (N)` : `${r.field}: ${r.value}`))
    .join(", ");
  return (
    <Tooltip title={all}>
      <Box sx={{ display: "flex", gap: 0.5, overflow: "hidden", alignItems: "center" }}>
        {reasons.map((r) => (
          <Chip
            key={r.field}
            size="small"
            color={r.kind === "maintenance" ? "warning" : "error"}
            variant={r.kind === "maintenance" ? "filled" : "outlined"}
            label={r.kind === "maintenance" ? r.field : `${r.field}: ${r.value}`}
          />
        ))}
      </Box>
    </Tooltip>
  );
};
