import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import RestoreOutlinedIcon from "@mui/icons-material/RestoreOutlined";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import Header from "../../components/Header";
import ConfirmDialog from "../../components/ConfirmDialog";
import { tokens } from "../../theme";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useVehicles } from "../../data/VehiclesContext";
import { formatDateTime } from "../../utils/vehicle";
import { gridSx } from "../../utils/gridSx";
import { ROLES, UNASSIGNED } from "../../../shared/config.js";

// ---- Add / edit account dialog
const AccountDialog = ({ account, onClose, onSaved, isSelf }) => {
  const creating = !account?.id;
  const [form, setForm] = useState({
    username: account?.username ?? "",
    name: account?.name ?? "",
    role: account?.role ?? "commander",
    sheets: (account?.sheets ?? []).join(", "),
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (creating) {
        await api("/users", { method: "POST", body: form });
      } else {
        const patch = {
          name: form.name,
          username: form.username,
          role: form.role,
          sheets: form.sheets,
        };
        if (form.password) patch.password = form.password;
        await api(`/users/${account.id}`, { method: "PATCH", body: patch });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>{creating ? "Add account" : `Edit ${account.name}`}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="Display name"
            helperText="e.g. 3SG Rizq"
            value={form.name}
            onChange={set("name")}
            autoFocus
          />
          <TextField
            label="Username"
            value={form.username}
            onChange={set("username")}
            helperText="For logging in: letters, numbers, . _ -"
          />
          <TextField
            label="Excel worksheet(s)"
            value={form.sheets}
            onChange={set("sheets")}
            helperText="Sheet names in the workbook for this account, separated by commas. Several accounts can share a sheet (they all see its vehicles). Adding a sheet brings its unassigned vehicles here."
          />
          <TextField
            select
            label="Role"
            value={form.role}
            onChange={set("role")}
            disabled={isSelf}
            helperText={isSelf ? "You can't change your own role" : " "}
          >
            {Object.entries(ROLES).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={creating ? "Password" : "New password (optional)"}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            helperText={
              creating
                ? "At least 6 characters"
                : "Leave empty to keep it. Setting one logs them out everywhere."
            }
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
            disabled={busy || !form.name || !form.username || (creating && !form.password)}
          >
            {creating ? "Add account" : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

// ---- Deleted accounts (kept in server/data/deleted-accounts.json)
const DeletedAccounts = ({ reloadKey, onRestored }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [purging, setPurging] = useState(null);

  const load = useCallback(async () => {
    try {
      setItems((await api("/users/deleted")).users);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const restore = async (account) => {
    setBusyId(account.id);
    setError("");
    try {
      await api(`/users/deleted/${account.id}/restore`, { method: "POST" });
      await Promise.all([load(), onRestored()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const purge = async () => {
    await api(`/users/deleted/${purging.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <Box sx={{ mt: "30px" }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Deleted accounts ({items.length})
      </Typography>
      <Typography sx={{ color: colors.grey[300], mb: 1.5 }}>
        Kept in <code>server/data/deleted-accounts.json</code>. Restoring brings the
        account back with its old password; its vehicles stay with whoever took them over.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ backgroundColor: colors.primary[400], borderRadius: "4px", overflowX: "auto" }}>
        {items.length === 0 ? (
          <Typography sx={{ p: 2, color: colors.grey[300] }}>No deleted accounts.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Display name</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Deleted</TableCell>
                <TableCell>Deleted by</TableCell>
                <TableCell>Vehicles moved to</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell sx={{ fontWeight: 700 }}>{u.name}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.roleLabel}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(u.deletedAt)}</TableCell>
                  <TableCell>{u.deletedBy}</TableCell>
                  <TableCell>
                    {u.vehiclesMoved ? `${u.vehiclesMovedTo} (${u.vehiclesMoved})` : "-"}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title="Restore account">
                      <span>
                        <IconButton size="small" disabled={busyId === u.id} onClick={() => restore(u)}>
                          <RestoreOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Remove from archive for good">
                      <IconButton size="small" onClick={() => setPurging(u)}>
                        <DeleteForeverOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <ConfirmDialog
        open={!!purging}
        title={`Remove ${purging?.name ?? ""} for good?`}
        message="It is removed from the deleted-accounts archive and can't be restored any more."
        confirmLabel="Remove for good"
        onConfirm={purge}
        onClose={() => setPurging(null)}
      />
    </Box>
  );
};

// ---- the page
const Accounts = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { user: me, reloadUser } = useAuth();
  const { users, loading, error, refresh } = useVehicles();
  const [editing, setEditing] = useState(null); // {} = new account
  const [deleting, setDeleting] = useState(null);
  const [reassignTo, setReassignTo] = useState("");
  const [deletedReload, setDeletedReload] = useState(0);

  const columns = useMemo(
    () => [
      { field: "name", headerName: "Display name", flex: 1, minWidth: 160 },
      { field: "username", headerName: "Username", flex: 1, minWidth: 130 },
      {
        field: "role",
        headerName: "Role",
        width: 170,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            label={row.roleLabel}
            color={row.role === "admin" ? "secondary" : "default"}
            variant={row.role === "admin" ? "filled" : "outlined"}
          />
        ),
      },
      { field: "vehicleCount", headerName: "Vehicles", type: "number", width: 100 },
      {
        field: "sheets",
        headerName: "Excel worksheet(s)",
        flex: 1,
        minWidth: 160,
        valueFormatter: (value) => (Array.isArray(value) ? value.join(", ") : ""),
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: 180,
        renderCell: ({ row }) => formatDateTime(row.createdAt),
      },
      {
        field: "actions",
        headerName: "",
        width: 100,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <Box>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => setEditing(row)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={row.id === me.id ? "You can't delete yourself" : "Delete"}>
              <span>
                <IconButton
                  size="small"
                  disabled={row.id === me.id}
                  onClick={() => {
                    setReassignTo("");
                    setDeleting(row);
                  }}
                >
                  <DeleteOutlineOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [me.id]
  );

  const deleteAccount = async () => {
    if (deleting.vehicleCount > 0 && !reassignTo) {
      throw new Error("Choose who should take over their vehicles first.");
    }
    const query = reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : "";
    await api(`/users/${deleting.id}${query}`, { method: "DELETE" });
    await refresh();
    setDeletedReload((n) => n + 1);
  };

  return (
    <Box sx={{ m: "20px" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
        <Header title="ACCOUNTS" subtitle="Who can log in, and what they can see" />
        <Button
          variant="contained"
          color="secondary"
          startIcon={<PersonAddOutlinedIcon />}
          onClick={() => setEditing({})}
        >
          Add account
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Fleet Commanders see the vehicles of their own sheet(s); a sheet can be shared by
        several accounts. Admins see every
        vehicle and this page. People can also create their own Fleet Commander
        account from the Sign up tab on the login screen.
      </Alert>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ height: "55vh", minHeight: 320, ...gridSx(colors) }}>
        <DataGrid
          rows={users}
          columns={columns}
          loading={loading}
          density="compact"
          showToolbar
          disableRowSelectionOnClick
          onRowDoubleClick={({ row }) => setEditing(row)}
        />
      </Box>

      {editing && (
        <AccountDialog
          account={editing}
          isSelf={editing.id === me.id}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            if (editing.id === me.id) await reloadUser(); // also refreshes the list
            else await refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name ?? ""}?`}
        message="They won't be able to log in any more. The account is kept under Deleted accounts below, where you can restore it."
        confirmLabel="Delete account"
        onConfirm={deleteAccount}
        onClose={() => setDeleting(null)}
      >
        {deleting?.vehicleCount > 0 && (
          <TextField
            select
            fullWidth
            sx={{ mt: 2 }}
            label={`Move their ${deleting.vehicleCount} vehicle(s) to`}
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
          >
            <MenuItem value={UNASSIGNED}>
              <em>Unassigned</em>
            </MenuItem>
            {users
              .filter((u) => u.id !== deleting.id)
              .map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
          </TextField>
        )}
      </ConfirmDialog>

      <DeletedAccounts reloadKey={deletedReload} onRestored={refresh} />
    </Box>
  );
};

export default Accounts;
