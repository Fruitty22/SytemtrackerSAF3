import { useDeferredValue, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import Header from "../../components/Header";
import StatBox from "../../components/StatBox";
import VehicleFilters, { EMPTY_FILTERS, filterVehicles } from "../../components/VehicleFilters";
import { DeployChip, ReasonChips } from "../../components/Chips";
import { tokens } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import { useVehicles } from "../../data/VehiclesContext";
import { byMid } from "../../utils/vehicle";
import { gridSx } from "../../utils/gridSx";
import { DEPLOY_LABELS } from "../../../shared/config.js";
import { statusLabel } from "../../../shared/deployability.js";

// SERVICEABLE VEHICLE: a read-only overview of availability.
// Filter, scan the table, click a vehicle to see why it's AVA / NOT AVA.
// (Values are changed on Edit Maintenance Level / Edit Blocked Vehicles.)

const ignoredText = (row, type) =>
  row.ignoredBy === "vehicle" ? "ignored (this vehicle)" : row.ignoredBy === "type" ? `ignored (every ${type})` : "counted";

// One gate's inputs, read-only
const GateTable = ({ title, rule, rows, tripped, type }) => (
  <Box sx={{ backgroundColor: "background.default", borderRadius: "4px", p: 1.5, minWidth: 0 }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      <Chip
        size="small"
        label={tripped ? "TRUE" : "FALSE"}
        color={tripped ? "error" : "default"}
        variant={tripped ? "filled" : "outlined"}
      />
    </Box>
    <Typography variant="caption" sx={{ opacity: 0.7 }}>
      {rule}
    </Typography>
    <Table size="small" sx={{ mt: 1 }}>
      <TableHead>
        <TableRow>
          <TableCell>Field</TableCell>
          <TableCell>Value</TableCell>
          <TableCell>Counted?</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.field} sx={r.blocks ? { backgroundColor: "rgba(244, 67, 54, 0.15)" } : undefined}>
            <TableCell sx={{ fontWeight: r.blocks ? 700 : 400 }}>{r.field}</TableCell>
            <TableCell sx={{ color: r.blocks ? "error.main" : undefined }}>
              {r.value || <span style={{ opacity: 0.5 }}>(blank)</span>}
            </TableCell>
            <TableCell sx={{ color: r.counted ? undefined : "warning.main", whiteSpace: "nowrap" }}>
              {ignoredText(r, type)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);

// Why is this vehicle AVA / NOT AVA? (opens when a row is clicked)
const LogicDialog = ({ vehicle, onClose }) => {
  const { deployOf } = useVehicles();
  const result = deployOf(vehicle);
  const anyBlocked = result.blockRows.some((r) => r.blocks) || result.scheduleRows.some((r) => r.blocks);
  const anyItemN = result.itemRows.some((r) => r.blocks);
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {vehicle.mid} · {vehicle.type}
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Alert severity={{ available: "success", deployed: "info", unavailable: "error" }[result.status]} icon={false}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {statusLabel(result.status)}
          </Typography>
          <Typography>
            {result.ava
              ? "No counted blocked field has a value, and no counted maintenance item is N."
              : `Because ${result.reasons.map((r) => `${r.field}: ${r.value}`).join(", ")}`}
          </Typography>
          {vehicle.statusRemark && <Typography sx={{ mt: 0.5, opacity: 0.8 }}>Remark: {vehicle.statusRemark}</Typography>}
        </Alert>
        {result.scheduleRows.length > 0 && (
          <Alert severity="info" variant="outlined">
            <strong>Calendar booking today:</strong>{" "}
            {result.scheduleRows
              .map((r) => `${r.field}: ${r.value} (${r.event.start === r.event.end ? r.event.start : `${r.event.start} to ${r.event.end}`})${r.counted ? "" : " - ignored"}`)
              .join("; ")}
            . It counts as a blocked field until the booking ends (Manage Vehicles → View: Calendar).
          </Alert>
        )}
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {DEPLOY_LABELS.yes} = NOT ( ANY BLOCKED <strong>OR</strong> ANY ITEM = N ) &nbsp;·&nbsp; ANY BLOCKED ={" "}
          <strong>{String(anyBlocked).toUpperCase()}</strong> &nbsp;·&nbsp; ANY ITEM = N ={" "}
          <strong>{String(anyItemN).toUpperCase()}</strong>
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <GateTable
            title="Blocked-style fields"
            rule="any text blocks · VOR STATUS needs an X"
            rows={result.blockRows}
            tripped={anyBlocked}
            type={vehicle.type}
          />
          <GateTable
            title="Maintenance items"
            rule="only N blocks · Y and blank pass"
            rows={result.itemRows}
            tripped={anyItemN}
            type={vehicle.type}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// One table row per vehicle, built once per data change (not on every keystroke)
const toRow = (v, deployOf) => ({
  id: v.id,
  mid: v.mid,
  type: v.type,
  deploy: statusLabel(deployOf(v).status),
  because: deployOf(v).reasons.map((r) => r.field).join(", "),
  ownerName: v.ownerName,
  remark: v.statusRemark ?? "",
  vehicle: v,
});

const Serviceable = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { isAdmin } = useAuth();
  const { vehicles, loading, error, deployOf } = useVehicles();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [viewing, setViewing] = useState(null);

  const deferredFilters = useDeferredValue(filters);
  const shown = useMemo(
    () => filterVehicles(vehicles, deferredFilters, deployOf).slice().sort(byMid),
    [vehicles, deferredFilters, deployOf]
  );
  const counts = useMemo(() => {
    const c = { available: 0, deployed: 0, unavailable: 0 };
    for (const v of shown) c[deployOf(v).status]++;
    return c;
  }, [shown, deployOf]);
  const count = (status) => counts[status];

  const rowById = useMemo(() => new Map(vehicles.map((v) => [v.id, toRow(v, deployOf)])), [vehicles, deployOf]);
  const rows = useMemo(() => shown.map((v) => rowById.get(v.id)), [shown, rowById]);

  const columns = useMemo(() => [
    { field: "mid", headerName: "MID", width: 110 },
    { field: "type", headerName: "Vehicle type", flex: 1, minWidth: 160 },
    {
      field: "deploy",
      headerName: "Deployable",
      width: 130,
      renderCell: ({ row }) => <DeployChip vehicle={row.vehicle} />,
    },
    {
      field: "because",
      headerName: "Reason",
      flex: 1.6,
      minWidth: 240,
      renderCell: ({ row }) => <ReasonChips vehicle={row.vehicle} />,
    },
    ...(isAdmin ? [{ field: "ownerName", headerName: "Managed by", flex: 1, minWidth: 150 }] : []),
    { field: "remark", headerName: "Remark", flex: 1, minWidth: 140 },
  ], [isAdmin]);

  return (
    <Box sx={{ m: { xs: "12px", sm: "20px" } }}>
      <Header
        title="SERVICEABLE VEHICLE"
        subtitle="Vehicle availability at a glance. Click a vehicle to see why."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* COUNTS FOR WHAT'S SHOWN */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "16px", mb: "16px" }}>
        <StatBox label="Shown" value={shown.length} color={theme.palette.info.main} />
        <StatBox label={DEPLOY_LABELS.yes} value={count("available")} color={theme.palette.success.main} />
        <StatBox label={DEPLOY_LABELS.deployed} value={count("deployed")} color={theme.palette.info.main} />
        <StatBox label={DEPLOY_LABELS.no} value={count("unavailable")} color={theme.palette.error.main} />
      </Box>

      <Box sx={{ mb: "12px" }}>
        <VehicleFilters vehicles={vehicles} value={filters} onChange={setFilters} />
      </Box>

      <Box sx={{ height: "60vh", minHeight: 360, ...gridSx(colors), "& .MuiDataGrid-row": { cursor: "pointer" } }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          density="compact"
          disableColumnFilter
          disableRowSelectionOnClick
          onRowClick={({ row }) => setViewing(row.vehicle)}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
          pageSizeOptions={[25, 50, 100]}
        />
      </Box>

      {viewing && <LogicDialog vehicle={viewing} onClose={() => setViewing(null)} />}
    </Box>
  );
};

export default Serviceable;