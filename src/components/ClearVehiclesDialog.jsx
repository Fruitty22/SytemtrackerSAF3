import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { api } from "../api/client";
import { useVehicles } from "../data/VehiclesContext";

// "Remove all vehicles" (Admin): start afresh before importing new Excel files.
// Resets the criteria (optional), keeps accounts, which sheet is whose and disregards. Can be undone.
const ClearVehiclesDialog = ({ onClose, onImport }) => {
  const { vehicles, events, refresh } = useVehicles();
  const [typed, setTyped] = useState("");
  const [bookings, setBookings] = useState(false);
  const [resetCriteria, setResetCriteria] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [undone, setUndone] = useState(false);

  const withVehicles = (events ?? []).filter((e) => e.vehicleIds?.length).length;

  const clear = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api("/vehicles/clear", { method: "POST", body: { confirm: "DELETE", bookings, criteria: resetCriteria } });
      await refresh();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/vehicles/import/undo", { method: "POST" });
      await refresh();
      setUndone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{result ? "All vehicles removed" : "Remove all vehicles?"}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {!result ? (
          <>
            <Typography>
              This deletes <strong>all {vehicles.length} vehicles</strong> so you can import new Excel files from
              scratch.
            </Typography>
            <Box sx={{ pl: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Removed:
              </Typography>
              <Typography variant="body2">&bull; every vehicle, with its blocked fields, Y/N items and remarks</Typography>
              <Typography variant="body2">&bull; the list of imported sheets (the next import lists them again)</Typography>
              {resetCriteria && (
                <Typography variant="body2">
                  &bull; added criteria: the list goes back to the starting one, so the next import asks about every
                  new column again
                </Typography>
              )}
              <Typography variant="body2" sx={{ fontWeight: 700, mt: 1 }}>
                Kept:
              </Typography>
              <Typography variant="body2">&bull; all accounts and passwords</Typography>
              <Typography variant="body2">
                &bull; which sheet belongs to which commander, so the next import goes to the right people
              </Typography>
              <Typography variant="body2">
                &bull; disregard rules{resetCriteria ? "" : " and criteria (Manage Criteria)"}
              </Typography>
            </Box>
            <FormControlLabel
              control={<Checkbox checked={resetCriteria} onChange={(e) => setResetCriteria(e.target.checked)} />}
              label="Reset criteria to the starting list (recommended for a fresh import)"
            />
            <FormControlLabel
              sx={{ mt: -1.5 }}
              control={<Checkbox checked={bookings} onChange={(e) => setBookings(e.target.checked)} />}
              label={`Also delete all calendar bookings (${(events ?? []).length})`}
            />
            {!bookings && withVehicles > 0 && (
              <Typography variant="caption" sx={{ opacity: 0.75, mt: -1.5 }}>
                The {withVehicles} booking(s) for vehicles are removed anyway (their vehicles are gone); reminders
                without vehicles are kept.
              </Typography>
            )}
            <TextField
              label='Type DELETE to confirm'
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              size="small"
              error={typed.length > 0 && typed !== "DELETE"}
            />
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              A copy is kept, so you can undo this straight afterwards.
            </Typography>
          </>
        ) : undone ? (
          <Alert severity="info">Undone - all {result.removed} vehicles{result.criteriaReset ? " and your criteria" : ""} are back.</Alert>
        ) : (
          <>
            <Alert severity="success">
              Removed {result.removed} vehicle(s)
              {result.bookingsRemoved ? ` and ${result.bookingsRemoved} booking(s)` : ""}
              {result.criteriaReset ? ", and reset the criteria" : ""}. You can now import the new Excel files.
            </Alert>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<UploadFileOutlinedIcon />}
                onClick={() => {
                  onClose();
                  onImport();
                }}
              >
                Import from Excel now
              </Button>
              <Button color="warning" variant="outlined" startIcon={<UndoOutlinedIcon />} onClick={undo} disabled={busy}>
                Undo
              </Button>
            </Box>
          </>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          {result ? "Close" : "Cancel"}
        </Button>
        {!result && (
          <Button
            variant="contained"
            color="error"
            onClick={clear}
            disabled={busy || typed !== "DELETE" || vehicles.length === 0}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Remove all {vehicles.length} vehicles
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ClearVehiclesDialog;
