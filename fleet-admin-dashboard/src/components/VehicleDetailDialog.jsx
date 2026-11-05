import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import { useAuth } from "../auth/AuthContext";
import { useVehicles } from "../data/VehiclesContext";
import { DeployChip, ReasonChips } from "./Chips";
import { formatDateTime, levelInfo } from "../utils/vehicle";
import { kindOf } from "../../shared/schedule.js";
import { formatRange } from "./calendar/dates";
import EventDialog from "./calendar/EventDialog";

const Section = ({ title, children, action }) => (
  <Box>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75, gap: 1 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{title}</Typography>
      {action}
    </Box>
    {children}
  </Box>
);

const ignoredText = (row, type) =>
  row.ignoredBy === "vehicle" ? "ignored (this vehicle)" : row.ignoredBy === "type" ? `ignored (every ${type})` : "";

// Everything about ONE vehicle: status and why, blocked fields, maintenance
// items, its calendar bookings, remarks - with buttons to change each part.
// `vehicle` can be a stale copy: the latest version is read from the list.
const VehicleDetailDialog = ({ vehicle: given, onClose, onEdit }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { vehicles, events, deployOf, today } = useVehicles();
  const [booking, setBooking] = useState(null); // booking open in EventDialog

  const vehicle = vehicles.find((v) => v.id === given.id) ?? given;
  const result = deployOf(vehicle);

  const bookings = useMemo(() => {
    const mine = events.filter((e) => e.vehicleIds.includes(vehicle.id));
    const current = mine.filter((e) => e.end >= today).sort((a, b) => a.start.localeCompare(b.start));
    const past = mine.filter((e) => e.end < today).sort((a, b) => b.end.localeCompare(a.end)).slice(0, 3);
    return { current, past };
  }, [events, vehicle.id, today]);

  const blockRows = result.blockRows.filter((r) => r.value || r.ignoredBy);
  const items = result.itemRows.filter((r) => r.value);
  const itemsN = items.filter((r) => levelInfo(r.value).problem);
  const itemsOk = items.filter((r) => !levelInfo(r.value).problem);
  const blank = result.itemRows.length - items.length;

  const go = (path) => {
    onClose();
    navigate(`${path}?vehicle=${encodeURIComponent(vehicle.id)}`);
  };

  const bookingRow = (e, past) => {
    const k = kindOf(e.kind);
    const on = e.start <= today && today <= e.end;
    return (
      <Box
        key={e.id}
        onClick={() => setBooking(e)}
        sx={{
          cursor: "pointer",
          display: "flex",
          gap: 1,
          alignItems: "center",
          p: 1,
          borderRadius: "4px",
          borderLeft: `4px solid ${k.color}`,
          backgroundColor: "background.default",
          opacity: past ? 0.6 : 1,
          "&:hover": { backgroundColor: "action.hover" },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>
            {e.title}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {k.label}
            {e.tasking ? ` · ${e.field || "TASKING"}: ${e.tasking}` : ""} · {formatRange(e.start, e.end)}
            {e.startTime ? ` · ${e.startTime}${e.endTime ? `–${e.endTime}` : ""}` : ""}
          </Typography>
        </Box>
        {on && <Chip size="small" color="info" label="On now" />}
      </Box>
    );
  };

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={phone}>
        <DialogTitle sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, pr: 6 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: 22, sm: 26 } }}>
              {vehicle.mid}
            </Typography>
            <Typography sx={{ opacity: 0.8 }}>
              {vehicle.type}
              {vehicle.ownerName ? ` · managed by ${vehicle.ownerName}` : ""}
              {vehicle.sourceSheet ? ` · sheet ${vehicle.sourceSheet}` : ""}
            </Typography>
          </Box>
          <DeployChip vehicle={vehicle} sx={{ mt: 0.5, fontWeight: 700 }} />
          <IconButton onClick={onClose} aria-label="Close" sx={{ position: "absolute", right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          {/* WHY */}
          <Section title="Status">
            {result.reasons.length === 0 ? (
              <Alert severity="success" icon={false}>
                Available: no blocked field and no maintenance item at N.
              </Alert>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                <ReasonChips vehicle={vehicle} />
                {result.scheduleRows.filter((r) => r.blocks).length > 0 && (
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Includes today's calendar booking(s); they end by themselves.
                  </Typography>
                )}
              </Box>
            )}
            {vehicle.statusRemark && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Status remark:</strong> {vehicle.statusRemark}
              </Typography>
            )}
          </Section>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5, alignItems: "start" }}>
            {/* BLOCKED FIELDS */}
            <Section
              title={`Blocked fields (${result.blockRows.filter((r) => r.value).length})`}
              action={
                <Button size="small" startIcon={<BlockOutlinedIcon />} onClick={() => go("/edit-blocked")}>
                  Edit
                </Button>
              }
            >
              {blockRows.length === 0 ? (
                <Typography variant="body2" sx={{ opacity: 0.6 }}>
                  None set.
                </Typography>
              ) : (
                <Table size="small">
                  <TableBody>
                    {blockRows.map((r) => {
                      const rec = vehicle.blocks?.[r.field];
                      return (
                        <TableRow key={r.field}>
                          <TableCell sx={{ fontWeight: 700, pl: 0, whiteSpace: "nowrap" }}>{r.field}</TableCell>
                          <TableCell sx={{ color: r.blocks ? "error.main" : undefined }}>
                            {r.value || "-"}
                            {ignoredText(r, vehicle.type) && (
                              <Typography variant="caption" component="div" sx={{ color: "warning.main" }}>
                                {ignoredText(r, vehicle.type)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ pr: 0 }}>
                            {rec?.updatedAt && (
                              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                {formatDateTime(rec.updatedAt)}
                                {rec.updatedBy ? ` · ${rec.updatedBy}` : ""}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Section>

            {/* MAINTENANCE */}
            <Section
              title={`Maintenance items (${itemsN.length} N)`}
              action={
                <Button size="small" startIcon={<BuildOutlinedIcon />} onClick={() => go("/edit-maintenance")}>
                  Edit
                </Button>
              }
            >
              {itemsN.length > 0 && (
                <Table size="small" sx={{ mb: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ pl: 0 }}>Item at N</TableCell>
                      <TableCell>Remark</TableCell>
                      <TableCell sx={{ pr: 0 }}>Changed</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {itemsN.map((r) => {
                      const rec = vehicle.maintenance?.[r.field];
                      return (
                        <TableRow key={r.field}>
                          <TableCell sx={{ fontWeight: 700, pl: 0, color: r.counted ? "warning.main" : undefined }}>
                            {r.field}
                            {!r.counted && (
                              <Typography variant="caption" component="div" sx={{ opacity: 0.7 }}>
                                ignored for {vehicle.type}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{rec?.remark || "-"}</TableCell>
                          <TableCell sx={{ pr: 0 }}>
                            <Typography variant="caption" sx={{ opacity: 0.7 }}>
                              {rec?.updatedAt ? formatDateTime(rec.updatedAt) : ""}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {itemsOk.length} item(s) Y{blank ? ` · ${blank} blank` : ""}
              </Typography>
              {itemsOk.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
                  {itemsOk.map((r) => (
                    <Chip key={r.field} size="small" variant="outlined" color="success" label={r.field} />
                  ))}
                </Box>
              )}
            </Section>
          </Box>

          {/* CALENDAR */}
          <Section
            title={`Calendar bookings (${bookings.current.length} now / coming)`}
            action={
              <Button
                size="small"
                startIcon={<EventOutlinedIcon />}
                onClick={() => setBooking({ start: today, end: today, kind: "tasking", vehicleIds: [vehicle.id] })}
              >
                Book
              </Button>
            }
          >
            {bookings.current.length === 0 && bookings.past.length === 0 ? (
              <Typography variant="body2" sx={{ opacity: 0.6 }}>
                No bookings. Use Book to put this vehicle on a tasking, servicing or maintenance on dates.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {bookings.current.map((e) => bookingRow(e, false))}
                {bookings.past.length > 0 && (
                  <Typography variant="caption" sx={{ opacity: 0.6, mt: 0.5 }}>
                    Past
                  </Typography>
                )}
                {bookings.past.map((e) => bookingRow(e, true))}
              </Box>
            )}
          </Section>

          {/* DETAILS */}
          <Section
            title="Details"
            action={
              onEdit && (
                <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => onEdit(vehicle)}>
                  Edit
                </Button>
              )
            }
          >
            <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 0.5, fontSize: 14 }}>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Remarks
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {vehicle.remarks || "-"}
              </Typography>
              {isAdmin && (
                <>
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Managed by
                  </Typography>
                  <Typography variant="body2">{vehicle.ownerName || "Unassigned"}</Typography>
                </>
              )}
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Last updated
              </Typography>
              <Typography variant="body2">
                {formatDateTime(vehicle.updatedAt)}
                {vehicle.updatedBy ? ` · ${vehicle.updatedBy}` : ""}
              </Typography>
            </Box>
          </Section>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      {booking && <EventDialog key={booking.id ?? "new"} event={booking} onClose={() => setBooking(null)} />}
    </>
  );
};

export default VehicleDetailDialog;
