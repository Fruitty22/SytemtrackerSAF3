import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import Header from "../../components/Header";
import StatBox from "../../components/StatBox";
import ImportDialog from "../../components/ImportDialog";
import ConfirmDialog from "../../components/ConfirmDialog";
import ClaimSheetDialog from "../../components/ClaimSheetDialog";
import VehicleFilters, { EMPTY_FILTERS, filterVehicles } from "../../components/VehicleFilters";
import useVehicleDialogs from "../../components/useVehicleDialogs";
import { BlockedChip, DeployChip, ReasonChips } from "../../components/Chips";
import { tokens } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import { useVehicles } from "../../data/VehiclesContext";
import { byMid, formatDateTime, managedBy } from "../../utils/vehicle";
import { gridSx } from "../../utils/gridSx";
import {
  BLOCK_FIELDS,
  DEPLOY_LABELS,
  MAINTENANCE_FIELDS,
  UNASSIGNED,
} from "../../../shared/config.js";
import { hasBlockRecord } from "../../../shared/deployability.js";

// DataGrid's selection model: { type: "include" | "exclude", ids: Set } in
// MUI X v8+, or a plain array of ids in older versions. Handle both.
const EMPTY_SELECTION = { type: "include", ids: new Set() };
const selectedIdsOf = (model, allIds) => {
  if (Array.isArray(model)) return model;
  const ids = model?.ids ?? new Set();
  return model?.type === "exclude" ? allIds.filter((id) => !ids.has(id)) : [...ids];
};

const Vehicles = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { user, isAdmin } = useAuth();
  const { vehicles, users, loading, error, refresh, assignVehicles, deleteVehicles, deployOf } =
    useVehicles();
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [importing, setImporting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [assignTo, setAssignTo] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMessage, setBulkMessage] = useState(null);
  const { openCreate, openEdit, openDelete, dialogs } = useVehicleDialogs();

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // scope = the vehicles of the chosen commander (the summary counts);
  // shown = scope after the filter bar (the table, selection and export)
  const scope = useMemo(
    () =>
      (ownerFilter === "ALL" ? vehicles : vehicles.filter((v) => managedBy(v, ownerFilter)))
        .slice()
        .sort(byMid),
    [vehicles, ownerFilter]
  );
  const shown = useMemo(() => filterVehicles(scope, filters, deployOf), [scope, filters, deployOf]);

  const selectedIds = useMemo(
    () => selectedIdsOf(selection, shown.map((v) => v.id)),
    [selection, shown]
  );
  const clearSelection = () => setSelection(EMPTY_SELECTION);

  const assignSelected = async () => {
    setBulkMessage(null);
    try {
      const { moved } = await assignVehicles(selectedIds, assignTo);
      const name = assignTo === UNASSIGNED ? "Unassigned" : users.find((u) => u.id === assignTo)?.name;
      setBulkMessage({ severity: "success", text: `${moved} vehicle(s) moved to ${name}.` });
      clearSelection();
      setAssignTo("");
    } catch (err) {
      setBulkMessage({ severity: "error", text: err.message });
    }
  };

  const stats = useMemo(
    () => ({
      total: scope.length,
      ava: scope.filter((v) => deployOf(v).ava).length,
      notAva: scope.filter((v) => !deployOf(v).ava).length,
      blocked: scope.filter((v) => hasBlockRecord(v)).length,
      // vehicles with a counted maintenance item at N (what needs fixing)
      issues: scope.filter((v) => deployOf(v).reasons.some((r) => r.kind === "maintenance")).length,
      unassigned: scope.filter((v) => !v.managerIds?.length).length,
    }),
    [scope, deployOf]
  );

  const rows = useMemo(
    () =>
      shown.map((v) => ({
        id: v.id,
        mid: v.mid,
        type: v.type,
        deploy: deployOf(v).ava ? DEPLOY_LABELS.yes : DEPLOY_LABELS.no,
        blocked: hasBlockRecord(v) ? "BLOCKED" : "",
        because: deployOf(v).reasons.map((r) => r.field).join(", "),
        ownerName: v.ownerName,
        remarks: v.remarks,
        updatedAt: v.updatedAt,
        vehicle: v,
      })),
    [shown, deployOf]
  );

  const columns = useMemo(
    () => [
      { field: "mid", headerName: "MID", width: 110 },
      { field: "type", headerName: "Vehicle type", flex: 1, minWidth: 160 },
      {
        field: "deploy",
        headerName: "Deployable",
        width: 130,
        renderCell: ({ row }) => <DeployChip vehicle={row.vehicle} />,
      },
      {
        field: "blocked",
        headerName: "Blocked",
        width: 110,
        renderCell: ({ row }) => <BlockedChip vehicle={row.vehicle} />,
      },
      {
        field: "because",
        headerName: "Not AVA because",
        flex: 1.5,
        minWidth: 220,
        renderCell: ({ row }) => <ReasonChips vehicle={row.vehicle} />,
      },
      ...(isAdmin
        ? [{ field: "ownerName", headerName: "Managed by", flex: 1, minWidth: 150 }]
        : []),
      { field: "remarks", headerName: "Remarks", flex: 1, minWidth: 150 },
      {
        field: "updatedAt",
        headerName: "Last updated",
        width: 170,
        renderCell: ({ row }) => formatDateTime(row.updatedAt),
      },
      {
        field: "actions",
        headerName: "",
        width: 96,
        sortable: false,
        filterable: false,
        disableExport: true,
        renderCell: ({ row }) => (
          <Box>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEdit(row.vehicle)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => openDelete(row.vehicle)}>
                <DeleteOutlineOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ],
    // openEdit/openDelete only call setState, so they never go stale
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin]
  );

  // Everything, including each maintenance field, as one Excel sheet
  const exportToExcel = () => {
    const data = shown.map((v) => {
      const { ava, reasons } = deployOf(v);
      const row = {
        MID: v.mid,
        "VEHICLE TYPE": v.type,
        DEPLOYABLE: ava ? DEPLOY_LABELS.yes : DEPLOY_LABELS.no,
        BECAUSE: reasons.map((r) => `${r.field}: ${r.value}`).join(", "),
      };
      if (isAdmin) {
        row["MANAGED BY"] = v.ownerName;
        row.SHEET = v.sourceSheet ?? "";
      }
      for (const field of BLOCK_FIELDS) row[field.name] = v.blocks?.[field.name]?.value ?? "";
      for (const field of MAINTENANCE_FIELDS) row[field] = v.maintenance?.[field]?.level ?? "";
      row["STATUS REMARK"] = v.statusRemark ?? "";
      row.REMARKS = v.remarks ?? "";
      row["LAST UPDATED"] = formatDateTime(v.updatedAt);
      row["UPDATED BY"] = v.updatedBy ?? "";
      return row;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Vehicles");
    XLSX.writeFile(wb, `fleet-vehicles-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Box sx={{ m: "20px" }}>
      <Header
        title="MANAGE VEHICLES"
        subtitle={isAdmin ? "Every vehicle in the fleet" : `Vehicles managed by ${user.name}`}
      />

      {/* SUMMARY */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "16px", mb: "20px" }}>
        <StatBox label="Vehicles" value={stats.total} color={colors.blueAccent[400]} />
        <StatBox label={DEPLOY_LABELS.yes} value={stats.ava} color={theme.palette.success.main} />
        <StatBox label={DEPLOY_LABELS.no} value={stats.notAva} color={theme.palette.error.main} />
        <StatBox label="Blocked" value={stats.blocked} color={theme.palette.error.dark} />
        <StatBox label="Need maintenance (item N)" value={stats.issues} color={theme.palette.warning.main} />
        {isAdmin && stats.unassigned > 0 && (
          <StatBox label="Unassigned" value={stats.unassigned} color={theme.palette.grey[500]} />
        )}
      </Box>

      {/* ACTIONS */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", mb: "12px" }}>
        {isAdmin && (
          <TextField
            select
            size="small"
            label="Managed by"
            value={ownerFilter}
            onChange={(e) => {
              setOwnerFilter(e.target.value);
              clearSelection();
            }}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="ALL">Everyone</MenuItem>
            <MenuItem value={UNASSIGNED}>
              Unassigned ({vehicles.filter((v) => managedBy(v, UNASSIGNED)).length})
            </MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name} ({vehicles.filter((v) => managedBy(v, u.id)).length})
              </MenuItem>
            ))}
          </TextField>
        )}
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" color="secondary" startIcon={<AddOutlinedIcon />} onClick={openCreate}>
          Add vehicle
        </Button>
        {isAdmin && (
          <Button variant="outlined" color="inherit" startIcon={<UploadFileOutlinedIcon />} onClick={() => setImporting(true)}>
            Import from Excel
          </Button>
        )}
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<DownloadOutlinedIcon />}
          onClick={exportToExcel}
          disabled={shown.length === 0}
        >
          Export to Excel
        </Button>
        <Tooltip title="Reload from the server">
          <IconButton onClick={refresh}>
            <RefreshOutlinedIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {!loading && vehicles.length === 0 && !error && (
        isAdmin ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            No vehicles yet. Use <strong>Import from Excel</strong> to bring in your whole
            workbook at once, or <strong>Add vehicle</strong> for one at a time.
          </Alert>
        ) : (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => setClaiming(true)}>
                Choose my worksheet
              </Button>
            }
          >
            No vehicles yet. Pick your sheet in the fleet workbook and your vehicles
            will appear here, or use <strong>Add vehicle</strong>.
          </Alert>
        )
      )}

      {/* BULK ACTIONS (tick rows in the table) */}
      {selectedIds.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            mb: "12px",
            p: "10px 14px",
            borderRadius: "4px",
            backgroundColor: colors.blueAccent[800] ?? colors.primary[400],
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>{selectedIds.length} selected</Typography>
          {isAdmin && (
            <>
              <TextField
                select
                size="small"
                label="Assign to"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                sx={{ minWidth: 220 }}
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
              <Button
                variant="contained"
                color="secondary"
                startIcon={<AssignmentIndOutlinedIcon />}
                disabled={!assignTo}
                onClick={assignSelected}
              >
                Assign
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineOutlinedIcon />}
            onClick={() => setBulkDeleting(true)}
          >
            Delete selected
          </Button>
          <Button color="inherit" onClick={clearSelection}>
            Clear selection
          </Button>
        </Box>
      )}
      {bulkMessage && (
        <Alert severity={bulkMessage.severity} sx={{ mb: 2 }} onClose={() => setBulkMessage(null)}>
          {bulkMessage.text}
        </Alert>
      )}

      {/* FILTERS */}
      <Box sx={{ mb: "12px" }}>
        <VehicleFilters
          vehicles={scope}
          value={filters}
          onChange={(next) => {
            setFilters(next);
            clearSelection();
          }}
        />
      </Box>

      {/* TABLE */}
      <Box sx={{ height: "60vh", minHeight: 360, ...gridSx(colors) }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          density="compact"
          showToolbar
          disableColumnFilter
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={selection}
          onRowSelectionModelChange={setSelection}
          onRowDoubleClick={({ row }) => openEdit(row.vehicle)}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
          pageSizeOptions={[25, 50, 100]}
        />
      </Box>

      {dialogs}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {claiming && <ClaimSheetDialog onClose={() => setClaiming(false)} />}
      <ConfirmDialog
        open={bulkDeleting}
        title={`Delete ${selectedIds.length} vehicle(s)?`}
        message="Their status, maintenance records and block records are deleted too. This can't be undone."
        confirmLabel="Delete vehicles"
        onConfirm={async () => {
          const { deleted } = await deleteVehicles(selectedIds);
          clearSelection();
          setBulkMessage({ severity: "success", text: `${deleted} vehicle(s) deleted.` });
        }}
        onClose={() => setBulkDeleting(false)}
      />
    </Box>
  );
};

export default Vehicles;
