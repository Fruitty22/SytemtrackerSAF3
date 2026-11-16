import { useMemo } from "react";
import { Box, Button, ListSubheader, MenuItem, TextField } from "@mui/material";
import { useVehicles } from "../data/VehiclesContext";
import { DEPLOY_LABELS } from "../../shared/config.js";
import { hasBlockRecord } from "../../shared/deployability.js";

export const EMPTY_FILTERS = { mid: "", type: "ALL", availability: "ALL", blocked: "ALL", reason: "ALL" };

// A reason filter key:
//   "M|AIRCON"          maintenance item AIRCON is N
//   "B|TASKING|*"       any TASKING
//   "B|TASKING|DETAIL"  TASKING is DETAIL
const matchesReason = (reasons, key) => {
  const [kind, field, value] = key.split("|");
  return reasons.some((r) =>
    kind === "M"
      ? r.kind === "maintenance" && r.field === field
      : r.kind === "block" && r.field === field && (value === "*" || r.value === value)
  );
};

// Apply the filter bar to a list of vehicles
export function filterVehicles(vehicles, filters, deployOf) {
  const mid = filters.mid.trim().toUpperCase();
  return vehicles.filter((v) => {
    if (mid && !v.mid.includes(mid)) return false;
    if (filters.type !== "ALL" && v.type !== filters.type) return false;
    const result = deployOf(v);
    if (filters.availability === "NOT" && result.ava) return false;
    if (!["ALL", "NOT"].includes(filters.availability) && result.status !== filters.availability) return false;
    if (filters.blocked !== "ALL" && hasBlockRecord(v) !== (filters.blocked === "YES")) return false;
    if ((filters.reason ?? "ALL") !== "ALL" && !matchesReason(result.reasons, filters.reason)) return false;
    return true;
  });
}

// Filters: MID number, availability, vehicle type, blocked, and the reason a
// vehicle isn't available (e.g. "TASKING: DETAIL", "AIRCON (N)")
const VehicleFilters = ({ vehicles, value, onChange }) => {
  const { deployOf } = useVehicles();
  const types = useMemo(
    () => [...new Set(vehicles.map((v) => v.type))].sort((a, b) => a.localeCompare(b)),
    [vehicles]
  );

  // every reason that actually occurs, with how many vehicles have it
  const reasonOptions = useMemo(() => {
    const block = new Map(); // field -> Map(value -> count)
    const items = new Map(); // field -> count
    for (const v of vehicles) {
      for (const r of deployOf(v).reasons) {
        if (r.kind === "maintenance") items.set(r.field, (items.get(r.field) ?? 0) + 1);
        else {
          const values = block.get(r.field) ?? new Map();
          values.set(r.value, (values.get(r.value) ?? 0) + 1);
          block.set(r.field, values);
        }
      }
    }
    const blockGroups = [...block.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([field, values]) => ({
        field,
        total: [...values.values()].reduce((a, b) => a + b, 0),
        values: [...values.entries()].sort((a, b) => b[1] - a[1]),
      }));
    const itemList = [...items.entries()].sort((a, b) => b[1] - a[1]);
    return { blockGroups, itemList };
  }, [vehicles, deployOf]);

  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  const active = Object.entries(EMPTY_FILTERS).some(([k, v]) => (value[k] ?? v) !== v);

  const reasonMenu = [<MenuItem key="ALL" value="ALL">Any reason</MenuItem>];
  for (const g of reasonOptions.blockGroups) {
    reasonMenu.push(<ListSubheader key={`h-${g.field}`}>{g.field}</ListSubheader>);
    reasonMenu.push(
      <MenuItem key={`B|${g.field}|*`} value={`B|${g.field}|*`}>
        Any {g.field} ({g.total})
      </MenuItem>
    );
    for (const [v, n] of g.values) {
      reasonMenu.push(
        <MenuItem key={`B|${g.field}|${v}`} value={`B|${g.field}|${v}`} sx={{ pl: 4 }}>
          {g.field}: {v} ({n})
        </MenuItem>
      );
    }
  }
  if (reasonOptions.itemList.length) {
    reasonMenu.push(<ListSubheader key="h-items">Maintenance items (N)</ListSubheader>);
    for (const [field, n] of reasonOptions.itemList) {
      reasonMenu.push(
        <MenuItem key={`M|${field}`} value={`M|${field}`} sx={{ pl: 4 }}>
          {field} ({n})
        </MenuItem>
      );
    }
  }

  // keep the selected reason valid even if it no longer occurs
  const reasonValue = reasonMenu.some((m) => m.props.value === value.reason) ? value.reason ?? "ALL" : "ALL";

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          sm: "repeat(3, minmax(0, 1fr))",
          lg: "repeat(5, minmax(0, 1fr)) auto",
        },
        gap: "12px",
        alignItems: "center",
      }}
    >
      <TextField size="small" label="MID number" placeholder="e.g. 21714" value={value.mid} onChange={set("mid")} />
      <TextField select size="small" label="Availability" value={value.availability} onChange={set("availability")}>
        <MenuItem value="ALL">All</MenuItem>
        <MenuItem value="available">{DEPLOY_LABELS.yes}</MenuItem>
        <MenuItem value="deployed">{DEPLOY_LABELS.deployed}</MenuItem>
        <MenuItem value="unavailable">{DEPLOY_LABELS.no}</MenuItem>
        <MenuItem value="NOT">
          Not available ({DEPLOY_LABELS.deployed} + {DEPLOY_LABELS.no})
        </MenuItem>
      </TextField>
      <TextField select size="small" label="Reason" value={reasonValue} onChange={set("reason")}>
        {reasonMenu}
      </TextField>
      <TextField select size="small" label="Vehicle type" value={value.type} onChange={set("type")}>
        <MenuItem value="ALL">All types</MenuItem>
        {types.map((t) => (
          <MenuItem key={t} value={t}>
            {t}
          </MenuItem>
        ))}
      </TextField>
      <TextField select size="small" label="Blocked" value={value.blocked} onChange={set("blocked")}>
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
