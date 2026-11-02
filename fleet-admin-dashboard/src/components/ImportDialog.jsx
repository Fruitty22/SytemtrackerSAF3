import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useAuth } from "../auth/AuthContext";
import { useVehicles } from "../data/VehiclesContext";
import {
  columnLetter,
  detectLayout,
  findFieldColumns,
  isGeneralSheet,
  matchAccount,
  mergeSheets,
  readVehicles,
} from "../utils/workbook";
import { GENERAL_SHEETS, UNASSIGNED } from "../../shared/config.js";

const SKIP = "";

// kind of sheet -> how strongly it decides a vehicle's owner (see mergeSheets)
//   linked:    belongs to an account (claimed / matched by name / chosen here)
//   unclaimed: a commander's sheet with no account yet; Unassigned until claimed
//   general:   a whole-fleet sheet (Dashboard, MID Details...)
const PRIORITY = { linked: 3, unclaimed: 2, general: 1 };

function sheetDefaults(name, layout, accounts) {
  const general = isGeneralSheet(name, GENERAL_SHEETS);
  const owner = layout && !general ? matchAccount(name, accounts) : null;
  if (!layout) return { ownerId: SKIP, kind: general ? "general" : "unclaimed" };
  if (owner) return { ownerId: owner.id, kind: "linked" };
  return { ownerId: UNASSIGNED, kind: general ? "general" : "unclaimed" };
}

const fieldSummary = (layout) => {
  const names = Object.keys(layout?.fields ?? {});
  return names.length ? `${names.length} field column(s)` : "no field columns";
};

// ---- fix one sheet's columns by hand (only needed if auto-detect got it wrong)
const ColumnsDialog = ({ sheet, layout, onSave, onClose }) => {
  const [form, setForm] = useState(
    layout ?? { headerRow: 1, mid: "", type: "", fixedType: "", fields: {} }
  );
  const header = sheet.rows[form.headerRow - 1] ?? [];
  // blocked-field / Y-N item columns are picked up from the header row by name
  const fields = findFieldColumns(header.map((h) => String(h ?? "").trim().toUpperCase()));
  const layoutNow = { ...form, fields };
  const width = sheet.rows.reduce((max, r) => Math.max(max, r.length), 0);
  const options = Array.from({ length: width }, (_, i) => ({
    value: i,
    label: `${columnLetter(i)}${String(header[i] ?? "").trim() ? ` - ${String(header[i]).trim()}` : ""}`,
  }));
  const preview = readVehicles(sheet.rows, layoutNow);
  const valuesOf = (v) =>
    [
      ...Object.entries(v.blocks).filter(([, x]) => x),
      ...Object.entries(v.maintenance).filter(([, x]) => x === "N"),
    ]
      .map(([f, x]) => `${f}: ${x}`)
      .join(", ");

  const pick = (key, label, optional) => (
    <TextField
      select
      size="small"
      label={label}
      value={form[key]}
      onChange={(e) =>
        setForm((f) => ({ ...f, [key]: e.target.value === "" ? "" : Number(e.target.value) }))
      }
      sx={{ minWidth: 180, flex: 1 }}
    >
      <MenuItem value="">
        <em>{optional ? "(none)" : "Choose a column"}</em>
      </MenuItem>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Columns on &ldquo;{sheet.name}&rdquo;</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            size="small"
            type="number"
            label="Header row"
            helperText="Excel row with the column titles"
            value={form.headerRow}
            onChange={(e) =>
              setForm((f) => ({ ...f, headerRow: Math.max(1, Number(e.target.value) || 1) }))
            }
            sx={{ width: 170 }}
          />
          {pick("mid", "MID number column")}
          {pick("type", "Vehicle type column", true)}
        </Box>
        <Typography variant="body2">
          {Object.keys(fields).length
            ? `Also reads these columns (matched by their heading): ${Object.entries(fields)
                .map(([f, c]) => `${f} (${columnLetter(c)})`)
                .join(", ")}`
            : "No blocked-field or Y/N item columns on this header row (headings must match the field names, e.g. VOR STATUS, OVERSEAS, MLC)."}
        </Typography>
        {form.type === "" && (
          <TextField
            size="small"
            label="Vehicle type for every row on this sheet (optional)"
            helperText="Leave empty to take the type from another sheet that lists the same MID"
            value={form.fixedType ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, fixedType: e.target.value }))}
          />
        )}
        <Typography>
          <strong>{preview.length}</strong> vehicle(s) found. First few:
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Row</TableCell>
              <TableCell>MID</TableCell>
              <TableCell>Vehicle type</TableCell>
              <TableCell>Blocked fields / N items</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {preview.slice(0, 6).map((v) => (
              <TableRow key={v.mid}>
                <TableCell>{v.line}</TableCell>
                <TableCell>{v.mid}</TableCell>
                <TableCell>{v.type || <em>none</em>}</TableCell>
                <TableCell>{valuesOf(v) || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={form.mid === ""}
          onClick={() => onSave(layoutNow)}
        >
          Use these columns
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ---- the import dialog
// Reads EVERY sheet of the workbook, finds the vehicle list on each one, and
// gives each sheet to the account it belongs to. Nothing to select unless
// you want to change something.
const ImportDialog = ({ onClose }) => {
  const { user } = useAuth(); // only Admins can open this dialog
  const { users, importVehicles } = useVehicles();
  const fileInput = useRef(null);
  const accounts = users;

  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState([]); // [{ name, hidden, rows, layout, ownerId, kind }]
  const [editing, setEditing] = useState(null); // sheet name whose columns are being fixed
  const [onDuplicate, setOnDuplicate] = useState("owner");
  const [remember, setRemember] = useState(true);
  const [fallbackType, setFallbackType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parsed = wb.SheetNames.map((name, i) => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
          header: 1,
          defval: "",
          raw: false,
          blankrows: true, // keep blank rows so row numbers match Excel
        });
        const layout = detectLayout(rows);
        const { ownerId, kind } = sheetDefaults(name, layout, accounts);
        return {
          name,
          hidden: (wb.Workbook?.Sheets?.[i]?.Hidden ?? 0) !== 0,
          rows,
          layout,
          ownerId,
          kind,
        };
      });
      setFileName(file.name);
      setSheets(parsed);
      setResult(null);
    } catch {
      setError("Couldn't read that file. Please choose an Excel file (.xlsx, .xlsm, .xls) or a .csv.");
    } finally {
      setBusy(false);
    }
  };

  const updateSheet = (name, changes) =>
    setSheets((list) => list.map((s) => (s.name === name ? { ...s, ...changes } : s)));

  // vehicles per sheet, then merged into one list (one row per MID)
  const plans = useMemo(
    () =>
      sheets.map((s) => ({
        ...s,
        vehicles: readVehicles(s.rows, s.layout),
        priority: PRIORITY[s.kind] ?? 1,
      })),
    [sheets]
  );
  const merged = useMemo(() => mergeSheets(plans, fallbackType), [plans, fallbackType]);
  const importable = merged.rows.filter((r) => r.type);

  const perAccount = useMemo(() => {
    const counts = new Map();
    for (const r of importable) counts.set(r.ownerId, (counts.get(r.ownerId) ?? 0) + 1);
    return [...counts.entries()].map(([id, n]) => ({
      id,
      n,
      name: id === UNASSIGNED ? "Unassigned" : accounts.find((a) => a.id === id)?.name ?? "?",
    }));
  }, [importable, accounts]);

  const runImport = async () => {
    setBusy(true);
    setError("");
    try {
      const sheetLinks = {};
      if (remember) {
        for (const s of sheets) {
          if (s.kind === "linked" && s.ownerId && s.ownerId !== UNASSIGNED) {
            (sheetLinks[s.ownerId] ??= []).push(s.name);
          }
        }
      }
      // every commander sheet in this workbook, so commanders can claim theirs
      const commanderSheets = plans
        .filter((p) => p.layout && p.kind !== "general")
        .map((p) => ({ name: p.name, vehicles: p.vehicles.length }));
      setResult(
        await importVehicles({ rows: importable, onDuplicate, sheetLinks, sheets: commanderSheets })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const withVehicles = plans.filter((p) => p.layout);
  const unclaimedCount = withVehicles.filter((p) => p.ownerId && p.kind === "unclaimed").length;
  const withoutVehicles = plans.filter((p) => !p.layout);
  const editingSheet = sheets.find((s) => s.name === editing);

  const sheetRow = (p) => (
    <TableRow key={p.name} sx={{ opacity: p.ownerId ? 1 : 0.55 }}>
      <TableCell sx={{ fontWeight: 700 }}>
        {p.name}
        {p.hidden && (
          <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.7 }}>
            (hidden)
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">{p.layout ? p.vehicles.length : "-"}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {p.layout ? (
          <Typography variant="body2" component="span">
            row {p.layout.headerRow} · MID {columnLetter(p.layout.mid)} · type{" "}
            {p.layout.type === "" ? (p.layout.fixedType ? `"${p.layout.fixedType}"` : "-") : columnLetter(p.layout.type)} ·{" "}
            <span title={Object.keys(p.layout.fields ?? {}).join(", ")}>{fieldSummary(p.layout)}</span>
          </Typography>
        ) : (
          <Typography variant="body2" component="span" sx={{ opacity: 0.7 }}>
            no MID column found
          </Typography>
        )}
        <Button size="small" sx={{ ml: 1 }} onClick={() => setEditing(p.name)}>
          {p.layout ? "Change" : "Set columns"}
        </Button>
      </TableCell>
      <TableCell sx={{ minWidth: 210 }}>
        <TextField
          select
          size="small"
          fullWidth
          value={p.ownerId}
          disabled={!p.layout}
          onChange={(e) =>
            updateSheet(p.name, {
              ownerId: e.target.value,
              // giving a commander sheet to an account links it to them.
              // A whole-fleet sheet (Dashboard...) stays "general": it never
              // decides a vehicle's sheet over a commander's own sheet.
              kind: isGeneralSheet(p.name, GENERAL_SHEETS)
                ? "general"
                : e.target.value !== SKIP && e.target.value !== UNASSIGNED
                  ? "linked"
                  : "unclaimed",
            })
          }
        >
          <MenuItem value={SKIP}>
            <em>Don&rsquo;t import</em>
          </MenuItem>
          <MenuItem value={UNASSIGNED}>Unassigned</MenuItem>
          {accounts.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
              {a.id === user.id ? " (you)" : ""}
            </MenuItem>
          ))}
        </TextField>
        {p.layout && p.ownerId && p.kind !== "linked" && (
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            {p.kind === "general"
              ? "Whole-fleet sheet"
              : "No account yet - Unassigned until its commander claims it"}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Import vehicles from Excel</DialogTitle>
      <DialogContent dividers>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv"
          onChange={readFile}
          style={{ display: "none" }}
        />

        {result ? (
          <Box>
            <Alert severity={result.errors.length ? "warning" : "success"} sx={{ mb: 2 }}>
              Added {result.created}, updated {result.updated}
              {result.unchanged ? `, ${result.unchanged} already up to date` : ""}
              {result.skipped ? `, skipped ${result.skipped} that already existed` : ""}.
              {result.errors.length > 0 && ` ${result.errors.length} row(s) had problems:`}
            </Alert>
            {result.errors.map((e) => (
              <Typography key={e} variant="body2" sx={{ ml: 1 }}>
                &bull; {e}
              </Typography>
            ))}
          </Box>
        ) : sheets.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography sx={{ mb: 1 }}>
              Choose your workbook. Every sheet is read automatically: each
              commander&rsquo;s sheet goes to their account, and sheets nobody has
              claimed yet wait for their commander.
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, opacity: 0.7 }}>
              The file is read on this computer; only the vehicles are saved to the database.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <UploadFileOutlinedIcon />}
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              Choose Excel file
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
              <Typography sx={{ flex: "1 1 200px" }}>
                <strong>{fileName}</strong> · {withVehicles.length} sheet(s) with vehicles
              </Typography>
              <Button size="small" color="inherit" onClick={() => fileInput.current?.click()}>
                Choose another file
              </Button>
            </Box>

            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sheet</TableCell>
                    <TableCell align="right">Vehicles</TableCell>
                    <TableCell>Columns found</TableCell>
                    <TableCell>Give to</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {withVehicles.map(sheetRow)}
                  {withoutVehicles.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ pt: 2, opacity: 0.7 }}>
                        No vehicle list found on these sheets (use &ldquo;Set columns&rdquo; if one does have vehicles):
                      </TableCell>
                    </TableRow>
                  )}
                  {withoutVehicles.map(sheetRow)}
                </TableBody>
              </Table>
            </Box>

            {/* SUMMARY */}
            <Box sx={{ p: 2, borderRadius: "4px", bgcolor: "action.hover" }}>
              <Typography sx={{ mb: 1 }}>
                <strong>{importable.length}</strong> vehicle(s) will be imported
                {merged.duplicates > 0 &&
                  ` · ${merged.duplicates} appear on more than one sheet (a commander's own sheet decides who gets it)`}
              </Typography>
              {unclaimedCount > 0 && (
                <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>
                  {unclaimedCount} commander sheet(s) have no account yet. Their vehicles stay
                  Unassigned until the commander logs in and claims the sheet (menu &rarr; My worksheet).
                </Typography>
              )}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {perAccount.map((a) => (
                  <Chip key={a.id} label={`${a.name}: ${a.n}`} size="small" />
                ))}
              </Box>
              {merged.missingType > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    {merged.missingType} vehicle(s) have no vehicle type on any sheet and will be
                    left out, unless you give them a type here.
                  </Alert>
                  <TextField
                    size="small"
                    label="Type for vehicles without one"
                    placeholder="e.g. UNKNOWN"
                    value={fallbackType}
                    onChange={(e) => setFallbackType(e.target.value)}
                  />
                </Box>
              )}
            </Box>

            {/* OPTIONS */}
            <Box>
              <Typography sx={{ fontWeight: 600 }}>If a MID is already in the app:</Typography>
              <RadioGroup value={onDuplicate} onChange={(e) => setOnDuplicate(e.target.value)}>
                <FormControlLabel value="skip" control={<Radio size="small" />} label="Leave it as it is" />
                <FormControlLabel
                  value="owner"
                  control={<Radio size="small" />}
                  label="Move it to the account above (keep the values entered in the app)"
                />
                <FormControlLabel
                  value="update"
                  control={<Radio size="small" />}
                  label="Move it, and overwrite its type, blocked fields and Y/N items from the workbook"
                />
              </RadioGroup>
              <FormControlLabel
                control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                label="Remember which sheet belongs to which account (shown on the Accounts page)"
              />
            </Box>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          {result ? "Close" : "Cancel"}
        </Button>
        {!result && sheets.length > 0 && (
          <Button
            variant="contained"
            color="secondary"
            onClick={runImport}
            disabled={busy || importable.length === 0}
          >
            Import {importable.length || ""} vehicle(s)
          </Button>
        )}
      </DialogActions>

      {editingSheet && (
        <ColumnsDialog
          sheet={editingSheet}
          layout={editingSheet.layout}
          onClose={() => setEditing(null)}
          onSave={(layout) => {
            const changes = { layout };
            if (!editingSheet.ownerId) {
              Object.assign(changes, sheetDefaults(editingSheet.name, layout, accounts));
            }
            updateSheet(editingSheet.name, changes);
            setEditing(null);
          }}
        />
      )}
    </Dialog>
  );
};

export default ImportDialog;
