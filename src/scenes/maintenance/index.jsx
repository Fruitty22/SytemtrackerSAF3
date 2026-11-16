import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import VehicleWorkspace from "../../components/VehicleWorkspace";
import ConfirmDialog from "../../components/ConfirmDialog";
import { IssuesChip, LevelChip } from "../../components/Chips";
import { tokens } from "../../theme";
import { useVehicles } from "../../data/VehiclesContext";
import { formatDateTime, issueCount, recordCount } from "../../utils/vehicle";
import { MAINTENANCE_FIELDS, MAINTENANCE_LEVELS } from "../../../shared/config.js";
import { disregardsFor } from "../../../shared/deployability.js";

// Pick fields (like "Select Fields" in Excel), give them a level, apply.
// Each field's record can also be cleared on its own.
const MaintenanceEditor = ({ vehicle }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { updateVehicle, disregards } = useVehicles();
  const ignored = new Set(disregardsFor(disregards, vehicle.type));
  const records = vehicle.maintenance ?? {};

  const [selected, setSelected] = useState([]);
  const [level, setLevel] = useState(MAINTENANCE_LEVELS[0].value);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const toggle = (field) => {
    const next = selected.includes(field)
      ? selected.filter((f) => f !== field)
      : [...selected, field];
    setSelected(next);
    // picking a single field that already has a record loads it for editing
    if (next.length === 1 && records[next[0]]) {
      setLevel(records[next[0]].level);
      setRemark(records[next[0]].remark ?? "");
    }
  };

  const save = async (maintenance, doneText) => {
    setBusy(true);
    setMessage(null);
    try {
      await updateVehicle(vehicle.id, { maintenance });
      setMessage({ severity: "success", text: doneText });
      return true;
    } catch (err) {
      setMessage({ severity: "error", text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    const changes = Object.fromEntries(selected.map((f) => [f, { level, remark }]));
    const ok = await save(changes, `${selected.length} field(s) set to ${level}.`);
    if (ok) {
      setSelected([]);
      setRemark("");
    }
  };

  const clearOne = (field) => save({ [field]: null }, `${field} record cleared.`);

  const clearAll = async () => {
    const changes = Object.fromEntries(Object.keys(records).map((f) => [f, null]));
    if (!(await save(changes, "All maintenance records cleared."))) {
      throw new Error("Couldn't clear the records.");
    }
  };

  const allSelected = selected.length === MAINTENANCE_FIELDS.length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography>
        {recordCount(vehicle)} of {MAINTENANCE_FIELDS.length} items filled in
        {issueCount(vehicle) > 0 && ` · ${issueCount(vehicle)} marked N`}
        {ignored.size > 0 && " · items marked “ignored” don't count for this vehicle type"}
      </Typography>

      {/* APPLY BAR */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          flexWrap: "wrap",
          alignItems: "center",
          p: 2,
          borderRadius: "4px",
          backgroundColor: "background.default",
        }}
      >
        <TextField
          select
          size="small"
          label="Level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          {MAINTENANCE_LEVELS.map((l) => (
            <MenuItem key={l.value} value={l.value}>
              {l.value}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Remark (optional)"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          sx={{ flex: "1 1 200px" }}
        />
        <Button variant="contained" color="secondary" disabled={busy || selected.length === 0} onClick={apply}>
          Apply to {selected.length || ""} selected
        </Button>
      </Box>

      {message && <Alert severity={message.severity}>{message.text}</Alert>}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Select fields
        </Typography>
        <Box>
          <Button
            size="small"
            color="inherit"
            onClick={() => setSelected(allSelected ? [] : [...MAINTENANCE_FIELDS])}
          >
            {allSelected ? "Unselect all" : "Select all"}
          </Button>
          <Button
            size="small"
            color="error"
            disabled={busy || recordCount(vehicle) === 0}
            onClick={() => setConfirmClearAll(true)}
          >
            Clear all records
          </Button>
        </Box>
      </Box>

      {/* FIELD LIST */}
      <List dense disablePadding sx={{ backgroundColor: "background.default", borderRadius: "4px" }}>
        {MAINTENANCE_FIELDS.map((field) => {
          const record = records[field];
          return (
            <ListItem
              key={field}
              disablePadding
              secondaryAction={
                record && (
                  <Tooltip title={`Clear ${field} record`}>
                    <IconButton edge="end" size="small" disabled={busy} onClick={() => clearOne(field)}>
                      <DeleteOutlineOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )
              }
            >
              <ListItemButton onClick={() => toggle(field)} sx={{ gap: 1.5, pr: 7 }}>
                <Checkbox edge="start" size="small" checked={selected.includes(field)} tabIndex={-1} sx={{ p: 0.5 }} />
                <Box sx={{ minWidth: 170 }}>
                  <Typography sx={{ fontWeight: 700 }}>{field}</Typography>
                  {ignored.has(field) && (
                    <Typography variant="caption" sx={{ color: "warning.main" }}>
                      ignored for {vehicle.type}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ minWidth: 90 }}>
                  {record ? <LevelChip level={record.level} /> : (
                    <Typography variant="body2" sx={{ opacity: 0.5 }}>
                      blank
                    </Typography>
                  )}
                </Box>
                {record && (
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    {record.remark && (
                      <Typography variant="body2" noWrap>
                        {record.remark}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ opacity: 0.6 }} noWrap component="div">
                      {formatDateTime(record.updatedAt)} · {record.updatedBy}
                    </Typography>
                  </Box>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <ConfirmDialog
        open={confirmClearAll}
        title={`Clear all maintenance records for ${vehicle.mid}?`}
        message="Every item goes back to blank."
        confirmLabel="Clear all"
        onConfirm={clearAll}
        onClose={() => setConfirmClearAll(false)}
      />
    </Box>
  );
};

const filters = [
  { value: "ALL", label: "All vehicles", test: () => true },
  { value: "ISSUES", label: "With items N", test: (v) => issueCount(v) > 0 },
  { value: "OK", label: "No items N", test: (v) => recordCount(v) > 0 && issueCount(v) === 0 },
  { value: "NONE", label: "Nothing filled in yet", test: (v) => recordCount(v) === 0 },
];

const Maintenance = () => (
  <VehicleWorkspace
    title="EDIT MAINTENANCE LEVEL"
    subtitle="Y / N for each item. Only N (on a counted item) makes a vehicle NOT AVA"
    filters={filters}
    renderBadge={(v) => <IssuesChip vehicle={v} />}
    renderDetail={(v) => <MaintenanceEditor vehicle={v} />}
  />
);

export default Maintenance;
