import { useMemo, useState } from "react";
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
  const anyBlocked = result.blockRows.some((r) => r.blocks);
  const anyItemN = result.itemRows.some((r) => r.blocks);
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {vehicle.mid} · {vehicle.type}
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Alert severity={result.ava ? "success" : "error"} icon={false}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {result.ava ? DEPLOY_LABELS.yes : DEPLOY_LABELS.no}
          </Typography>
          <Typography>
            {result.ava
              ? "No counted blocked field has a value, and no counted maintenance item is N."
              : `Because ${result.reasons.map((r) => `${r.field}: ${r.value}`).join(", ")}`}
          </Typography>
          {vehicle.statusRemark && <Typography sx={{ mt: 0.5, opacity: 0.8 }}>Remark: {vehicle.statusRemark}</Typography>}
        </Alert>
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

const Serviceable = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { isAdmin } = useAuth();
  const { vehicles, loading, error, deployOf } = useVehicles();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [viewing, setViewing] = useState(null);

  const shown = useMemo(
    () => filterVehicles(vehicles, filters, deployOf).slice().sort(byMid),
    [vehicles, filters, deployOf]
  );
  const ava = shown.filter((v) => deployOf(v).ava).length;

  // AVA count per vehicle type (click one to filter by it)
  const byType = useMemo(() => {
    const map = new Map();
    for (const v of vehicles) {
      const entry = map.get(v.type) ?? { total: 0, ava: 0 };
      entry.total += 1;
      if (deployOf(v).ava) entry.ava += 1;
      map.set(v.type, entry);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [vehicles, deployOf]);

  const rows = shown.map((v) => ({
    id: v.id,
    mid: v.mid,
    type: v.type,
    deploy: deployOf(v).ava ? DEPLOY_LABELS.yes : DEPLOY_LABELS.no,
    because: deployOf(v).reasons.map((r) => r.field).join(", "),
    ownerName: v.ownerName,
    remark: v.statusRemark ?? "",
    vehicle: v,
  }));

  const columns = [
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
      headerName: "Not AVA because",
      flex: 1.6,
      minWidth: 240,
      renderCell: ({ row }) => <ReasonChips vehicle={row.vehicle} />,
    },
    ...(isAdmin ? [{ field: "ownerName", headerName: "Managed by", flex: 1, minWidth: 150 }] : []),
    { field: "remark", headerName: "Remark", flex: 1, minWidth: 140 },
  ];

  return (
    <Box sx={{ m: "20px" }}>
      <Header
        title="SERVICEABLE VEHICLE"
        subtitle={`Vehicle availability (${DEPLOY_LABELS.yes} / ${DEPLOY_LABELS.no}). Click a vehicle to see why.`}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* PER TYPE (click to filter) */}
      {byType.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: "16px" }}>
          {byType.map(([type, n]) => (
            <Chip
              key={type}
              clickable
              onClick={() => setFilters((f) => ({ ...f, type: f.type === type ? "ALL" : type }))}
              label={`${type}   ${n.ava} / ${n.total} ${DEPLOY_LABELS.yes}`}
              sx={{
                backgroundColor: filters.type === type ? colors.blueAccent[700] : colors.primary[400],
                fontWeight: 600,
                borderLeft: `4px solid ${n.ava === n.total ? theme.palette.success.main : theme.palette.warning.main}`,
                borderRadius: "4px",
              }}
            />
          ))}
        </Box>
      )}

      {/* COUNTS FOR WHAT'S SHOWN */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "16px", mb: "16px" }}>
        <StatBox label="Shown" value={shown.length} color={theme.palette.info.main} />
        <StatBox label={DEPLOY_LABELS.yes} value={ava} color={theme.palette.success.main} />
        <StatBox label={DEPLOY_LABELS.no} value={shown.length - ava} color={theme.palette.error.main} />
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
