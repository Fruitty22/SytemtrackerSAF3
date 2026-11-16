import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Radio,
  Typography,
} from "@mui/material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

// A commander picks which worksheet(s) of the workbook are theirs.
// A sheet can be shared ("3SG Chong_3SG Kim Jungwoo"): if your name is in the
// sheet name you can join it, and everyone on it sees its vehicles.
const ClaimSheetDialog = ({ onClose }) => {
  const { claimSheet, reloadUser } = useAuth();
  const [sheets, setSheets] = useState(null);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const load = useCallback(() => {
    api("/sheets")
      .then((data) => setSheets(data.sheets))
      .catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  const claim = async () => {
    setBusy(true);
    setError("");
    try {
      const sheet = sheets.find((s) => s.name === picked);
      const moved = await claimSheet(picked);
      setDone(
        sheet?.claimedBy
          ? `You now share "${picked}" with ${sheet.claimedBy}. Its vehicles show for both of you.`
          : `"${picked}" is now linked to your account. ${moved} vehicle(s) moved to you.`
      );
      setPicked("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const leave = async (name) => {
    setBusy(true);
    setError("");
    try {
      await api("/sheets/leave", { method: "POST", body: { sheet: name } });
      await reloadUser();
      setDone(`You left "${name}".`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const mine = sheets?.filter((s) => s.mine) ?? [];
  const available = sheets?.filter((s) => !s.mine && (!s.claimedBy || s.canJoin)) ?? [];
  const taken = sheets?.filter((s) => !s.mine && s.claimedBy && !s.canJoin) ?? [];

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>My worksheet</DialogTitle>
      <DialogContent dividers>
        {sheets === null && !error ? (
          <CircularProgress size={24} />
        ) : (
          <>
            {done && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {done}
              </Alert>
            )}
            {mine.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Your sheet(s)</Typography>
                {mine.map((s) => (
                  <Box key={s.name} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography sx={{ flex: 1 }}>
                      {s.name}
                      <Typography component="span" variant="body2" sx={{ ml: 1, opacity: 0.7 }}>
                        {s.claimedBy.includes("&") ? `shared: ${s.claimedBy}` : ""}
                      </Typography>
                    </Typography>
                    <Button size="small" color="inherit" disabled={busy} onClick={() => leave(s.name)}>
                      Leave
                    </Button>
                  </Box>
                ))}
              </Box>
            )}

            <Typography sx={{ mb: 1 }}>
              Pick the sheet in the fleet workbook that lists your vehicles.
            </Typography>
            {available.length === 0 ? (
              <Alert severity="info">
                {sheets?.length
                  ? "No other sheets you can take."
                  : "No workbook has been imported yet."}{" "}
                An Admin can link sheets to your account on the Accounts page.
              </Alert>
            ) : (
              <List dense disablePadding>
                {available.map((s) => (
                  <ListItemButton key={s.name} onClick={() => setPicked(s.name)} selected={picked === s.name}>
                    <Radio size="small" checked={picked === s.name} tabIndex={-1} sx={{ mr: 1 }} />
                    <ListItemText
                      primary={s.name}
                      secondary={
                        s.claimedBy
                          ? `${s.vehicles} vehicle(s) · shared with ${s.claimedBy}`
                          : `${s.vehicles} vehicle(s)`
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
            {taken.length > 0 && (
              <Typography variant="body2" sx={{ mt: 2, opacity: 0.7 }}>
                Linked to someone else: {taken.map((s) => `${s.name} (${s.claimedBy})`).join(", ")}.
                If one of these is yours, ask an Admin to add you.
              </Typography>
            )}
          </>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          Close
        </Button>
        <Button variant="contained" color="secondary" disabled={busy || !picked} onClick={claim}>
          {sheets?.find((s) => s.name === picked)?.claimedBy ? "Share this sheet" : "This sheet is mine"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClaimSheetDialog;
