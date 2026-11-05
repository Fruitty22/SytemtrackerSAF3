import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  LinearProgress,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import Header from "../../components/Header";
import StatBox from "../../components/StatBox";
import { LevelChip } from "../../components/Chips";
import { TaskingGroups } from "../../components/TaskingViews";
import { ShowMoreButtons, useShowMore } from "../../components/ShowMore";
import { tokens } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import { useVehicles } from "../../data/VehiclesContext";
import { byMid, levelInfo, managedBy } from "../../utils/vehicle";
import { DEPLOY_LABELS, UNASSIGNED } from "../../../shared/config.js";
import { hasBlockRecord, reasonText } from "../../../shared/deployability.js";

const ALL = "ALL";

// Counts for a group of vehicles
function summarise(list, deployOf) {
  const total = list.length;
  const ava = list.filter((v) => deployOf(v).ava).length;
  const count = (status) => list.filter((v) => deployOf(v).status === status).length;
  return {
    total,
    ava,
    notAva: total - ava,
    deployed: count("deployed"),
    unavailable: count("unavailable"),
    // vehicles out on a (counted) TASKING
    tasking: list.filter((v) => deployOf(v).tasking).length,
    blocked: list.filter(hasBlockRecord).length,
    // vehicles with a counted maintenance item at N (what needs fixing)
    issues: list.filter((v) => deployOf(v).reasons.some((r) => r.kind === "maintenance")).length,
    readiness: total ? Math.round((ava / total) * 100) : 0,
  };
}

const Panel = ({ title, count, children }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  return (
    <Box sx={{ backgroundColor: colors.primary[400], borderRadius: "4px", p: 2, minWidth: 0 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
        {title}
        {count !== undefined && (
          <Typography component="span" sx={{ ml: 1, color: colors.grey[300] }}>
            ({count})
          </Typography>
        )}
      </Typography>
      <Box sx={{ overflowX: "auto" }}>{children}</Box>
    </Box>
  );
};

// Long tables show 10 rows at first, then "+10 more" / "Show all" / "Show less".
// (Drawing hundreds of rows at once is what made this page slow to open on phones.)
const LimitedRows = ({ items, colSpan, children }) => {
  const state = useShowMore(items.length, 10);
  return (
    <>
      {items.slice(0, state.limit).map(children)}
      {(state.hidden > 0 || state.expanded) && (
        <TableRow>
          <TableCell colSpan={colSpan} sx={{ borderBottom: 0 }}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Showing {state.limit} of {items.length}
              </Typography>
              <ShowMoreButtons state={state} />
            </Box>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

const Empty = ({ children }) => (
  <Typography variant="body2" sx={{ opacity: 0.6, py: 1 }}>
    {children}
  </Typography>
);

const Readiness = ({ value }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 120 }}>
    <LinearProgress
      variant="determinate"
      value={value}
      color={value >= 80 ? "success" : value >= 50 ? "warning" : "error"}
      sx={{ flex: 1, height: 8, borderRadius: 4 }}
    />
    <Typography variant="body2" sx={{ width: 38, textAlign: "right" }}>
      {value}%
    </Typography>
  </Box>
);

// Table of counts per group (vehicle type, or commander)
const SummaryTable = ({ rows, firstColumn }) => (
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell>{firstColumn}</TableCell>
        <TableCell align="right">Total</TableCell>
        <TableCell align="right">{DEPLOY_LABELS.yes}</TableCell>
        <TableCell align="right">{DEPLOY_LABELS.deployed}</TableCell>
        <TableCell align="right">{DEPLOY_LABELS.no}</TableCell>
        <TableCell align="right">Blocked</TableCell>
        <TableCell align="right">Need maintenance</TableCell>
        <TableCell>Readiness</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((r) => (
        <TableRow key={r.key}>
          <TableCell sx={{ fontWeight: 700 }}>{r.label}</TableCell>
          <TableCell align="right">{r.total}</TableCell>
          <TableCell align="right">{r.ava}</TableCell>
          <TableCell align="right">{r.deployed}</TableCell>
          <TableCell align="right">{r.unavailable}</TableCell>
          <TableCell align="right">{r.blocked}</TableCell>
          <TableCell align="right">{r.issues}</TableCell>
          <TableCell>
            <Readiness value={r.readiness} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

// Two pages use this dashboard:
//   Fleet Commander Dashboard (everyone): your OWN vehicles only, no selector
//   NC Dashboard (Admin only, fleetWide): opens on the whole fleet, and the
//     Admin can switch to any commander or to Unassigned
const CommanderDashboard = ({ fleetWide = false }) => {
  const theme = useTheme();
  const { user, isAdmin } = useAuth();
  const { vehicles, users, loading, error, deployOf } = useVehicles();

  const canPick = fleetWide && isAdmin;
  const [picked, setPicked] = useState(ALL);
  const view = canPick ? picked : user.id;

  const mine = useMemo(
    () => (view === ALL ? vehicles : vehicles.filter((v) => managedBy(v, view))).slice().sort(byMid),
    [vehicles, view]
  );
  const stats = useMemo(() => summarise(mine, deployOf), [mine, deployOf]);

  const byType = useMemo(() => {
    const groups = new Map();
    for (const v of mine) groups.set(v.type, [...(groups.get(v.type) ?? []), v]);
    return [...groups.entries()]
      .map(([type, list]) => ({ key: type, label: type, ...summarise(list, deployOf) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mine, deployOf]);

  // "Everyone": one row per account (a shared vehicle counts for each sharer) + Unassigned
  const byCommander = useMemo(() => {
    if (view !== ALL) return [];
    const rows = users.map((u) => ({
      key: u.id,
      label: u.name,
      ...summarise(vehicles.filter((v) => managedBy(v, u.id)), deployOf),
    }));
    const unassigned = vehicles.filter((v) => managedBy(v, UNASSIGNED));
    if (unassigned.length) rows.push({ key: UNASSIGNED, label: "Unassigned", ...summarise(unassigned, deployOf) });
    return rows.filter((r) => r.total > 0);
  }, [view, users, vehicles, deployOf]);

  const notAva = useMemo(() => mine.filter((v) => !deployOf(v).ava), [mine, deployOf]);
  const blocked = useMemo(() => mine.filter(hasBlockRecord), [mine]);
  const itemsN = useMemo(
    () =>
      mine.flatMap((v) =>
        Object.entries(v.maintenance ?? {})
          .filter(([, entry]) => levelInfo(entry.level).problem)
          .map(([field, entry]) => ({ vehicle: v, field, ...entry }))
      ),
    [mine]
  );

  const showOwner = isAdmin && (view === ALL || view === UNASSIGNED);
  const viewName =
    view === ALL
      ? "Whole fleet"
      : view === UNASSIGNED
        ? "Unassigned vehicles"
        : view === user.id
          ? `${user.name}${user.sheets?.length ? ` (${user.sheets.join(", ")})` : ""}`
          : users.find((u) => u.id === view)?.name ?? "...";

  return (
    <Box sx={{ m: { xs: "12px", sm: "20px" } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
        <Header title={fleetWide ? "NC DASHBOARD" : "FLEET COMMANDER DASHBOARD"} subtitle={viewName} />
        {canPick && (
          <TextField
            select
            size="small"
            label="Fleet commander"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            sx={{ minWidth: 260 }}
          >
            <MenuItem value={ALL}>Everyone ({vehicles.length})</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
                {u.id === user.id ? " (you)" : ""} ({vehicles.filter((v) => managedBy(v, u.id)).length})
              </MenuItem>
            ))}
            <MenuItem value={UNASSIGNED}>
              Unassigned ({vehicles.filter((v) => managedBy(v, UNASSIGNED)).length})
            </MenuItem>
          </TextField>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* SUMMARY */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "16px", mb: "20px" }}>
        <StatBox label="Vehicles" value={stats.total} color={theme.palette.info.main} />
        <StatBox
          label={DEPLOY_LABELS.yes}
          value={stats.ava}
          hint={stats.total ? `${stats.readiness}% ready` : undefined}
          color={theme.palette.success.main}
        />
        <StatBox
          label={DEPLOY_LABELS.deployed}
          value={stats.deployed}
          hint="tasking, self drive, TLOAN, overseas"
          color={theme.palette.info.main}
        />
        <StatBox label="On tasking" value={stats.tasking} color={theme.palette.info.dark} />
        <StatBox label={DEPLOY_LABELS.no} value={stats.unavailable} color={theme.palette.error.main} />
        <StatBox label="Blocked" value={stats.blocked} color={theme.palette.error.dark} />
        <StatBox label="Need maintenance (item N)" value={stats.issues} color={theme.palette.warning.main} />
      </Box>

      {!loading && mine.length === 0 ? (
        <Alert severity="info">
          No vehicles here yet.
          {view === user.id && " Link your worksheet (menu at the top right → My worksheet), or add vehicles on Manage Vehicles."}
        </Alert>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {byCommander.length > 0 && (
            <Panel title="By fleet commander" count={byCommander.length}>
              <SummaryTable rows={byCommander} firstColumn="Fleet commander" />
            </Panel>
          )}

          <Panel title="On tasking" count={stats.tasking}>
            <TaskingGroups vehicles={mine} showOwner={showOwner} />
          </Panel>

          <Panel title="By vehicle type" count={byType.length}>
            <SummaryTable rows={byType} firstColumn="Vehicle type" />
          </Panel>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
              gap: "20px",
              alignItems: "start",
            }}
          >
            <Panel title="Not available" count={notAva.length}>
              {notAva.length === 0 ? (
                <Empty>Every vehicle is {DEPLOY_LABELS.yes}.</Empty>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>MID</TableCell>
                      <TableCell>Type</TableCell>
                      {showOwner && <TableCell>Commander</TableCell>}
                      <TableCell>Because</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <LimitedRows key={view} items={notAva} colSpan={showOwner ? 4 : 3}>
                    {(v) => (
                      <TableRow key={v.id}>
                        <TableCell sx={{ fontWeight: 700 }}>{v.mid}</TableCell>
                        <TableCell>{v.type}</TableCell>
                        {showOwner && <TableCell>{v.ownerName}</TableCell>}
                        <TableCell>
                          {deployOf(v).reasons.map(reasonText).join(", ")}
                          {v.statusRemark && (
                            <Typography variant="caption" component="div" sx={{ opacity: 0.7 }}>
                              {v.statusRemark}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    </LimitedRows>
                  </TableBody>
                </Table>
              )}
            </Panel>

            <Panel title="Blocked fields" count={blocked.length}>
              {blocked.length === 0 ? (
                <Empty>No blocked fields set.</Empty>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>MID</TableCell>
                      <TableCell>Type</TableCell>
                      {showOwner && <TableCell>Commander</TableCell>}
                      <TableCell>Fields</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <LimitedRows key={view} items={blocked} colSpan={showOwner ? 4 : 3}>
                    {(v) => (
                      <TableRow key={v.id}>
                        <TableCell sx={{ fontWeight: 700 }}>{v.mid}</TableCell>
                        <TableCell>{v.type}</TableCell>
                        {showOwner && <TableCell>{v.ownerName}</TableCell>}
                        <TableCell>
                          {Object.entries(v.blocks ?? {})
                            .map(([f, e]) => `${f}: ${e.value}`)
                            .join(", ")}
                        </TableCell>
                      </TableRow>
                    )}
                    </LimitedRows>
                  </TableBody>
                </Table>
              )}
            </Panel>

            <Panel title="Maintenance items N" count={itemsN.length}>
              {itemsN.length === 0 ? (
                <Empty>No items marked N.</Empty>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>MID</TableCell>
                      <TableCell>Item</TableCell>
                      <TableCell>Value</TableCell>
                      {showOwner && <TableCell>Commander</TableCell>}
                      <TableCell>Remark</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <LimitedRows key={view} items={itemsN} colSpan={showOwner ? 5 : 4}>
                    {(i) => (
                      <TableRow key={`${i.vehicle.id}-${i.field}`}>
                        <TableCell sx={{ fontWeight: 700 }}>{i.vehicle.mid}</TableCell>
                        <TableCell>{i.field}</TableCell>
                        <TableCell>
                          <LevelChip level={i.level} />
                        </TableCell>
                        {showOwner && <TableCell>{i.vehicle.ownerName}</TableCell>}
                        <TableCell>{i.remark || "-"}</TableCell>
                      </TableRow>
                    )}
                    </LimitedRows>
                  </TableBody>
                </Table>
              )}
            </Panel>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default CommanderDashboard;
