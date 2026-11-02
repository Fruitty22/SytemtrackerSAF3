import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  List,
  ListItemButton,
  MenuItem,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import { useVehicles } from "../../data/VehiclesContext";
import { formatDateTime } from "../../utils/vehicle";
import { BLOCK_FIELDS, DEPLOY_LABELS, MAINTENANCE_FIELDS } from "../../../shared/config.js";
import { deployability } from "../../../shared/deployability.js";

// every criterion, with the gate it feeds (same order as the Excel form:
// maintenance items first, then the blocked-style fields)
const CRITERIA = [
  ...MAINTENANCE_FIELDS.map((f) => ({ field: f, kind: "Maintenance" })),
  ...BLOCK_FIELDS.map((f) => ({ field: f.name, kind: "Blocked" })),
];

// Like the Excel "Special Disregards Criterias" form: pick a vehicle type,
// tick the criteria to IGNORE for it, Save. Ignored criteria never make that
// type NOT AVA. Any account can change these; they apply to every vehicle of the type.
const Disregards = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { vehicles, vehicleTypes, disregards, disregardsUpdated, saveDisregards } = useVehicles();
  const [type, setType] = useState("");
  const [draft, setDraft] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  // every type in use, plus every type that already has disregards
  const types = useMemo(
    () => [...new Set([...vehicleTypes, ...Object.keys(disregards)])].sort((a, b) => a.localeCompare(b)),
    [vehicleTypes, disregards]
  );

  useEffect(() => {
    if (!type && types.length) setType(vehicles[0]?.type ?? types[0]);
  }, [type, types, vehicles]);

  useEffect(() => {
    setDraft(disregards[type] ?? []);
    setMessage(null);
  }, [type, disregards]);

  const saved = disregards[type] ?? [];
  const dirty = [...draft].sort().join("|") !== [...saved].sort().join("|");
  const toggle = (field) =>
    setDraft((list) => (list.includes(field) ? list.filter((f) => f !== field) : [...list, field]));

  // how many of this type are AVA now, and with the ticks as they are
  const preview = useMemo(() => {
    const ofType = vehicles.filter((v) => v.type === type);
    const now = ofType.filter((v) => deployability(v, disregards).ava).length;
    const after = ofType.filter((v) => deployability(v, { ...disregards, [type]: draft }).ava).length;
    return { total: ofType.length, now, after };
  }, [vehicles, type, disregards, draft]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await saveDisregards(type, draft);
      setMessage({ severity: "success", text: `Saved. ${type} now ignores ${draft.length} criteria.` });
    } catch (err) {
      setMessage({ severity: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const lastChange = disregardsUpdated[type];
  const withRules = Object.entries(disregards)
    .filter(([, list]) => list.length)
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <Box sx={{ m: "20px" }}>
      <Header
        title="MANAGE DISREGARDS"
        subtitle={`Tick the criteria to IGNORE for each vehicle type. Ignored criteria never make it ${DEPLOY_LABELS.no}`}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(0, 2fr)" },
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* THE FORM */}
        <Box sx={{ backgroundColor: colors.primary[400], borderRadius: "4px", p: { xs: 2, sm: 3 } }}>
          <TextField
            select
            fullWidth
            label="Vehicle type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            sx={{ mb: 2 }}
          >
            {types.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
                {disregards[t]?.length ? `  (${disregards[t].length} ignored)` : ""}
              </MenuItem>
            ))}
          </TextField>

          {type && (
            <Typography sx={{ mb: 1 }}>
              {preview.total} vehicle(s) of this type: {preview.now} {DEPLOY_LABELS.yes}
              {dirty && ` → ${preview.after} ${DEPLOY_LABELS.yes} after saving`}
              {lastChange && (
                <Typography component="span" variant="body2" sx={{ display: "block", opacity: 0.7 }}>
                  Last changed {formatDateTime(lastChange.at)} by {lastChange.by}
                </Typography>
              )}
            </Typography>
          )}

          <List
            dense
            disablePadding
            sx={{ backgroundColor: "background.default", borderRadius: "4px", maxHeight: "55vh", overflowY: "auto" }}
          >
            {CRITERIA.map(({ field, kind }) => {
              const ignored = draft.includes(field);
              return (
                <ListItemButton key={field} onClick={() => toggle(field)} selected={ignored} sx={{ gap: 1.5 }}>
                  <Checkbox edge="start" size="small" checked={ignored} tabIndex={-1} sx={{ p: 0.5 }} />
                  <Typography sx={{ fontWeight: 700, flex: 1 }}>{field}</Typography>
                  <Typography variant="body2" sx={{ width: 110, opacity: 0.75 }}>
                    {kind}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ width: 64, textAlign: "right", color: ignored ? "warning.main" : colors.grey[400] }}
                  >
                    {ignored ? "ignored" : "counted"}
                  </Typography>
                </ListItemButton>
              );
            })}
          </List>

          {message && (
            <Alert severity={message.severity} sx={{ mt: 2 }}>
              {message.text}
            </Alert>
          )}
          <Box sx={{ display: "flex", gap: 2, mt: 2, justifyContent: "flex-end" }}>
            <Button color="inherit" disabled={!dirty || busy} onClick={() => setDraft(saved)}>
              Undo
            </Button>
            <Button variant="contained" color="secondary" disabled={!dirty || busy || !type} onClick={save}>
              Save
            </Button>
          </Box>
        </Box>

        {/* EVERY TYPE WITH DISREGARDS */}
        <Box sx={{ backgroundColor: colors.primary[400], borderRadius: "4px", p: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            All disregards
          </Typography>
          {withRules.length === 0 ? (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              No vehicle type ignores anything yet.
            </Typography>
          ) : (
            withRules.map(([t, list]) => (
              <Box key={t} sx={{ mb: 1.5 }}>
                <Button size="small" onClick={() => setType(t)} sx={{ fontWeight: 700, px: 0 }}>
                  {t}
                </Button>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {list.map((f) => (
                    <Chip key={f} size="small" label={f} variant="outlined" color="warning" />
                  ))}
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Disregards;
