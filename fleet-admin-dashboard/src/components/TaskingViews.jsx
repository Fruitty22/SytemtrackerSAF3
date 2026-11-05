import { useMemo } from "react";
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { ShowMoreButtons, useShowMore } from "./ShowMore";
import { tokens } from "../theme";
import { useVehicles } from "../data/VehiclesContext";
import { byMid } from "../utils/vehicle";
import { DEPLOYED_FIELDS } from "../../shared/config.js";
import { reasonText } from "../../shared/deployability.js";

// The look of a MID "chip". The MIDs are plain <span>s styled once by their
// parent, not MUI <Chip>s: a page can show hundreds of them, and a MUI Chip
// each is what made this page slow to open on phones.
const midListSx = {
  display: "flex",
  flexWrap: "wrap",
  gap: 0.5,
  alignItems: "center",
  "& .mid": {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    px: 1,
    borderRadius: "12px",
    border: 1,
    borderColor: "divider",
    fontSize: 13,
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  "& button.mid": {
    font: "inherit",
    fontSize: 13,
    color: "inherit",
    background: "none",
    cursor: "pointer",
    "&:hover": { borderColor: "secondary.main", backgroundColor: "action.hover" },
  },
};

// One chip per vehicle: "21714". Shows `step` at first (5 by default),
// then "+5 more" / "Show all" / "Show less". Hover (desktop) shows the type.
// onSelect(vehicle): makes each MID a button (e.g. to open the vehicle's details)
const MidChipList = ({ vehicles, showOwner, step, onSelect }) => {
  const state = useShowMore(vehicles.length, step);
  return (
    <Box sx={midListSx}>
      {vehicles.slice(0, state.limit).map((v) => (
        onSelect ? (
          <button
            key={v.id}
            type="button"
            className="mid"
            title={`${showOwner ? `${v.type} · ${v.ownerName}` : v.type} - click for details`}
            onClick={() => onSelect(v)}
          >
            {v.mid}
          </button>
        ) : (
          <span key={v.id} className="mid" title={showOwner ? `${v.type} · ${v.ownerName}` : v.type}>
            {v.mid}
          </span>
        )
      ))}
      <ShowMoreButtons state={state} />
    </Box>
  );
};
// key={step}: picking a new "MIDs shown" value starts every list again from that many
export const MidChips = ({ step = 5, ...props }) => <MidChipList key={step} step={step} {...props} />;

// Vehicles grouped by what they're tasked on: "XCA (5)", "ICT (3)" ...
export const TaskingGroups = ({ vehicles, showOwner, step = 5 }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { deployOf } = useVehicles();

  const groups = useMemo(() => {
    const map = new Map();
    for (const v of vehicles) {
      const tasking = deployOf(v).tasking;
      if (tasking) map.set(tasking, [...(map.get(tasking) ?? []), v]);
    }
    return [...map.entries()]
      .map(([tasking, list]) => ({ tasking, list: list.slice().sort(byMid) }))
      .sort((a, b) => b.list.length - a.list.length || a.tasking.localeCompare(b.tasking));
  }, [vehicles, deployOf]);

  if (groups.length === 0) {
    return (
      <Typography variant="body2" sx={{ opacity: 0.6, py: 1 }}>
        No vehicles on tasking.
      </Typography>
    );
  }
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fill, minmax(260px, 1fr))" },
        gap: "12px",
      }}
    >
      {groups.map(({ tasking, list }) => {
        // what kinds of vehicle are on this tasking: "6 TON GS ×3, STAFF CAR ×1"
        const byType = new Map();
        for (const v of list) byType.set(v.type, (byType.get(v.type) ?? 0) + 1);
        return (
          <Box
            key={tasking}
            sx={{
              backgroundColor: "background.default",
              borderRadius: "4px",
              p: 1.5,
              borderLeft: `4px solid ${theme.palette.info.main}`,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{tasking}</Typography>
              <Typography sx={{ fontWeight: 700, color: theme.palette.info.main }}>{list.length}</Typography>
            </Box>
            <Typography variant="caption" component="div" sx={{ color: colors.grey[300], mb: 1 }}>
              {[...byType.entries()].map(([t, n]) => `${t} ×${n}`).join(", ")}
            </Typography>
            <MidChips vehicles={list} showOwner={showOwner} step={step} />
          </Box>
        );
      })}
    </Box>
  );
};

// Every reason vehicles are not available, with how many and which:
// "TASKING: XCA  5", "VOR STATUS: X  12", "AIRCON (N)  3" ...
export const ReasonTable = ({ vehicles, showOwner, step = 5 }) => {
  const theme = useTheme();
  const { deployOf } = useVehicles();

  const rows = useMemo(() => {
    const map = new Map();
    for (const v of vehicles) {
      for (const r of deployOf(v).reasons) {
        const key = reasonText(r);
        const entry = map.get(key) ?? {
          key,
          kind:
            r.kind === "maintenance"
              ? "Maintenance"
              : DEPLOYED_FIELDS.includes(r.field)
                ? "Deployed"
                : "Blocked",
          list: [],
        };
        entry.list.push(v);
        map.set(key, entry);
      }
    }
    return [...map.values()]
      .map((e) => ({ ...e, list: e.list.slice().sort(byMid) }))
      .sort((a, b) => b.list.length - a.list.length || a.key.localeCompare(b.key));
  }, [vehicles, deployOf]);

  const phone = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  // 10 reasons at first, then "+10 more"
  const state = useShowMore(rows.length, 10);

  if (rows.length === 0) {
    return (
      <Typography variant="body2" sx={{ opacity: 0.6, py: 1 }}>
        Every vehicle is available.
      </Typography>
    );
  }
  const color = { Deployed: "info", Blocked: "error", Maintenance: "warning" };
  const visible = rows.slice(0, state.limit);
  const more = (state.hidden > 0 || state.expanded) && (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", pt: 1.5 }}>
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        Showing {state.limit} of {rows.length} reasons
      </Typography>
      <ShowMoreButtons state={state} />
    </Box>
  );

  // PHONE: one stacked card per reason (a wide table is slow to lay out and
  // has to be scrolled sideways on a narrow screen)
  if (phone) {
    return (
      <Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {visible.map((r) => (
            <Box
              key={r.key}
              sx={{
                backgroundColor: "background.default",
                borderRadius: "4px",
                p: 1.25,
                borderLeft: `4px solid ${theme.palette[color[r.kind]].main}`,
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1, mb: 0.75 }}>
                <Typography sx={{ fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" }}>{r.key}</Typography>
                <Typography sx={{ fontWeight: 700, flexShrink: 0 }}>
                  {r.list.length}
                  <Typography component="span" variant="caption" sx={{ ml: 0.75, color: `${color[r.kind]}.main` }}>
                    {r.kind}
                  </Typography>
                </Typography>
              </Box>
              <MidChips vehicles={r.list} showOwner={showOwner} step={step} />
            </Box>
          ))}
        </Box>
        {more}
      </Box>
    );
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Not available because</TableCell>
            <TableCell>Kind</TableCell>
            <TableCell align="right">Vehicles</TableCell>
            <TableCell sx={{ minWidth: 220 }}>MID</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((r) => (
            <TableRow key={r.key}>
              <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{r.key}</TableCell>
              <TableCell>
                <Chip size="small" label={r.kind} color={color[r.kind]} variant="outlined" />
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {r.list.length}
              </TableCell>
              <TableCell>
                <MidChips vehicles={r.list} showOwner={showOwner} step={step} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {more}
    </Box>
  );
};
