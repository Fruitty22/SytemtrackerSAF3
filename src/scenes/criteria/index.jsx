import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import Header from "../../components/Header";
import ConfirmDialog from "../../components/ConfirmDialog";
import { tokens } from "../../theme";
import { useVehicles } from "../../data/VehiclesContext";
import { formatDateTime } from "../../utils/vehicle";
import { CATEGORIES } from "../../../shared/criteria.js";
import { DEPLOYED_FIELDS, DEPLOY_LABELS } from "../../../shared/config.js";

const ORDER = ["MAINTENANCE", "BLOCKED", "IGNORE"];

// The workbook's CriteriaConfig / "Criteria List" sheet, plus the macro's
// ReclassifyCriteria and ResetAllCriteria: which columns count, and how.
const Criteria = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { criteria, saveCriteria, vehicles } = useVehicles();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MAINTENANCE");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, text, run }

  const run = async (changes, done) => {
    setBusy(true);
    setMessage(null);
    try {
      await saveCriteria(changes);
      setMessage({ severity: "success", text: done });
    } catch (err) {
      setMessage({ severity: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  // how many vehicles have a value saved for this criteria
  const usedBy = (c) =>
    vehicles.filter((v) =>
      c.category === "MAINTENANCE" ? v.maintenance?.[c.name]?.level : v.blocks?.[c.name]?.value
    ).length;

  const sorted = [...criteria].sort(
    (a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.name.localeCompare(b.name)
  );

  return (
    <Box sx={{ m: { xs: "12px", sm: "20px" } }}>
      <Header
        title="MANAGE CRITERIA"
        subtitle={`Which columns count towards ${DEPLOY_LABELS.yes} / ${DEPLOY_LABELS.no} - like the workbook's CriteriaConfig sheet`}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(0, 2fr)" },
          gap: "20px",
          alignItems: "start",
        }}
      >
        <Box sx={{ backgroundColor: colors.primary[400], borderRadius: "4px", p: { xs: 1, sm: 2 }, overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Criteria</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Vehicles with a value</TableCell>
                <TableCell>Added</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((c) => (
                <TableRow key={c.name} sx={{ opacity: c.category === "IGNORE" ? 0.6 : 1 }}>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {c.name}
                    {DEPLOYED_FIELDS.includes(c.name) && (
                      <Typography variant="caption" sx={{ display: "block", opacity: 0.7 }}>
                        counts as {DEPLOY_LABELS.deployed}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={c.category}
                      disabled={busy}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfirm({
                          title: `Reclassify ${c.name}?`,
                          text:
                            `${c.name} becomes "${CATEGORIES[next]}". ` +
                            (usedBy(c)
                              ? `Values already saved for ${usedBy(c)} vehicle(s) stop counting until they are entered again for the new kind.`
                              : ""),
                          run: () => run({ set: [{ name: c.name, category: next }] }, `${c.name} is now ${CATEGORIES[next]}.`),
                        });
                      }}
                    >
                      {ORDER.map((k) => (
                        <MenuItem key={k} value={k}>
                          {CATEGORIES[k]}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell align="right">{c.category === "IGNORE" ? "-" : usedBy(c)}</TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {c.addedBy === "default" ? "default" : `${formatDateTime(c.addedAt)} · ${c.addedBy ?? ""}`}
                    </Typography>
                  </TableCell>
                  <TableCell padding="checkbox">
                    <Tooltip title="Remove (it will be asked about again on the next import)">
                      <span>
                        <IconButton
                          size="small"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              title: `Remove ${c.name}?`,
                              text: "It stops counting, and the next import that has this column asks how to classify it again.",
                              run: () => run({ remove: [c.name] }, `${c.name} removed.`),
                            })
                          }
                        >
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ backgroundColor: colors.primary[400], borderRadius: "4px", p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Add a criteria
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Usually done for you: the import asks about every new column it finds (Scan criteria). Add one here to
            enter it in the app before it is in any file.
          </Typography>
          <TextField size="small" label="Column title" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField select size="small" label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {ORDER.map((k) => (
              <MenuItem key={k} value={k}>
                {CATEGORIES[k]}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            color="secondary"
            disabled={busy || !name.trim()}
            onClick={() => run({ set: [{ name, category }] }, `${name.trim().toUpperCase()} added.`).then(() => setName(""))}
          >
            Add
          </Button>
          {message && <Alert severity={message.severity}>{message.text}</Alert>}
          <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
            <Button
              color="warning"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: "Reset all criteria?",
                  text: "Every classification goes back to the starting list. Columns added since will be asked about again on the next import.",
                  run: () => run({ reset: true }, "Criteria reset to the starting list."),
                })
              }
            >
              Reset all to defaults
            </Button>
          </Box>
        </Box>
      </Box>

      {confirm && (
        <ConfirmDialog
          open
          confirmColor="warning"
          title={confirm.title}
          message={confirm.text}
          confirmLabel="Yes"
          onConfirm={confirm.run}
          onClose={() => setConfirm(null)}
        />
      )}
    </Box>
  );
};

export default Criteria;
