import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { useVehicles } from "../data/VehiclesContext";
import { UNASSIGNED } from "../../shared/config.js";

// Add a vehicle (vehicle = null) or edit its main details.
const VehicleDialog = ({ vehicle, defaultType = "", onClose, onSaved }) => {
  const { user, isAdmin } = useAuth();
  const { users, vehicleTypes, createVehicle, updateVehicle } = useVehicles();
  const creating = !vehicle;

  const [form, setForm] = useState({
    mid: vehicle?.mid ?? "",
    type: vehicle?.type ?? defaultType,
    ownerId: vehicle ? vehicle.ownerId ?? UNASSIGNED : user.id,
    remarks: vehicle?.remarks ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      mid: form.mid,
      type: form.type,
      remarks: form.remarks,
    };
    if (isAdmin) body.ownerId = form.ownerId;
    try {
      const saved = creating
        ? await createVehicle(body)
        : await updateVehicle(vehicle.id, body);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>{creating ? "Add vehicle" : `Edit vehicle ${vehicle.mid}`}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="MID number"
            value={form.mid}
            onChange={set("mid")}
            autoFocus={creating}
            required
          />
          <TextField
            label="Vehicle type"
            value={form.type}
            onChange={set("type")}
            required
            helperText="Pick from the list or type a new one"
            slotProps={{ htmlInput: { list: "vehicle-type-options" } }}
          />
          <datalist id="vehicle-type-options">
            {vehicleTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          {isAdmin && (
            <TextField
              select
              label="Managed by"
              value={form.ownerId}
              onChange={set("ownerId")}
              helperText={
                vehicle?.managerIds?.length > 1
                  ? `Shared through its sheet (${vehicle.sourceSheet}): ${vehicle.ownerName}`
                  : undefined
              }
            >
              <MenuItem value={UNASSIGNED}>
                <em>Unassigned</em>
              </MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Remarks"
            value={form.remarks}
            onChange={set("remarks")}
            multiline
            minRows={2}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit" disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={busy || !form.mid.trim() || !form.type.trim()}
          >
            {creating ? "Add vehicle" : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default VehicleDialog;
