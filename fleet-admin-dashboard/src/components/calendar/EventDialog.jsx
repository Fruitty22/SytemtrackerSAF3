import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { useVehicles } from "../../data/VehiclesContext";
import { formatDateTime } from "../../utils/vehicle";
import { DEPLOYED_FIELDS, SCHEDULE_KINDS } from "../../../shared/config.js";
import { deployability, reasonText } from "../../../shared/deployability.js";
import { clashes, kindOf } from "../../../shared/schedule.js";
import { formatRange } from "./dates";

// Create or change one booking (tasking, servicing, maintenance, other).
// `event` = an existing booking to edit, or a draft { start, end, vehicleIds? } for a new one.
// A draft can carry clearField: { field, vehicleIds } - when an existing status
// (e.g. OVERSEAS on 5 vehicles) is being put on dates, that field is cleared on
// those vehicles after saving, so the booking alone controls their status.
const EventDialog = ({ event, onClose }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const { vehicles, events, disregards, today, createEvent, updateEvent, deleteEvent, updateVehicle } = useVehicles();
  const editing = !!event.id;

  const [kind, setKind] = useState(event.kind ?? "tasking");
  const [title, setTitle] = useState(event.title ?? "");
  const [tasking, setTasking] = useState(event.tasking ?? "");
  const [field, setField] = useState(event.field || "TASKING");
  const [clearAfter, setClearAfter] = useState(true);
  const [start, setStart] = useState(event.start);
  const [end, setEnd] = useState(event.end ?? event.start);
  const [allDay, setAllDay] = useState(!event.startTime && !event.endTime);
  const [startTime, setStartTime] = useState(event.startTime || "08:00");
  const [endTime, setEndTime] = useState(event.endTime || "17:00");
  const [vehicleIds, setVehicleIds] = useState(event.vehicleIds ?? []);
  const [notes, setNotes] = useState(event.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const kindInfo = kindOf(kind);

  // every vehicle this account can book, grouped by type
  const options = useMemo(
    () =>
      vehicles
        .slice()
        .sort((a, b) => a.type.localeCompare(b.type) || a.mid.localeCompare(b.mid, undefined, { numeric: true })),
    [vehicles]
  );
  const byId = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const selected = vehicleIds.map((id) => byId.get(id)).filter(Boolean);
  const types = useMemo(() => [...new Set(options.map((v) => v.type))], [options]);

  // TASKING values already used (fleet + calendar), as suggestions
  const taskingSuggestions = useMemo(() => {
    const values = new Set();
    for (const v of vehicles) if (v.blocks?.[field]?.value) values.add(v.blocks[field].value);
    for (const e of events) if (e.tasking) values.add(e.tasking);
    return [...values].sort();
  }, [vehicles, events, field]);

  // warnings: already booked on those dates, or out of action right now
  const warnings = useMemo(() => {
    if (kindInfo.effect === "none") return [];
    const list = [];
    const draft = { id: event.id, start, end: end || start, vehicleIds };
    if ((end || start) < today) {
      list.push(
        `These dates have passed, so this booking won't change any status now${
          event.clearField ? ` (and with ${event.clearField.field} cleared, the vehicles go back to normal today)` : ""
        }.`
      );
    }
    for (const c of clashes(draft, events)) {
      const mids = c.vehicleIds.map((id) => byId.get(id)?.mid).filter(Boolean);
      list.push(
        `${mids.join(", ")} already booked: ${c.event.title} (${kindOf(c.event.kind).label}, ${formatRange(c.event.start, c.event.end)})`
      );
    }
    for (const v of selected) {
      const now = deployability(v, disregards);
      if (now.status === "unavailable") {
        list.push(`${v.mid} is UNAVAILABLE now (${now.reasons.map(reasonText).join(", ")})`);
      }
    }
    return list;
  }, [kindInfo.effect, event.id, event.clearField, start, end, today, vehicleIds, events, byId, selected, disregards]);

  const save = async () => {
    setBusy(true);
    setError("");
    const body = {
      kind,
      title: title.trim(),
      tasking: kind === "tasking" ? tasking.trim().toUpperCase() : "",
      field: kind === "tasking" ? field : undefined,
      start,
      end: end || start,
      startTime: allDay ? "" : startTime,
      endTime: allDay ? "" : endTime,
      vehicleIds,
      notes,
    };
    try {
      if (editing) await updateEvent(event.id, body);
      else await createEvent(body);
      // hand the status over to the booking: clear the old field on those vehicles
      if (!editing && event.clearField && clearAfter) {
        const ids = event.clearField.vehicleIds.filter((id) => vehicleIds.includes(id));
        for (const id of ids) {
          await updateVehicle(id, { blocks: { [event.clearField.field]: null } });
        }
      }
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteEvent(event.id);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={phone}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 14, height: 14, borderRadius: "4px", backgroundColor: kindInfo.color, flexShrink: 0 }} />
        {editing ? "Edit booking" : "New booking"}
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px 1fr" }, gap: 2 }}>
          <TextField select size="small" label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {SCHEDULE_KINDS.map((k) => (
              <MenuItem key={k.key} value={k.key}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "3px", backgroundColor: k.color }} />
                  {k.label}
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Title"
            placeholder={kind === "tasking" ? "e.g. XCS support" : kind === "servicing" ? "e.g. 6-monthly service" : ""}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus={!editing}
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
        </Box>

        {kind === "tasking" && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px 1fr" }, gap: 2, alignItems: "start" }}>
            <TextField select size="small" label="Shows as" value={field} onChange={(e) => setField(e.target.value)}>
              {DEPLOYED_FIELDS.map((f) => (
                <MenuItem key={f} value={f}>
                  {f}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              freeSolo
              options={taskingSuggestions}
              value={tasking}
              onInputChange={(_, v) => setTasking(v.toUpperCase())}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={`${field} value`}
                  helperText={`Shown as ${field} on these vehicles while the booking is on. Blank = "${(title || "title").toUpperCase()}".`}
                />
              )}
            />
          </Box>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
          <TextField
            size="small"
            type="date"
            label="From"
            value={start}
            onChange={(e) => {
              const v = e.target.value;
              setStart(v);
              if (v && end && end < v) setEnd(v);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            size="small"
            type="date"
            label="To (inclusive)"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: start } }}
          />
          {!allDay && (
            <>
              <TextField
                size="small"
                type="time"
                label="Start time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size="small"
                type="time"
                label="End time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </>
          )}
        </Box>
        <FormControlLabel
          sx={{ mt: -1 }}
          control={<Checkbox size="small" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />}
          label={
            <Typography variant="body2">
              All day{" "}
              <Typography component="span" variant="caption" sx={{ opacity: 0.7 }}>
                (times are for information; the status changes for whole days)
              </Typography>
            </Typography>
          }
        />

        <Box>
          <Autocomplete
            multiple
            disableCloseOnSelect
            limitTags={phone ? 4 : 8}
            options={options}
            groupBy={(v) => v.type}
            getOptionLabel={(v) => v.mid}
            renderOption={(props, v, { selected: ticked }) => {
              const { key, ...rest } = props;
              return (
                <li key={key} {...rest}>
                  <Checkbox size="small" checked={ticked} sx={{ mr: 1, p: 0.25 }} />
                  {v.mid}
                  {v.ownerName && (
                    <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.6 }}>
                      {v.ownerName}
                    </Typography>
                  )}
                </li>
              );
            }}
            filterOptions={(opts, { inputValue }) => {
              const q = inputValue.trim().toUpperCase();
              return q ? opts.filter((v) => v.mid.includes(q) || v.type.toUpperCase().includes(q)) : opts;
            }}
            value={selected}
            onChange={(_, list) => setVehicleIds(list.map((v) => v.id))}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label={`Vehicles (${selected.length})`}
                placeholder="Type a MID or vehicle type"
              />
            )}
          />
          <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              select
              size="small"
              label="Add every vehicle of a type"
              value=""
              onChange={(e) => {
                const add = options.filter((v) => v.type === e.target.value).map((v) => v.id);
                setVehicleIds((ids) => [...new Set([...ids, ...add])]);
              }}
              sx={{ minWidth: 240, flex: { xs: 1, sm: "none" } }}
            >
              {types.map((t) => (
                <MenuItem key={t} value={t}>
                  {t} ({options.filter((v) => v.type === t).length})
                </MenuItem>
              ))}
            </TextField>
            {selected.length > 0 && (
              <Button size="small" color="inherit" onClick={() => setVehicleIds([])}>
                Clear vehicles
              </Button>
            )}
          </Box>
          {event.otherVehicles > 0 && (
            <Typography variant="caption" component="div" sx={{ mt: 0.5, opacity: 0.8 }}>
              Also books {event.otherVehicles} vehicle(s) of other commanders (kept as they are).
            </Typography>
          )}
        </Box>

        <TextField
          size="small"
          label="Notes"
          multiline
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />

        {kindInfo.effect !== "none" && (
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            From {formatRange(start, end || start)} these vehicles will show as{" "}
            <strong>{kindInfo.effect === "deployed" ? "DEPLOYED" : "UNAVAILABLE"}</strong> everywhere in the app, then go back to
            normal by themselves.
          </Typography>
        )}
        {!editing && event.clearField && (
          <FormControlLabel
            control={<Checkbox size="small" checked={clearAfter} onChange={(e) => setClearAfter(e.target.checked)} />}
            label={
              <Typography variant="body2">
                Clear <strong>{event.clearField.field}</strong> on these vehicles after saving, so the booking alone
                controls their status (recommended; otherwise the old value stays after the booking ends)
              </Typography>
            }
          />
        )}
        {warnings.length > 0 && (
          <Alert severity="warning">
            {warnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {editing && (
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            Made by {event.createdByName} on {formatDateTime(event.createdAt)}
            {event.updatedAt ? ` · last changed by ${event.updatedBy} on ${formatDateTime(event.updatedAt)}` : ""}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        {editing &&
          (confirmDelete ? (
            <>
              <Typography variant="body2" sx={{ mr: "auto", pl: 1 }}>
                Delete this booking?
              </Typography>
              <Button color="inherit" onClick={() => setConfirmDelete(false)} disabled={busy}>
                Keep
              </Button>
              <Button color="error" variant="contained" onClick={remove} disabled={busy}>
                Delete
              </Button>
            </>
          ) : (
            <Button
              color="error"
              startIcon={<DeleteOutlineOutlinedIcon />}
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              sx={{ mr: "auto" }}
            >
              Delete
            </Button>
          ))}
        {!confirmDelete && (
          <>
            <Button color="inherit" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="contained" color="secondary" onClick={save} disabled={busy || !title.trim() || !start}>
              {editing ? "Save" : "Create"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EventDialog;
