import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  List,
  ListItemButton,
  MenuItem,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import Header from "./Header";
import useVehicleDialogs from "./useVehicleDialogs";
import { tokens } from "../theme";
import { useAuth } from "../auth/AuthContext";
import { useVehicles } from "../data/VehiclesContext";
import { byMid } from "../utils/vehicle";

// The layout shared by the three "Pages" screens, modelled on the Excel forms:
//   left  - Vehicle Type drop-down, Search MID box, and the list of MID numbers
//   right - the editor for the selected vehicle (each page passes its own)
//
// Props:
//   title, subtitle      page header
//   filters              [{ value, label, test(vehicle) }] - extra "Show" drop-down
//   renderBadge(v)       what to show next to each MID in the list
//   renderDetail(v)      the editor for the selected vehicle
//   summary              optional element shown above the two panels
const VehicleWorkspace = ({ title, subtitle, filters, renderBadge, renderDetail, summary }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { isAdmin } = useAuth();
  const { vehicles, loading, error } = useVehicles();

  const [type, setType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState(filters?.[0]?.value ?? "ALL");
  const [selectedId, setSelectedId] = useState(null);

  const { openCreate, openEdit, openDelete, dialogs } = useVehicleDialogs({
    defaultType: type === "ALL" ? "" : type,
    onCreated: (v) => setSelectedId(v.id),
    onDeleted: () => setSelectedId(null),
  });

  const typeCounts = useMemo(() => {
    const counts = new Map();
    for (const v of vehicles) counts.set(v.type, (counts.get(v.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [vehicles]);

  const activeFilter = filters?.find((f) => f.value === show);
  const query = search.trim().toUpperCase();
  const list = useMemo(
    () =>
      vehicles
        .filter(
          (v) =>
            (type === "ALL" || v.type === type) &&
            (!query || v.mid.includes(query)) &&
            (!activeFilter || activeFilter.test(v))
        )
        .sort(byMid),
    [vehicles, type, query, activeFilter]
  );

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  return (
    <Box sx={{ m: "20px" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
        <Header title={title} subtitle={subtitle} />
        <Button variant="contained" color="secondary" startIcon={<AddOutlinedIcon />} onClick={openCreate}>
          Add vehicle
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {summary}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 380px) 1fr" },
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* LEFT: pick a vehicle */}
        <Box sx={{ backgroundColor: colors.primary[400], borderRadius: "4px", p: 2 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 1.5 }}>
            <TextField select size="small" label="Vehicle type" value={type} onChange={(e) => setType(e.target.value)}>
              <MenuItem value="ALL">All types ({vehicles.length})</MenuItem>
              {typeCounts.map(([t, n]) => (
                <MenuItem key={t} value={t}>
                  {t} ({n})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Search MID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {filters && (
              <TextField select size="small" label="Show" value={show} onChange={(e) => setShow(e.target.value)}>
                {filters.map((f) => (
                  <MenuItem key={f.value} value={f.value}>
                    {f.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>

          <Typography variant="h6" sx={{ color: colors.grey[300], mb: 0.5 }}>
            MID number ({list.length})
          </Typography>
          <List
            dense
            disablePadding
            sx={{
              maxHeight: { xs: 300, md: "52vh" },
              overflowY: "auto",
              backgroundColor: "background.default",
              borderRadius: "4px",
            }}
          >
            {list.map((v) => (
              <ListItemButton
                key={v.id}
                selected={v.id === selectedId}
                onClick={() => setSelectedId(v.id)}
                sx={{ display: "flex", gap: 1, alignItems: "center" }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{v.mid}</Typography>
                  {(type === "ALL" || isAdmin) && (
                    <Typography variant="caption" sx={{ color: colors.grey[300] }} noWrap component="div">
                      {type === "ALL" ? v.type : ""}
                      {type === "ALL" && isAdmin ? " · " : ""}
                      {isAdmin ? v.ownerName : ""}
                    </Typography>
                  )}
                </Box>
                {renderBadge?.(v)}
              </ListItemButton>
            ))}
            {list.length === 0 && (
              <Typography sx={{ p: 2, color: colors.grey[300] }}>
                {loading ? "Loading..." : vehicles.length === 0 ? "No vehicles yet. Add one, or import them on Manage Vehicles." : "No vehicles match."}
              </Typography>
            )}
          </List>
        </Box>

        {/* RIGHT: edit the selected vehicle */}
        <Box sx={{ backgroundColor: colors.primary[400], borderRadius: "4px", p: { xs: 2, sm: 3 }, minHeight: 300 }}>
          {selected ? (
            <>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap", mb: 2 }}>
                <Box>
                  <Typography variant="h2" sx={{ fontWeight: "bold", color: colors.grey[100] }}>
                    {selected.mid}
                  </Typography>
                  <Typography variant="h5" sx={{ color: colors.greenAccent[400] }}>
                    {selected.type}
                    {isAdmin ? ` · ${selected.ownerName}` : ""}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button size="small" color="inherit" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(selected)}>
                    Edit details
                  </Button>
                  <Button size="small" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => openDelete(selected)}>
                    Delete
                  </Button>
                </Box>
              </Box>
              {/* key: the editor starts fresh for each vehicle */}
              <Box key={selected.id}>{renderDetail(selected)}</Box>
            </>
          ) : (
            <Box sx={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ color: colors.grey[300] }}>
                Select a vehicle from the list on the left.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {dialogs}
    </Box>
  );
};

export default VehicleWorkspace;
