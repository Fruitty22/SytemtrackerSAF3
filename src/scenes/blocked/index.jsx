import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  MenuItem,
  TextField,
  Switch,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import VehicleWorkspace from "../../components/VehicleWorkspace";
import ConfirmDialog from "../../components/ConfirmDialog";
import { BlockedChip } from "../../components/Chips";
import { tokens } from "../../theme";
import { useVehicles } from "../../data/VehiclesContext";
import { formatDateTime } from "../../utils/vehicle";
import { BLOCK_FIELDS } from "../../../shared/config.js";
import { blocksVehicle, disregardsFor, hasBlockRecord } from "../../../shared/deployability.js";

const OTHER = "__other__";

// Tick fields (TASKING, OVERSEAS, VOR STATUS...), pick a value, apply.
// Clear a field to unblock it.
const BlockEditor = ({ vehicle }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { vehicles, updateVehicle, disregards } = useVehicles();
  const records = vehicle.blocks ?? {};
  const ignored = new Set(disregardsFor(disregards, vehicle.type));

  const [selected, setSelected] = useState([]);
  const [choice, setChoice] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // drop-down choices: the options in config.js + values already used in the fleet
  const choices = useMemo(() => {
    const fields = selected.length ? selected : BLOCK_FIELDS.map((f) => f.name);
    const values = new Set();
    for (const name of fields) {
      for (const option of BLOCK_FIELDS.find((f) => f.name === name)?.options ?? []) values.add(option);
      for (const v of vehicles) {
        const value = v.blocks?.[name]?.value;
        if (value) values.add(value);
      }
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [selected, vehicles]);

  const value = choice === OTHER ? typed.trim() : choice;

  const toggle = (field) => {
    const next = selected.includes(field) ? selected.filter((f) => f !== field) : [...selected, field];
    setSelected(next);
    // picking one field that has a value loads it for editing
    if (next.length === 1 && records[next[0]]) {
      setChoice(records[next[0]].value);
      setTyped("");
    }
  };

  const save = async (blocks, doneText) => {
    setBusy(true);
    setMessage(null);
    try {
      await updateVehicle(vehicle.id, { blocks });
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
    const changes = Object.fromEntries(selected.map((f) => [f, { value }]));
    if (await save(changes, `${selected.join(", ")} set to "${value}".`)) {
      setSelected([]);
      setChoice("");
      setTyped("");
    }
  };

  const clearOne = (field) => save({ [field]: null }, `${field} cleared.`);

  // count / ignore one blocked field for THIS vehicle only (other vehicles of
  // the same type are not affected)
  const ignoredHere = vehicle.ignoredBlocks ?? [];
  const toggleIgnoreHere = async (field) => {
    const next = ignoredHere.includes(field)
      ? ignoredHere.filter((f) => f !== field)
      : [...ignoredHere, field];
    setBusy(true);
    setMessage(null);
    try {
      await updateVehicle(vehicle.id, { ignoredBlocks: next });
      setMessage({
        severity: "success",
        text: `${field} is now ${next.includes(field) ? "ignored" : "counted"} for ${vehicle.mid} only.`,
      });
    } catch (err) {
      setMessage({ severity: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const clearAll = async () => {
    const changes = Object.fromEntries(Object.keys(records).map((f) => [f, null]));
    if (!(await save(changes, "All blocked fields cleared."))) throw new Error("Couldn't clear them.");
  };

  // VOR STATUS only blocks with X: warn if another value is chosen for it
  const vorNote = selected
    .map((name) => BLOCK_FIELDS.find((f) => f.name === name))
    .filter((f) => f?.blockValues && value && !blocksVehicle(f, value))
    .map((f) => `${f.name} only blocks with ${f.blockValues.join(" / ")}`);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography>
        {hasBlockRecord(vehicle)
          ? "Fields with a value take the vehicle out (NOT AVA). The switch on each row counts or ignores that field for this vehicle only."
          : "No blocked fields set. Tick a field below and choose a value to block this vehicle."}
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
          label="Value"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {choices.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
          <MenuItem value={OTHER}>
            <em>Other&hellip; (type a new value)</em>
          </MenuItem>
        </TextField>
        {choice === OTHER && (
          <TextField
            size="small"
            label="New value"
            placeholder="e.g. EX WALLABY"
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            autoFocus
            sx={{ flex: "1 1 180px" }}
          />
        )}
        <Button
          variant="contained"
          color="error"
          disabled={busy || selected.length === 0 || !value}
          onClick={apply}
        >
          Apply to {selected.length || ""} selected
        </Button>
      </Box>
      {vorNote.length > 0 && <Alert severity="info">{vorNote.join(". ")}.</Alert>}
      {message && <Alert severity={message.severity}>{message.text}</Alert>}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Select fields
        </Typography>
        <Button
          size="small"
          color="error"
          disabled={busy || !hasBlockRecord(vehicle)}
          onClick={() => setConfirmClearAll(true)}
        >
          Clear all (unblock)
        </Button>
      </Box>

      <List dense disablePadding sx={{ backgroundColor: "background.default", borderRadius: "4px" }}>
        {BLOCK_FIELDS.map((field) => {
          const record = records[field.name];
          const typeIgnored = ignored.has(field.name);
          const vehicleIgnored = ignoredHere.includes(field.name);
          const counted = !typeIgnored && !vehicleIgnored;
          const blocking = counted && blocksVehicle(field, record?.value);
          return (
            <ListItem
              key={field.name}
              disablePadding
              secondaryAction={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Tooltip
                    title={
                      typeIgnored
                        ? `Ignored for every ${vehicle.type} (Manage Disregards)`
                        : `Count ${field.name} for ${vehicle.mid} only`
                    }
                  >
                    <span>
                      <Switch
                        size="small"
                        checked={!vehicleIgnored}
                        disabled={busy}
                        onChange={() => toggleIgnoreHere(field.name)}
                        slotProps={{ input: { "aria-label": `Count ${field.name} for this vehicle` } }}
                      />
                    </span>
                  </Tooltip>
                  <Typography variant="caption" sx={{ width: 58, color: counted ? "text.secondary" : "warning.main" }}>
                    {counted ? "counted" : "ignored"}
                  </Typography>
                  <Tooltip title={record ? `Clear ${field.name}` : ""}>
                    <span>
                      <IconButton
                        edge="end"
                        size="small"
                        disabled={busy || !record}
                        onClick={() => clearOne(field.name)}
                        sx={{ visibility: record ? "visible" : "hidden" }}
                      >
                        <DeleteOutlineOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              }
            >
              <ListItemButton onClick={() => toggle(field.name)} sx={{ gap: 1.5, pr: 20 }}>
                <Checkbox edge="start" size="small" checked={selected.includes(field.name)} tabIndex={-1} sx={{ p: 0.5 }} />
                <Box sx={{ minWidth: 150 }}>
                  <Typography sx={{ fontWeight: 700 }}>{field.name}</Typography>
                  {vehicleIgnored && (
                    <Typography variant="caption" sx={{ color: "warning.main", display: "block" }}>
                      ignored for this vehicle
                    </Typography>
                  )}
                  {typeIgnored && (
                    <Typography variant="caption" sx={{ color: "warning.main", display: "block" }}>
                      ignored for every {vehicle.type}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ minWidth: 120 }}>
                  {record ? (
                    <Chip
                      size="small"
                      label={record.value}
                      color={blocking ? "error" : "default"}
                      variant={blocking ? "filled" : "outlined"}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ opacity: 0.5 }}>
                      blank
                    </Typography>
                  )}
                </Box>
                {record && (
                  <Typography variant="caption" sx={{ opacity: 0.6, minWidth: 0 }} noWrap>
                    {formatDateTime(record.updatedAt)} · {record.updatedBy}
                    {!blocking && " · doesn't block"}
                  </Typography>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <ConfirmDialog
        open={confirmClearAll}
        title={`Clear all blocked fields on ${vehicle.mid}?`}
        message="Every blocked field goes back to blank."
        confirmLabel="Clear all"
        onConfirm={clearAll}
        onClose={() => setConfirmClearAll(false)}
      />
    </Box>
  );
};

const BlockedSummary = () => {
  const { vehicles } = useVehicles();
  const blocked = vehicles.filter(hasBlockRecord).length;
  return (
    <Typography sx={{ mb: 2 }}>
      <strong>{blocked}</strong> of {vehicles.length} vehicle(s) have a blocked field set.
    </Typography>
  );
};

const filters = [
  { value: "ALL", label: "All vehicles", test: () => true },
  { value: "BLOCKED", label: "With a blocked field", test: hasBlockRecord },
  { value: "CLEAR", label: "No blocked fields", test: (v) => !hasBlockRecord(v) },
];

const Blocked = () => (
  <VehicleWorkspace
    title="EDIT BLOCKED VEHICLES"
    subtitle="Tasking, self drive, TLOAN, overseas, standby and VOR status"
    summary={<BlockedSummary />}
    filters={filters}
    renderBadge={(v) => <BlockedChip vehicle={v} />}
    renderDetail={(v) => <BlockEditor vehicle={v} />}
  />
);

export default Blocked;
