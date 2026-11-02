import { useMemo } from "react";
import { Box, Button, MenuItem, TextField } from "@mui/material";
import { DEPLOY_LABELS } from "../../shared/config.js";
import { hasBlockRecord } from "../../shared/deployability.js";

export const EMPTY_FILTERS = { mid: "", type: "ALL", availability: "ALL", blocked: "ALL" };

// Apply the filter bar to a list of vehicles
export function filterVehicles(vehicles, filters, deployOf) {
  const mid = filters.mid.trim().toUpperCase();
  return vehicles.filter((v) => {
    if (mid && !v.mid.includes(mid)) return false;
    if (filters.type !== "ALL" && v.type !== filters.type) return false;
    if (filters.availability !== "ALL" && deployOf(v).ava !== (filters.availability === "AVA")) return false;
    if (filters.blocked !== "ALL" && hasBlockRecord(v) !== (filters.blocked === "YES")) return false;
    return true;
  });
}

// Simple filters: MID number, vehicle type, AVA / NOT AVA, blocked yes / no
const VehicleFilters = ({ vehicles, value, onChange }) => {
  const types = useMemo(
    () => [...new Set(vehicles.map((v) => v.type))].sort((a, b) => a.localeCompare(b)),
    [vehicles]
  );
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  const active =
    value.mid || value.type !== "ALL" || value.availability !== "ALL" || value.blocked !== "ALL";

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
      <TextField
        size="small"
        label="MID number"
        placeholder="e.g. 21714"
        value={value.mid}
        onChange={set("mid")}
        sx={{ width: 170 }}
      />
      <TextField select size="small" label="Availability" value={value.availability} onChange={set("availability")} sx={{ minWidth: 150 }}>
        <MenuItem value="ALL">All</MenuItem>
        <MenuItem value="AVA">{DEPLOY_LABELS.yes}</MenuItem>
        <MenuItem value="NOT">{DEPLOY_LABELS.no}</MenuItem>
      </TextField>
      <TextField select size="small" label="Vehicle type" value={value.type} onChange={set("type")} sx={{ minWidth: 200 }}>
        <MenuItem value="ALL">All types</MenuItem>
        {types.map((t) => (
          <MenuItem key={t} value={t}>
            {t}
          </MenuItem>
        ))}
      </TextField>
      <TextField select size="small" label="Blocked" value={value.blocked} onChange={set("blocked")} sx={{ minWidth: 130 }}>
        <MenuItem value="ALL">All</MenuItem>
        <MenuItem value="YES">Blocked</MenuItem>
        <MenuItem value="NO">Not blocked</MenuItem>
      </TextField>
      {active && (
        <Button size="small" color="inherit" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      )}
    </Box>
  );
};

export default VehicleFilters;
