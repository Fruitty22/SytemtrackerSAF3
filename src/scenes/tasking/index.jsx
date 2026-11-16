import { useMemo, useState } from "react";
import { Alert, Box, MenuItem, TextField, Typography, useTheme } from "@mui/material";
import Header from "../../components/Header";
import StatBox from "../../components/StatBox";
import { ReasonTable, TaskingGroups } from "../../components/TaskingViews";
import { StepPicker } from "../../components/ShowMore";
import { useAuth } from "../../auth/AuthContext";
import { useVehicles } from "../../data/VehiclesContext";
import { managedBy } from "../../utils/vehicle";
import { DEPLOY_LABELS, UNASSIGNED } from "../../../shared/config.js";

const ALL = "ALL";

const Panel = ({ title, hint, children }) => (
  <Box sx={{ backgroundColor: "background.paper", borderRadius: "4px", p: { xs: 1.5, sm: 2 } }}>
    <Typography variant="h5" sx={{ fontWeight: 700 }}>
      {title}
    </Typography>
    {hint && (
      <Typography variant="body2" sx={{ opacity: 0.7, mb: 1.5 }}>
        {hint}
      </Typography>
    )}
    {children}
  </Box>
);

// TASKING: who is out on what, and why the rest are not available.
// Fleet Commanders see their own vehicles; the Admin can pick anyone.
const Tasking = () => {
  const theme = useTheme();
  const { user, isAdmin } = useAuth();
  const { vehicles, users, loading, error, deployOf } = useVehicles();
  const [who, setWho] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [step, setStep] = useState(5); // MIDs shown per group: 5, 10, 15, 20 or All
  const [mid, setMid] = useState("");

  // the server already only sends a commander their own vehicles
  const scoped = useMemo(
    () => (isAdmin && who !== ALL ? vehicles.filter((v) => managedBy(v, who)) : vehicles),
    [vehicles, isAdmin, who]
  );
  const types = useMemo(() => [...new Set(scoped.map((v) => v.type))].sort((a, b) => a.localeCompare(b)), [scoped]);
    const shown = useMemo(() => {
    const q = mid.trim().toUpperCase();
    return scoped.filter((v) => (type === ALL || v.type === type) && (!q || v.mid.includes(q)));
  }, [scoped, type, mid]);
  
  const onTasking = shown.filter((v) => deployOf(v).tasking).length;
  const count = (status) => shown.filter((v) => deployOf(v).status === status).length;
  const showOwner = isAdmin && (who === ALL || who === UNASSIGNED);
  const effectiveStep = mid.trim() ? Infinity : step;

  return (
    <Box sx={{ m: { xs: "12px", sm: "20px" } }}>
      <Header title="TASKING" subtitle="Which vehicles are out on tasking, and why the others are not available" />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: `repeat(${isAdmin ? 3 : 2}, minmax(0, 260px))` },
          gap: "12px",
          mb: "16px",
        }}
      >
        {isAdmin && (
          <TextField select size="small" label="Fleet commander" value={who} onChange={(e) => setWho(e.target.value)}>
            <MenuItem value={ALL}>Everyone</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
                {u.id === user.id ? " (you)" : ""}
              </MenuItem>
            ))}
            <MenuItem value={UNASSIGNED}>Unassigned</MenuItem>
          </TextField>
        )}
        <TextField select size="small" label="Vehicle type" value={types.includes(type) ? type : ALL} onChange={(e) => setType(e.target.value)}>
          <MenuItem value={ALL}>All types</MenuItem>
          {types.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" label="MID number" placeholder="e.g. 21714" value={mid} onChange={(e) => setMid(e.target.value)} />
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "16px", mb: "20px" }}>
        <StatBox label="On tasking" value={onTasking} color={theme.palette.info.main} />
        <StatBox
          label={DEPLOY_LABELS.deployed}
          value={count("deployed")}
          hint="tasking, self drive, TLOAN, overseas"
          color={theme.palette.info.dark}
        />
        <StatBox label={DEPLOY_LABELS.no} value={count("unavailable")} color={theme.palette.error.main} />
        <StatBox label={DEPLOY_LABELS.yes} value={count("available")} color={theme.palette.success.main} />
      </Box>

      <Box sx={{ mb: "16px" }}>
        <StepPicker value={step} onChange={setStep} />
      </Box>

      {!loading && shown.length === 0 ? (
        <Alert severity="info">No vehicles here.</Alert>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <Panel title={`On tasking (${onTasking})`} hint="Grouped by the TASKING value.">
            <TaskingGroups vehicles={shown} showOwner={showOwner} step={effectiveStep} />
          </Panel>
          <Panel
            title="Not available because"
            hint="Every reason, with how many vehicles. A vehicle with two reasons is counted under both."
          >
            <ReasonTable vehicles={shown} showOwner={showOwner} step={effectiveStep} />
          </Panel>
        </Box>
      )}
    </Box>
  );
};

export default Tasking;
