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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import { MidChips } from "../TaskingViews";
import { ShowMoreButtons, useShowMore } from "../ShowMore";
import { byMid, formatDateTime } from "../../utils/vehicle";
import { DEPLOY_LABELS, DEPLOYED_FIELDS } from "../../../shared/config.js";
import { reasonText } from "../../../shared/deployability.js";
import { formatLongDay, formatRange } from "./dates";

const STATUS_COLOR = { available: "success", deployed: "error", unavailable: "warning" };

// One reason group: "OVERSEAS: XCS (26/09 - 16/10)  5  [Booking]" + its MIDs
const ReasonGroup = ({ group, onVehicle }) => (
  <Box sx={{ p: 1.25, borderRadius: "4px", backgroundColor: "background.default" }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
      <Typography sx={{ fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" }}>{group.text}</Typography>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
        {group.booked > 0 && <Chip size="small" variant="outlined" color="secondary" label={`${group.booked} by booking`} />}
        <Typography sx={{ fontWeight: 700 }}>{group.list.length}</Typography>
      </Box>
    </Box>
    <MidChips vehicles={group.list} step={10} onSelect={onVehicle} />
  </Box>
);

// Every vehicle in a status, one row each (MID, type, why) - click for details
const VehicleRows = ({ list, results, onVehicle, showOwner }) => {
  const state = useShowMore(list.length, 25);
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>MID</TableCell>
            <TableCell>Type</TableCell>
            {showOwner && <TableCell>Managed by</TableCell>}
            <TableCell>Why</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.slice(0, state.limit).map((v) => (
            <TableRow key={v.id} hover onClick={() => onVehicle(v)} sx={{ cursor: "pointer" }}>
              <TableCell sx={{ fontWeight: 700 }}>{v.mid}</TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>{v.type}</TableCell>
              {showOwner && <TableCell>{v.ownerName}</TableCell>}
              <TableCell>
                {results
                  .get(v.id)
                  .reasons.map((r) => `${reasonText(r)}${r.scheduled ? " (booking)" : ""}`)
                  .join(", ") || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {(state.hidden > 0 || state.expanded) && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", pt: 1, flexWrap: "wrap" }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Showing {state.limit} of {list.length}
          </Typography>
          <ShowMoreButtons state={state} />
        </Box>
      )}
    </Box>
  );
};

// THE DAY VIEW: click a day on the calendar.
//   Today:       the real status of every (filtered) vehicle
//   Future day:  what's set on the vehicles now (assumed to carry on) + bookings that day
//   Past day:    bookings only (statuses aren't recorded day by day)
export const DayPanel = ({ date, today, vehicles, day, bookings, renderBooking, onVehicle, onNew, onClose }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const [mode, setMode] = useState("reason"); // reason | vehicle
  const showOwner = vehicles.some((v, i, all) => v.ownerName !== all[0].ownerName);

  const lists = useMemo(() => {
    if (!day) return null;
    const by = { available: [], deployed: [], unavailable: [] };
    for (const v of vehicles) by[day.results.get(v.id).status].push(v);
    for (const k of Object.keys(by)) by[k].sort(byMid);
    // group deployed / unavailable vehicles by reason
    const groups = (status) => {
      const map = new Map();
      for (const v of by[status]) {
        for (const r of day.results.get(v.id).reasons) {
          // deployed vehicles: group by what deploys them; unavailable: by every reason
          if (status === "deployed" && !(r.kind === "block" && DEPLOYED_FIELDS.includes(r.field))) continue;
          const text = reasonText(r);
          const g = map.get(text) ?? { text, list: [], booked: 0 };
          g.list.push(v);
          if (r.scheduled) g.booked += 1;
          map.set(text, g);
        }
      }
      return [...map.values()].sort((a, b) => b.list.length - a.list.length || a.text.localeCompare(b.text));
    };
    return { by, deployedGroups: groups("deployed"), unavailableGroups: groups("unavailable") };
  }, [day, vehicles]);

  const defaultTab = !lists ? "bookings" : lists.by.deployed.length ? "deployed" : lists.by.unavailable.length ? "unavailable" : "available";
  const [tab, setTab] = useState(defaultTab);

  const label = { available: DEPLOY_LABELS.yes, deployed: DEPLOY_LABELS.deployed, unavailable: DEPLOY_LABELS.no };

  const statusTab = (status) => {
    const list = lists.by[status];
    if (list.length === 0) return <Typography sx={{ opacity: 0.7 }}>No {label[status]} vehicles.</Typography>;
    if (status === "available" && mode === "reason") {
      return <MidChips vehicles={list} step={20} onSelect={onVehicle} />;
    }
    if (mode === "vehicle") {
      return <VehicleRows list={list} results={day.results} onVehicle={onVehicle} showOwner={showOwner} />;
    }
    const groups = status === "deployed" ? lists.deployedGroups : lists.unavailableGroups;
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {status === "unavailable" && (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            A vehicle with two reasons is under both.
          </Typography>
        )}
        {groups.map((g) => (
          <ReasonGroup key={g.text} group={g} onVehicle={onVehicle} />
        ))}
      </Box>
    );
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={phone}>
      <DialogTitle sx={{ pb: 1 }}>
        {formatLongDay(date)}
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          {date === today
            ? `Today · ${vehicles.length} vehicle(s)`
            : date > today
              ? `Expected · what's set on the vehicles now, plus the bookings on this day · ${vehicles.length} vehicle(s)`
              : "Past day · statuses aren't recorded day by day, so only bookings are shown"}
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 1 }}>
        {lists && (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1 }}>
            {["available", "deployed", "unavailable"].map((s) => (
              <Box
                key={s}
                component="button"
                type="button"
                onClick={() => setTab(s)}
                sx={{
                  all: "unset",
                  cursor: "pointer",
                  p: { xs: 1, sm: 1.5 },
                  borderRadius: "4px",
                  backgroundColor: "background.default",
                  borderLeft: `4px solid ${theme.palette[STATUS_COLOR[s]].main}`,
                  outline: tab === s ? `2px solid ${theme.palette[STATUS_COLOR[s]].main}` : "none",
                }}
              >
                <Typography sx={{ fontSize: { xs: 22, sm: 28 }, fontWeight: 700, lineHeight: 1.1 }}>
                  {lists.by[s].length}
                </Typography>
                <Typography sx={{ fontSize: { xs: 11, sm: 13 }, opacity: 0.85 }}>{label[s]}</Typography>
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            textColor="secondary"
            indicatorColor="secondary"
            sx={{ flex: { xs: "1 1 100%", sm: 1 }, minWidth: 0, minHeight: 40, "& .MuiTab-root": { minHeight: 40, py: 0 } }}
          >
            {lists && <Tab value="deployed" label={`${label.deployed} (${lists.by.deployed.length})`} />}
            {lists && <Tab value="unavailable" label={`${label.unavailable} (${lists.by.unavailable.length})`} />}
            {lists && <Tab value="available" label={`${label.available} (${lists.by.available.length})`} />}
            <Tab value="bookings" label={`Bookings (${bookings.length})`} />
          </Tabs>
          {lists && tab !== "bookings" && (
            <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)} sx={{ mb: 0.5 }}>
              <ToggleButton value="reason" sx={{ px: 1.25, py: 0.25 }}>
                By reason
              </ToggleButton>
              <ToggleButton value="vehicle" sx={{ px: 1.25, py: 0.25 }}>
                By vehicle
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>

        {tab === "bookings" ? (
          bookings.length === 0 ? (
            <Typography sx={{ opacity: 0.7 }}>No bookings on this day.</Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>{bookings.map(renderBooking)}</Box>
          )
        ) : (
          lists && statusTab(tab)
        )}
        {lists && tab !== "bookings" && (
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            Click a MID for everything about that vehicle.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button color="inherit" onClick={onClose}>
          Close
        </Button>
        <Button variant="contained" color="secondary" startIcon={<AddOutlinedIcon />} onClick={() => onNew()}>
          New booking
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// A status that is SET ON VEHICLES (blocked field, e.g. "OVERSEAS: XCS") with no
// booking: which vehicles, since when, and a button to put it on dates.
export const StatusGroupDialog = ({ group, vehicles, onVehicle, onPutOnCalendar, onClose }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const list = vehicles.slice().sort(byMid);
  const deployed = group.status === "deployed";
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={phone}>
      <DialogTitle>
        {group.title}
        <Box sx={{ display: "flex", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
          <Chip size="small" color={deployed ? "error" : "warning"} label={deployed ? DEPLOY_LABELS.deployed : DEPLOY_LABELS.no} />
          <Chip size="small" variant="outlined" label={`${list.length} vehicle(s)`} />
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Alert severity="info" variant="outlined">
          This is set on the vehicles themselves ({group.field} on Edit Blocked Vehicles or from the Excel import), not a
          dated booking. It stays on until someone clears it.
          {group.written &&
            ` The text has the dates ${formatRange(group.written.start, group.written.end)}${
              group.written.end < group.end ? ", which have passed, but it's still set" : ""
            }.`}{" "}
          <strong>Put it on the calendar</strong> to give it dates: it then ends by itself.
        </Alert>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>MID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Set</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((v) => {
              const rec = v.blocks?.[group.field];
              return (
                <TableRow key={v.id} hover onClick={() => onVehicle(v)} sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ fontWeight: 700 }}>{v.mid}</TableCell>
                  <TableCell>{v.type}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      {rec?.updatedAt ? formatDateTime(rec.updatedAt) : "-"}
                      {rec?.updatedBy ? ` · ${rec.updatedBy}` : ""}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Close
        </Button>
        <Button variant="contained" color="secondary" startIcon={<EventOutlinedIcon />} onClick={onPutOnCalendar}>
          Put on the calendar
        </Button>
      </DialogActions>
    </Dialog>
  );
};