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

// Change your own display name and username (saved to db.json straight away)
const MyAccountDialog = ({ onClose }) => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const changed = name.trim() !== user.name || username.trim().toLowerCase() !== user.username;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateProfile({ name, username });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>My account</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="Display name"
            helperText="How you appear in the app, e.g. 3SG Rizq"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDone(false);
            }}
            autoFocus
          />
          <TextField
            label="Username"
            helperText="What you type to log in: letters, numbers, . _ -"
            value={username}
            autoComplete="username"
            onChange={(e) => {
              setUsername(e.target.value);
              setDone(false);
            }}
          />
          <TextField label="Role" value={user.roleLabel} disabled />
          {done && (
            <Alert severity="success">
              Saved. Next time, log in as <strong>{user.username}</strong>.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={busy || !changed || !name.trim() || !username.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default MyAccountDialog;
