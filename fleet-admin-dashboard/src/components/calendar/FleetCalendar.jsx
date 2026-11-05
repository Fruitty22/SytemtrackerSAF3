import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { useVehicles } from "../../data/VehiclesContext";
import { MidChips } from "../TaskingViews";
import { tokens } from "../../theme";
import { DEPLOYED_FIELDS, SCHEDULE_KINDS } from "../../../shared/config.js";
import { deployability } from "../../../shared/deployability.js";
import { addDays, datesInText, daysBetween, eventsByVehicleOn, isoDate, kindOf, onDate } from "../../../shared/schedule.js";
import EventDialog from "./EventDialog";
import { DayPanel, StatusGroupDialog } from "./DayPanel";
import VehicleDetailDialog from "../VehicleDetailDialog";
import {
  addMonths,
  endOfMonth,
  formatDay,
  formatLongDay,
  formatMonth,
  formatRange,
  formatWeek,
  monthWeeks,
  startOfMonth,
  startOfWeek,
  weekdayNames,
} from "./dates";

// THE FLEET CALENDAR (Manage Vehicles -> View: Calendar)
//
//   Month  - like Google Calendar: bookings as bars across the days,
//            "21/49 free" on every day from today on
//   Week   - one week, every booking with its times and vehicles
//   List   - this month's bookings one under the other (the default on phones)
//
//   Click a day                            -> that day: how many available / deployed /
//                                             unavailable, which vehicles and why, bookings
//   Drag across days (or "+ Booking")      -> new booking for those dates
//   Click a booking                        -> edit / delete it
//   Drag a booking to another day          -> move it (phones: press and hold first)
//   Outlined bars                          -> statuses set on vehicles (Edit Blocked
//                                             Vehicles / import) that have no booking:
//                                             from when they were set (or the dates in
//                                             their text) until today, since they're still on
//
// `vehicles` = the vehicles currently shown on Manage Vehicles (after the
// filters), so the filters narrow the calendar too.

const LANE_HEIGHT = 22;
const DAY_HEADER = 26;
const VIEW_KEY = "fleet.calendarView";

const readView = (phone) => {
  try {
    return localStorage.getItem(VIEW_KEY) || (phone ? "list" : "month");
  } catch {
    return phone ? "list" : "month";
  }
};

// Lay out the bookings of one week in rows ("lanes"), like Google Calendar:
// each booking is one bar from its first to its last day in that week.
function layoutWeek(weekStart, events) {
  const weekEnd = addDays(weekStart, 6);
  const segments = events
    .filter((e) => e.start <= weekEnd && e.end >= weekStart)
    .map((e) => ({
      event: e,
      from: Math.max(0, daysBetween(weekStart, e.start)),
      to: Math.min(6, daysBetween(weekStart, e.end)),
      startsBefore: e.start < weekStart,
      endsAfter: e.end > weekEnd,
    }))
    // bookings get the top rows; "set on vehicles" status bars go under them
    .sort(
      (a, b) =>
        (a.event.kind === "status") - (b.event.kind === "status") ||
        a.from - b.from ||
        b.to - b.from - (a.to - a.from) ||
        a.event.title.localeCompare(b.event.title)
    );
  const laneEnds = [];
  for (const s of segments) {
    let lane = laneEnds.findIndex((end) => end < s.from);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = s.to;
    s.lane = lane;
  }
  return { segments, lanes: laneEnds.length };
}

// which date is under the pointer (cells carry data-date)
const dateAt = (x, y) => {
  for (const el of document.elementsFromPoint(x, y)) {
    const date = el.closest?.("[data-date]")?.dataset.date;
    if (date) return date;
  }
  return null;
};

const FleetCalendar = ({ vehicles, onEditVehicle }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const phone = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const { events, today, disregards, deployOf, updateEvent } = useVehicles();

  const [view, setViewState] = useState(() => readView(phone));
  const [cursor, setCursor] = useState(today); // the date the calendar is on
  const [hiddenKinds, setHiddenKinds] = useState([]); // legend toggles
  const [editing, setEditing] = useState(null); // booking or draft in the dialog
  const [dayOpen, setDayOpen] = useState(null); // date of the day panel
  const [range, setRange] = useState(null); // { a, b } while dragging across days
  const [moving, setMoving] = useState(null); // { id, delta } while dragging a booking
  const [moveError, setMoveError] = useState("");
  const [showStatus, setShowStatus] = useState(true); // outlined "set on vehicles" bars
  const [statusOpen, setStatusOpen] = useState(null); // a status bar's group
  const [detail, setDetail] = useState(null); // vehicle details dialog
  const gesture = useRef(null);
  // A tap on a phone is followed by a "click" on whatever is under the finger.
  // Opening a dialog on the tap itself would let that click land inside the new
  // dialog (e.g. untick "All day"), so phone taps open things on the click instead.
  const pendingTap = useRef(null);

  const setView = (v) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not saved - fine */
    }
  };

  // ---- which bookings and vehicles

  const shownIds = useMemo(() => new Set(vehicles.map((v) => v.id)), [vehicles]);
  const byId = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  // status of every vehicle with NO calendar bookings (what's set on the vehicle)
  const baseMap = useMemo(
    () => new Map(vehicles.map((v) => [v.id, deployability(v, disregards)])),
    [vehicles, disregards]
  );

  // Statuses set on vehicles (blocked fields) grouped by value, as calendar
  // bars: "OVERSEAS: XCS (26/09 - 16/10)" on 5 vehicles. They run from the dates
  // written in the value (or the day the field was set) until today at least,
  // because the field is still set.
  const statusEvents = useMemo(() => {
    const groups = new Map();
    for (const v of vehicles) {
      for (const r of baseMap.get(v.id).blockRows) {
        if (!r.blocks) continue;
        const key = `${r.field}|${r.value}`;
        const g = groups.get(key) ?? { field: r.field, value: r.value, vehicleIds: [], setDates: [] };
        g.vehicleIds.push(v.id);
        const at = v.blocks?.[r.field]?.updatedAt;
        if (at) g.setDates.push(isoDate(new Date(at)));
        groups.set(key, g);
      }
    }
    return [...groups.values()].map((g) => {
      const written = datesInText(g.value, today);
      const setOn = g.setDates.sort()[0] ?? today;
      const start = written?.start ?? setOn;
      const end = written && written.end > today ? written.end : today;
      return {
        id: `status:${g.field}|${g.value}`,
        kind: "status",
        status: DEPLOYED_FIELDS.includes(g.field) ? "deployed" : "unavailable",
        field: g.field,
        value: g.value,
        title: `${g.field}: ${g.value}`,
        start: start > end ? end : start,
        end,
        written,
        setOn,
        vehicleIds: g.vehicleIds,
      };
    });
  }, [vehicles, baseMap, today]);

  // bookings about the shown vehicles (+ reminders with no vehicles)
  const bookingEvents = useMemo(
    () =>
      events
        .filter((e) => !hiddenKinds.includes(e.kind))
        .filter((e) => e.vehicleIds.length === 0 || e.vehicleIds.some((id) => shownIds.has(id)))
        .map((e) =>
          moving && moving.id === e.id
            ? { ...e, start: addDays(e.start, moving.delta), end: addDays(e.end, moving.delta) }
            : e
        ),
    [events, hiddenKinds, shownIds, moving]
  );
  const visibleEvents = useMemo(
    () => (showStatus ? [...bookingEvents, ...statusEvents] : bookingEvents),
    [bookingEvents, statusEvents, showStatus]
  );

  // Each vehicle's status on a day, from today on: what's set on the vehicle now
  // (assumed to carry on until someone clears it) plus that day's bookings.
  // Past days: null (statuses aren't recorded day by day; bookings still show).
  const statusCache = useMemo(() => new Map(), [vehicles, events, disregards, deployOf, baseMap, today]);
  const statusOn = useCallback(
    (iso) => {
      if (iso < today) return null;
      if (statusCache.has(iso)) return statusCache.get(iso);
      const booked = eventsByVehicleOn(events, iso);
      const results = new Map();
      const counts = { available: 0, deployed: 0, unavailable: 0 };
      for (const v of vehicles) {
        const r =
          iso === today
            ? deployOf(v)
            : booked.has(v.id)
              ? deployability(v, disregards, booked.get(v.id))
              : baseMap.get(v.id);
        results.set(v.id, r);
        counts[r.status] += 1;
      }
      const day = { results, counts };
      statusCache.set(iso, day);
      return day;
    },
    [statusCache, today, events, vehicles, deployOf, disregards, baseMap]
  );

  // "20 · 9 · 20" (available · deployed · unavailable) for a day
  const countsLine = (iso, size = 11) => {
    const day = statusOn(iso);
    if (!day) return null;
    const { available, deployed, unavailable } = day.counts;
    return (
      <Box
        component="span"
        title={`${available} available · ${deployed} deployed · ${unavailable} unavailable${iso > today ? " (expected)" : ""}`}
        sx={{ fontSize: size, fontWeight: 700, whiteSpace: "nowrap", display: "inline-flex", gap: "5px" }}
      >
        <span style={{ color: theme.palette.success.main }}>{available}</span>
        <span style={{ color: theme.palette.error.main }}>{deployed}</span>
        <span style={{ color: theme.palette.warning.main }}>{unavailable}</span>
      </Box>
    );
  };

  // ---- pointer gestures: drag across days (new booking), drag a booking (move)

  const openNew = (a, b) => {
    const [start, end] = a <= b ? [a, b] : [b, a];
    setEditing({ start, end, kind: "tasking" });
  };

  const endGesture = useCallback(() => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.timer) clearTimeout(g.timer);
    window.removeEventListener("pointermove", g?.onMove);
    window.removeEventListener("pointerup", g?.onUp);
    window.removeEventListener("pointercancel", g?.onCancel);
    window.removeEventListener("touchmove", g?.onTouchMove);
  }, []);
  useEffect(() => endGesture, [endGesture]);

  const startGesture = (g) => {
    endGesture();
    gesture.current = g;
    g.onMove = (ev) => {
      const moved = Math.hypot(ev.clientX - g.x, ev.clientY - g.y) > 6;
      if (!g.active) {
        if (!moved) return;
        if (g.touch) {
          // touch: moving before the long-press = scrolling
          if (g.type === "range" || !g.held) {
            if (g.type === "range") g.cancelled = true;
            else endGesture();
            return;
          }
        }
        g.active = true;
      }
      const date = dateAt(ev.clientX, ev.clientY);
      if (!date) return;
      if (g.type === "range") setRange({ a: g.date, b: date });
      else setMoving({ id: g.event.id, delta: daysBetween(g.date, date) });
    };
    g.onTouchMove = (ev) => {
      if (g.active) ev.preventDefault(); // don't scroll while dragging a booking
    };
    g.onUp = (ev) => {
      const done = gesture.current;
      endGesture();
      if (!done) return;
      if (done.type === "range") {
        setRange(null);
        if (done.cancelled) return;
        if (done.touch) {
          pendingTap.current = { type: "day", date: done.date };
          return;
        }
        const date = (done.active && dateAt(ev.clientX, ev.clientY)) || done.date;
        if (date !== done.date) openNew(done.date, date);
        else setDayOpen(done.date);
      } else {
        const date = done.active ? dateAt(ev.clientX, ev.clientY) : null;
        const delta = date ? daysBetween(done.date, date) : 0;
        if (done.active && delta !== 0) {
          // move the booking; keep it shown where it was dropped until saved
          updateEvent(done.event.id, {
            start: addDays(done.event.start, delta),
            end: addDays(done.event.end, delta),
          })
            .catch((err) => setMoveError(err.message))
            .finally(() => setMoving(null));
        } else {
          setMoving(null);
          if (!done.active) {
            if (done.touch) pendingTap.current = { type: "event", event: done.event };
            else setEditing(done.event);
          }
        }
      }
    };
    g.onCancel = () => {
      endGesture();
      setRange(null);
      setMoving(null);
    };
    window.addEventListener("pointermove", g.onMove);
    window.addEventListener("pointerup", g.onUp);
    window.addEventListener("pointercancel", g.onCancel);
    window.addEventListener("touchmove", g.onTouchMove, { passive: false });
  };

  const onDayPointerDown = (ev, date) => {
    if (ev.button !== 0) return;
    const touch = ev.pointerType !== "mouse";
    startGesture({ type: "range", date, x: ev.clientX, y: ev.clientY, touch });
    if (!touch) setRange({ a: date, b: date });
  };

  const onEventPointerDown = (ev, event) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    const touch = ev.pointerType !== "mouse";
    const date = dateAt(ev.clientX, ev.clientY) ?? event.start;
    const g = { type: "move", event, date, x: ev.clientX, y: ev.clientY, touch };
    if (touch) {
      // phones: press and hold to pick a booking up
      g.timer = setTimeout(() => {
        g.held = true;
        g.active = true;
        navigator.vibrate?.(15);
        setMoving({ id: event.id, delta: 0 });
      }, 350);
    }
    startGesture(g);
  };

  const inRange = (date) => {
    if (!range) return false;
    const [a, b] = range.a <= range.b ? [range.a, range.b] : [range.b, range.a];
    return a <= date && date <= b;
  };

  // ---- navigation

  const step = (n) => {
    if (view === "week") setCursor((c) => addDays(c, 7 * n));
    else setCursor((c) => addMonths(c, n));
  };
  const title = view === "week" ? formatWeek(startOfWeek(cursor)) : formatMonth(cursor);

  // ---- pieces

  const bar = (seg, detailed) => {
    const e = seg.event;
    if (e.kind === "status") return statusBar(seg, detailed);
    const k = kindOf(e.kind);
    const mids = e.vehicleIds.map((id) => byId.get(id)?.mid).filter(Boolean);
    const time = e.startTime ? `${e.startTime}${e.endTime ? `–${e.endTime}` : ""} ` : "";
    return (
      <Box
        key={e.id}
        className="bar"
        onPointerDown={(ev) => onEventPointerDown(ev, e)}
        onClick={() => {
          const tap = pendingTap.current;
          pendingTap.current = null;
          if (tap?.type === "event") setEditing(tap.event);
        }}
        title={`${e.title} (${k.label}) · ${formatRange(e.start, e.end)}${mids.length ? ` · ${mids.join(", ")}` : ""}`}
        sx={{
          gridColumn: `${seg.from + 1} / ${seg.to + 2}`,
          gridRow: seg.lane + 1,
          height: detailed ? "auto" : LANE_HEIGHT - 3,
          minHeight: LANE_HEIGHT - 3,
          mx: "3px",
          px: 0.75,
          display: "flex",
          flexDirection: detailed ? "column" : "row",
          alignItems: detailed ? "flex-start" : "center",
          gap: 0.5,
          pointerEvents: "auto",
          cursor: "pointer",
          userSelect: "none",
          touchAction: "pan-y",
          backgroundColor: k.color,
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.3,
          overflow: "hidden",
          whiteSpace: detailed ? "normal" : "nowrap",
          borderRadius: `${seg.startsBefore ? 0 : 4}px ${seg.endsAfter ? 0 : 4}px ${seg.endsAfter ? 0 : 4}px ${seg.startsBefore ? 0 : 4}px`,
          opacity: moving?.id === e.id ? 0.75 : 1,
          boxShadow: moving?.id === e.id ? 4 : 0,
          "&:hover": { filter: "brightness(1.1)" },
        }}
      >
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
          {time}
          {e.title}
          {!detailed && mids.length > 0 && <span style={{ opacity: 0.85, fontWeight: 400 }}> · {mids.length}</span>}
        </Box>
        {detailed && (
          <Box component="span" sx={{ fontWeight: 400, opacity: 0.9, fontSize: 11 }}>
            {k.label}
            {e.tasking ? ` · ${e.field || "TASKING"}: ${e.tasking}` : ""}
            {mids.length ? ` · ${mids.length > 6 ? `${mids.slice(0, 6).join(", ")} +${mids.length - 6}` : mids.join(", ")}` : ""}
          </Box>
        )}
      </Box>
    );
  };

  // An outlined bar for a status set on vehicles (no booking): click for details
  const statusBar = (seg, detailed) => {
    const e = seg.event;
    const color = e.status === "deployed" ? theme.palette.error.main : theme.palette.warning.main;
    return (
      <Box
        key={e.id}
        className="bar"
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={() => setStatusOpen(e)}
        title={`${e.title} · ${e.vehicleIds.length} vehicle(s) · set on the vehicles, still on today. Click for details.`}
        sx={{
          gridColumn: `${seg.from + 1} / ${seg.to + 2}`,
          gridRow: seg.lane + 1,
          height: detailed ? "auto" : LANE_HEIGHT - 3,
          minHeight: LANE_HEIGHT - 3,
          mx: "3px",
          px: 0.75,
          display: "flex",
          alignItems: "center",
          pointerEvents: "auto",
          cursor: "pointer",
          userSelect: "none",
          border: `1.5px dashed ${color}`,
          backgroundColor: `${color}`,
          color: "#0b1220",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.3,
          overflow: "hidden",
          whiteSpace: detailed ? "normal" : "nowrap",
          borderRadius: `${seg.startsBefore ? 0 : 4}px ${seg.endsAfter ? 0 : 4}px ${seg.endsAfter ? 0 : 4}px ${seg.startsBefore ? 0 : 4}px`,
          "&:hover": { filter: "brightness(1.1)" },
        }}
      >
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
          {e.title}
          <span style={{ fontWeight: 400 }}> · {e.vehicleIds.length}</span>
        </Box>
      </Box>
    );
  };

  // one week row: 7 day cells behind, booking bars on top
  const weekRow = ({ weekStart, month, maxLanes, detailed, minHeight }) => {
    const { segments } = layoutWeek(weekStart, visibleEvents);
    const shownSegs = segments.filter((s) => s.lane < maxLanes);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hiddenOn = days.map((_, col) => segments.filter((s) => s.lane >= maxLanes && s.from <= col && col <= s.to).length);
    return (
      <Box key={weekStart} sx={{ position: "relative", minHeight, borderTop: 1, borderColor: "divider" }}>
        {/* day cells */}
        <Box sx={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {days.map((date, col) => {
            const outside = month && date.slice(0, 7) !== month;
            const isToday = date === today;
            return (
              <Box
                key={date}
                data-date={date}
                onPointerDown={(ev) => onDayPointerDown(ev, date)}
                onClick={() => {
                  const tap = pendingTap.current;
                  pendingTap.current = null;
                  if (tap?.type === "day") setDayOpen(tap.date);
                }}
                sx={{
                  borderLeft: col ? 1 : 0,
                  borderColor: "divider",
                  backgroundColor: inRange(date)
                    ? "rgba(104, 112, 250, 0.25)"
                    : outside
                      ? "action.hover"
                      : "transparent",
                  cursor: "pointer",
                  userSelect: "none",
                  touchAction: "pan-y",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  p: "3px 4px",
                  minWidth: 0,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 0.5, height: DAY_HEADER - 6 }}>
                  <Box
                    component="button"
                    type="button"
                    onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={() => setDayOpen(date)}
                    title="See this day"
                    sx={{
                      all: "unset",
                      cursor: "pointer",
                      minWidth: 22,
                      height: 22,
                      px: 0.5,
                      borderRadius: "11px",
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? "#fff" : outside ? "text.disabled" : "text.primary",
                      backgroundColor: isToday ? "#6870fa" : "transparent",
                      "&:hover": { backgroundColor: isToday ? "#6870fa" : "action.selected" },
                    }}
                  >
                    {Number(date.slice(8))}
                  </Box>
                  {!phone && countsLine(date)}
                </Box>
                {hiddenOn[col] > 0 && (
                  <Box
                    component="button"
                    type="button"
                    onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={() => setDayOpen(date)}
                    sx={{
                      all: "unset",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      px: 0.5,
                      borderRadius: "4px",
                      "&:hover": { backgroundColor: "action.selected" },
                    }}
                  >
                    +{hiddenOn[col]} more
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
        {/* booking bars */}
        <Box
          sx={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gridAutoRows: detailed ? "auto" : `${LANE_HEIGHT}px`,
            rowGap: detailed ? "4px" : 0,
            pt: `${DAY_HEADER}px`,
            pb: detailed ? 1 : 0,
            pointerEvents: "none",
          }}
        >
          {shownSegs.map((seg) => (
            bar(seg, detailed)
          ))}
        </Box>
      </Box>
    );
  };

  const dayNames = () => (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
      {weekdayNames().map((d) => (
        <Typography key={d} sx={{ fontSize: 12, fontWeight: 700, textAlign: "center", py: 0.75, color: colors.grey[300] }}>
          {phone ? d[0] : d}
        </Typography>
      ))}
    </Box>
  );

  const monthView = () => {
    const month = cursor.slice(0, 7);
    const lanes = phone ? 2 : 3;
    return (
      <Box>
        {dayNames()}
        {monthWeeks(cursor).map((w) => (
          weekRow({ weekStart: w, month, maxLanes: lanes, minHeight: DAY_HEADER + lanes * LANE_HEIGHT + 20 })
        ))}
      </Box>
    );
  };

  const weekView = () => {
    const ws = startOfWeek(cursor);
    return (
      <Box>
        {dayNames()}
        {weekRow({ weekStart: ws, maxLanes: Infinity, detailed: true, minHeight: phone ? 260 : 360 })}
        {/* bird's eye: available · deployed · unavailable per day */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderTop: 1, borderColor: "divider" }}>
          {Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d) => (
            <Box
              key={d}
              component="button"
              type="button"
              onClick={() => setDayOpen(d)}
              sx={{ all: "unset", cursor: "pointer", textAlign: "center", py: 0.75, "&:hover": { backgroundColor: "action.hover" } }}
            >
              {countsLine(d, phone ? 10 : 12)}
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  const eventCard = (e, onDay) => {
    const k = kindOf(e.kind);
    const list = e.vehicleIds.map((id) => byId.get(id)).filter(Boolean);
    return (
      <Box
        key={e.id}
        onClick={() => setEditing(e)}
        sx={{
          cursor: "pointer",
          backgroundColor: "background.default",
          borderRadius: "4px",
          borderLeft: `4px solid ${k.color}`,
          p: 1.25,
          "&:hover": { backgroundColor: "action.hover" },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
          <Typography sx={{ fontWeight: 700 }}>{e.title}</Typography>
          <Typography variant="caption" sx={{ color: k.color, fontWeight: 700 }}>
            {k.label}
            {e.tasking ? ` · ${e.field || "TASKING"}: ${e.tasking}` : ""}
          </Typography>
        </Box>
        <Typography variant="caption" component="div" sx={{ opacity: 0.8, mb: list.length ? 0.75 : 0 }}>
          {formatRange(e.start, e.end)}
          {e.startTime ? ` · ${e.startTime}${e.endTime ? `–${e.endTime}` : ""}` : " · all day"}
          {onDay && e.start !== e.end ? ` · day ${daysBetween(e.start, onDay) + 1} of ${daysBetween(e.start, e.end) + 1}` : ""}
          {list.length ? ` · ${list.length} vehicle(s)` : ""}
          {e.otherVehicles ? ` (+${e.otherVehicles} of other commanders)` : ""}
        </Typography>
        {list.length > 0 && (
          <Box onClick={(ev) => ev.stopPropagation()}>
            <MidChips vehicles={list} onSelect={setDetail} />
          </Box>
        )}
        {e.notes && (
          <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8, whiteSpace: "pre-wrap" }}>
            {e.notes}
          </Typography>
        )}
      </Box>
    );
  };

  const listView = () => {
    const from = startOfMonth(cursor);
    const to = endOfMonth(cursor);
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const list = bookingEvents.filter((e) => onDate(e, d) && (e.start === d || d === from));
      if (list.length) days.push({ d, list });
    }
    // statuses set on vehicles that are on in this month (they're all still on today)
    const ongoing = showStatus && from <= today && today <= to ? statusEvents : [];
    const ongoingBlock = ongoing.length > 0 && (
      <Box sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, mb: 0.75 }}>Set on vehicles now (no booking)</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fill, minmax(260px, 1fr))" }, gap: 1 }}>
          {ongoing
            .slice()
            .sort((a, b) => b.vehicleIds.length - a.vehicleIds.length)
            .map((e) => {
              const color = e.status === "deployed" ? theme.palette.error.main : theme.palette.warning.main;
              return (
                <Box
                  key={e.id}
                  onClick={() => setStatusOpen(e)}
                  sx={{
                    cursor: "pointer",
                    p: 1,
                    borderRadius: "4px",
                    border: `1.5px dashed ${color}`,
                    "&:hover": { backgroundColor: "action.hover" },
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color, fontSize: 14 }}>{e.title}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {e.vehicleIds.length} vehicle(s) · {e.status === "deployed" ? "DEPLOYED" : "UNAVAILABLE"}
                    {e.written ? ` · ${formatRange(e.written.start, e.written.end)}` : ` · since ${formatRange(e.setOn, e.setOn)}`}
                  </Typography>
                </Box>
              );
            })}
        </Box>
      </Box>
    );
    if (!days.length) {
      return (
        <Box sx={{ pt: 1 }}>
        {ongoingBlock}
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography sx={{ opacity: 0.7, mb: 1 }}>No bookings in {formatMonth(cursor)}.</Typography>
          <Button color="secondary" startIcon={<AddOutlinedIcon />} onClick={() => openNew(today >= from && today <= to ? today : from, today >= from && today <= to ? today : from)}>
            New booking
          </Button>
        </Box>
        </Box>
      );
    }
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        {ongoingBlock}
        {days.map(({ d, list }) => (
          <Box key={d} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "130px 1fr" }, gap: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: d === today ? "#868dfb" : "text.primary" }}>
                {formatDay(d)}
                {d === today ? " · today" : ""}
              </Typography>
              <Box component="button" type="button" onClick={() => setDayOpen(d)} sx={{ all: "unset", cursor: "pointer" }}>
                {countsLine(d, 12)}
              </Box>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {list.map((e) => eventCard(e))}
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ backgroundColor: colors.primary[400], borderRadius: "4px", p: { xs: 1, sm: 2 } }}>
      {/* TOOLBAR */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
        <Button size="small" variant="outlined" color="inherit" onClick={() => setCursor(today)}>
          Today
        </Button>
        <IconButton size="small" onClick={() => step(-1)} aria-label="Previous">
          <ChevronLeftIcon />
        </IconButton>
        <IconButton size="small" onClick={() => step(1)} aria-label="Next">
          <ChevronRightIcon />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: 17, sm: 22 }, mr: "auto" }}>
          {title}
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="month" sx={{ px: 1.5, py: 0.25 }}>
            Month
          </ToggleButton>
          <ToggleButton value="week" sx={{ px: 1.5, py: 0.25 }}>
            Week
          </ToggleButton>
          <ToggleButton value="list" sx={{ px: 1.5, py: 0.25 }}>
            List
          </ToggleButton>
        </ToggleButtonGroup>
        <Button
          size="small"
          variant="contained"
          color="secondary"
          startIcon={<AddOutlinedIcon />}
          onClick={() => openNew(cursor < today ? today : cursor, cursor < today ? today : cursor)}
        >
          Booking
        </Button>
      </Box>

      {/* LEGEND (click to hide / show a kind) */}
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1 }}>
        {SCHEDULE_KINDS.map((k) => {
          const hidden = hiddenKinds.includes(k.key);
          return (
            <Chip
              key={k.key}
              size="small"
              clickable
              onClick={() => setHiddenKinds((h) => (hidden ? h.filter((x) => x !== k.key) : [...h, k.key]))}
              label={k.label}
              variant={hidden ? "outlined" : "filled"}
              sx={{
                backgroundColor: hidden ? "transparent" : k.color,
                color: hidden ? "text.secondary" : "#fff",
                textDecoration: hidden ? "line-through" : "none",
                "&:hover": { backgroundColor: hidden ? "action.hover" : k.color, filter: "brightness(1.1)" },
              }}
            />
          );
        })}
        <Chip
          size="small"
          clickable
          onClick={() => setShowStatus((v) => !v)}
          label="Set on vehicles"
          variant="outlined"
          title="Statuses set on the vehicles themselves (Edit Blocked Vehicles / Excel), shown as dashed bars"
          sx={{
            borderStyle: "dashed",
            textDecoration: showStatus ? "none" : "line-through",
            color: showStatus ? "text.primary" : "text.secondary",
          }}
        />
        <Typography variant="caption" sx={{ opacity: 0.6, alignSelf: "center", ml: 0.5 }}>
          {phone
            ? "Tap a day for its vehicles · tap a booking to edit · hold and drag to move"
            : "Click a day for its vehicles · drag across days to book · click a booking to edit · drag it to move"}
        </Typography>
        {!phone && (
          <Typography variant="caption" sx={{ alignSelf: "center", ml: "auto", fontWeight: 700 }}>
            <span style={{ color: theme.palette.success.main }}>available</span> ·{" "}
            <span style={{ color: theme.palette.error.main }}>deployed</span> ·{" "}
            <span style={{ color: theme.palette.warning.main }}>unavailable</span> per day
          </Typography>
        )}
      </Box>

      {moveError && (
        <Alert severity="error" onClose={() => setMoveError("")} sx={{ mb: 1 }}>
          Couldn't move the booking: {moveError}
        </Alert>
      )}
      {view === "month" && monthView()}
      {view === "week" && weekView()}
      {view === "list" && listView()}

      {editing && <EventDialog key={editing.id ?? "new"} event={editing} onClose={() => setEditing(null)} />}
      {dayOpen && (
        <DayPanel
          date={dayOpen}
          today={today}
          vehicles={vehicles}
          day={statusOn(dayOpen)}
          bookings={bookingEvents.filter((e) => onDate(e, dayOpen))}
          renderBooking={(e) => eventCard(e, dayOpen)}
          onVehicle={setDetail}
          onNew={(vehicleIds) => {
            const d = dayOpen < today ? today : dayOpen;
            setDayOpen(null);
            setEditing({ start: d, end: d, kind: "tasking", vehicleIds: vehicleIds ?? [] });
          }}
          onClose={() => setDayOpen(null)}
        />
      )}
      {statusOpen && (
        <StatusGroupDialog
          group={statusOpen}
          vehicles={statusOpen.vehicleIds.map((id) => byId.get(id)).filter(Boolean)}
          onVehicle={setDetail}
          onPutOnCalendar={() => {
            const g = statusOpen;
            setStatusOpen(null);
            const deployedField = DEPLOYED_FIELDS.includes(g.field);
            setEditing({
              kind: deployedField ? "tasking" : "maintenance",
              field: deployedField ? g.field : undefined,
              tasking: deployedField ? g.value : "",
              title: deployedField ? g.value : `${g.field}: ${g.value}`.slice(0, 80),
              start: g.written?.start ?? today,
              end: g.written?.end ?? today,
              vehicleIds: g.vehicleIds,
              clearField: { field: g.field, vehicleIds: g.vehicleIds },
            });
          }}
          onClose={() => setStatusOpen(null)}
        />
      )}
      {detail && (
        <VehicleDetailDialog
          vehicle={detail}
          onClose={() => setDetail(null)}
          onEdit={
            onEditVehicle &&
            ((v) => {
              setDetail(null);
              onEditVehicle(v);
            })
          }
        />
      )}
    </Box>
  );
};

export default FleetCalendar;