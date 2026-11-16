import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";

const empty = { current: "", next: "", confirm: "" };

const ChangePasswordDialog = ({ open, onClose }) => {
  const { changePassword } = useAuth();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setForm(empty);
    setError("");
    setDone(false);
    onClose();
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (form.next !== form.confirm) {
      setError("The two new passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changePassword(form.current, form.next);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>Change password</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {done ? (
            <Alert severity="success">
              Password changed. Any other devices using this account have been logged out.
            </Alert>
          ) : (
            <>
              <TextField
                label="Current password"
                type="password"
                autoComplete="current-password"
                value={form.current}
                onChange={set("current")}
                autoFocus
              />
              <TextField
                label="New password"
                type="password"
                autoComplete="new-password"
                helperText="At least 6 characters"
                value={form.next}
                onChange={set("next")}
              />
              <TextField
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={set("confirm")}
              />
              {error && <Alert severity="error">{error}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} color="inherit">
            {done ? "Close" : "Cancel"}
          </Button>
          {!done && (
            <Button
              type="submit"
              variant="contained"
              color="secondary"
              disabled={busy || !form.current || !form.next || !form.confirm}
            >
              Change password
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ChangePasswordDialog;
