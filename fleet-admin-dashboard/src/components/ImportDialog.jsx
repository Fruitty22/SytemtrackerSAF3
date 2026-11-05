import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import { useAuth } from "../auth/AuthContext";
import { useVehicles } from "../data/VehiclesContext";
import { api } from "../api/client";
import {
  checkSheet,
  columnLetter,
  detectLayout,
  isConfigSheet,
  isGeneralSheet,
  layoutFromHeader,
  matchAccount,
  mergeSheets,
  readCriteriaConfig,
  readDisregardConfig,
  readVehicles,
  scanCriteria,
  typeStandardizer,
} from "../utils/workbook";
import { BLOCK_FIELDS, DEFAULT_VEHICLE_TYPES, GENERAL_SHEETS, UNASSIGNED } from "../../shared/config.js";
import { CATEGORIES } from "../../shared/criteria.js";
import { sheetKey } from "../../shared/naming.js";
import { titlesMatch } from "../../shared/titles.js";

const SKIP = "";
// "Sheet1", "Sheet 2"... - Excel's default names, which say nothing about whose sheet it is
const GENERIC_NAME = /^sheet\s*\d*$/i;
const STEPS = ["Choose files", "Check files", "Scan criteria", "Review & import"];

// kind of sheet -> how strongly it decides a vehicle's owner (see mergeSheets)
//   linked:    belongs to an account (claimed / matched by name / chosen here)
//   unclaimed: a commander's sheet with no account yet; Unassigned until claimed
//   general:   a whole-fleet report sheet (Dashboard, MID Details...)
const PRIORITY = { linked: 3, unclaimed: 2, general: 1 };

function sheetDefaults(name, layout, accounts) {
  const general = isGeneralSheet(name, GENERAL_SHEETS);
  // report sheets the macros made: not imported unless you choose to
  if (general) return { ownerId: SKIP, kind: "general" };
  if (!layout) return { ownerId: SKIP, kind: "unclaimed" };
  const owner = matchAccount(name, accounts);
  if (owner) return { ownerId: owner.id, kind: "linked" };
  return { ownerId: UNASSIGNED, kind: "unclaimed" };
}

// "3SG Rizq.xlsx" -> "3SG Rizq" (an Excel sheet name is at most 31 characters)
const baseName = (file) => file.replace(/\.[^.]+$/, "").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31);

const LEVEL_ICON = {
  ok: <CheckCircleOutlineIcon fontSize="small" color="success" />,
  error: <ErrorOutlineIcon fontSize="small" color="error" />,
  warning: <WarningAmberIcon fontSize="small" color="warning" />,
  info: <InfoOutlinedIcon fontSize="small" color="info" />,
};

// ---- the macro's File Check report for one sheet
const CheckChip = ({ report, onClick, open }) => {
  if (!report) return null;
  const { errors, warnings } = report;
  const color = errors ? "error" : warnings ? "warning" : "success";
  const label = errors
    ? `${errors} error(s)${warnings ? `, ${warnings} warning(s)` : ""}`
    : warnings
      ? `${warnings} warning(s)`
      : "SOP-compliant";
  return (
    <Chip
      size="small"
      color={color}
      variant={open ? "filled" : "outlined"}
      label={label}
      onClick={onClick}
      icon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
    />
  );
};

const CheckReport = ({ report }) => (
  <Box sx={{ p: 1.5, borderRadius: "4px", bgcolor: "action.hover", fontSize: 14 }}>
    <Typography variant="subtitle2" sx={{ mb: 1 }}>
      FILE CHECK REPORT · {report.sheet}
    </Typography>
    {report.items.map((item) => (
      <Box key={item.text} sx={{ mb: 0.75 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          {LEVEL_ICON[item.level]}
          <Typography variant="body2">{item.text}</Typography>
        </Box>
        {item.details.length > 0 && (
          <Box sx={{ pl: 4.5 }}>
            {item.details.slice(0, 15).map((d) => (
              <Typography key={d} variant="caption" component="div">
                {d}
              </Typography>
            ))}
            {item.details.length > 15 && (
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                ...and {item.details.length - 15} more
              </Typography>
            )}
          </Box>
        )}
      </Box>
    ))}
    <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
      SUMMARY: {report.errors} error(s), {report.warnings} warning(s) -{" "}
      {report.errors === 0 && report.warnings === 0
        ? "this sheet is fully SOP-compliant."
        : report.errors === 0
          ? "no critical errors, but review the warnings above."
          : "critical issues found - fix them in the file, or check the result after importing."}
    </Typography>
  </Box>
);

// ---- fix one sheet's columns by hand (only needed if auto-detect got it wrong)
const ColumnsDialog = ({ sheet, criteria, onSave, onClose }) => {
  const start = sheet.layout ?? { headerRow: 1, mid: "", type: "", fixedType: "" };
  const [form, setForm] = useState({
    headerRow: start.headerRow,
    mid: start.mid,
    type: start.type,
    fixedType: start.fixedType ?? "",
  });
  const header = sheet.rows[form.headerRow - 1] ?? [];
  const layoutNow =
    form.mid === ""
      ? null
      : layoutFromHeader(sheet.rows, form.headerRow, form.mid, criteria, { type: form.type, fixedType: form.fixedType });
  const width = sheet.rows.reduce((max, r) => Math.max(max, r.length), 0);
  const options = Array.from({ length: width }, (_, i) => ({
    value: i,
    label: `${columnLetter(i)}${String(header[i] ?? "").trim() ? ` - ${String(header[i]).trim()}` : ""}`,
  }));
  const preview = readVehicles(sheet.rows, layoutNow, BLOCK_FIELDS.map((f) => f.name));
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
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value === "" ? "" : Number(e.target.value) }))}
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
            onChange={(e) => setForm((f) => ({ ...f, headerRow: Math.max(1, Number(e.target.value) || 1) }))}
            sx={{ width: 170 }}
          />
          {pick("mid", "MID number column")}
          {pick("type", "Vehicle type column", true)}
        </Box>
        <Typography variant="body2">
          {layoutNow && Object.keys(layoutNow.fields).length
            ? `Criteria columns (matched by their title): ${Object.entries(layoutNow.fields)
                .map(([f, c]) => `${f} (${columnLetter(c)})`)
                .join(", ")}`
            : "No criteria columns on this header row."}
        </Typography>
        {form.type === "" && (
          <TextField
            size="small"
            label="Vehicle type for every row on this sheet (optional)"
            helperText="Leave empty to take the type from another sheet that lists the same MID"
            value={form.fixedType}
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
        <Button variant="contained" color="secondary" disabled={!layoutNow} onClick={() => onSave(form)}>
          Use these columns
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ---- step 3: the macro's Scan Criteria / "New criteria detected" form
const ScanStep = ({ found, workbookCriteria, onClassify, busy }) => {
  const [selected, setSelected] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const list = found.filter((f) => !skipped.includes(f.title));
  const fromWorkbook = (title) => workbookCriteria.find((c) => titlesMatch(c.name, title))?.category ?? null;
  const withWorkbookAnswer = list.filter((f) => fromWorkbook(f.title));

  useEffect(() => {
    setSelected((s) => s.filter((t) => list.some((f) => f.title === t)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found, skipped]);

  if (list.length === 0) {
    return (
      <Alert severity="success">
        All columns on all fleet sheets are classified. Nothing to do here - press Next.
      </Alert>
    );
  }
  const allTicked = selected.length === list.length;
  const classify = async (category) => {
    await onClassify(selected.map((name) => ({ name, category })));
    setSelected([]);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography>
        <strong>{list.length}</strong> unclassified column(s) found across all fleet sheets. Is each one a{" "}
        <strong>Maintenance</strong> item (checked Y / N) or a <strong>Blocked vehicle</strong> field (free text, e.g.
        TASKING / STANDBY)? Columns that are just information (due dates, inspection dates) are{" "}
        <strong>Not a criteria</strong> and won&rsquo;t be asked about again.
      </Typography>
      {withWorkbookAnswer.length > 0 && (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              disabled={busy}
              onClick={() =>
                onClassify(withWorkbookAnswer.map((f) => ({ name: f.title, category: fromWorkbook(f.title) })))
              }
            >
              Use them
            </Button>
          }
        >
          The workbook&rsquo;s CriteriaConfig sheet already classifies {withWorkbookAnswer.length} of these.
        </Alert>
      )}
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allTicked}
                  indeterminate={selected.length > 0 && !allTicked}
                  onChange={() => setSelected(allTicked ? [] : list.map((f) => f.title))}
                />
              </TableCell>
              <TableCell>Column</TableCell>
              <TableCell>Found on</TableCell>
              <TableCell>Values in it</TableCell>
              <TableCell>Looks like</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((f) => {
              const hint = fromWorkbook(f.title) ?? f.suggestion;
              return (
                <TableRow
                  key={f.title}
                  hover
                  onClick={() =>
                    setSelected((s) => (s.includes(f.title) ? s.filter((t) => t !== f.title) : [...s, f.title]))
                  }
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox checked={selected.includes(f.title)} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{f.title}</TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>
                    <Typography variant="body2" noWrap title={f.sheets.join(", ")}>
                      {f.sheets.length} sheet(s): {f.sheets.join(", ")}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {f.samples.length ? f.samples.join(", ") : <em>empty</em>}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {hint ? (
                      <Chip
                        size="small"
                        label={`${CATEGORIES[hint]}${fromWorkbook(f.title) ? " (workbook)" : ""}`}
                        color={hint === "MAINTENANCE" ? "success" : hint === "BLOCKED" ? "warning" : "default"}
                        variant="outlined"
                      />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button variant="contained" color="success" disabled={busy || !selected.length} onClick={() => classify("MAINTENANCE")}>
          Add as Maintenance
        </Button>
        <Button variant="contained" color="warning" disabled={busy || !selected.length} onClick={() => classify("BLOCKED")}>
          Add as Blocked
        </Button>
        <Button variant="outlined" color="inherit" disabled={busy || !selected.length} onClick={() => classify("IGNORE")}>
          Not a criteria
        </Button>
        <Button
          color="inherit"
          disabled={busy || !selected.length}
          onClick={() => {
            setSkipped((s) => [...s, ...selected]);
            setSelected([]);
          }}
        >
          Skip for now
        </Button>
        {busy && <CircularProgress size={22} sx={{ alignSelf: "center" }} />}
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        Saved straight away, for every import from now on. Change them later on the Manage Criteria page. Skipped
        columns are not imported and will be asked about next time.
      </Typography>
    </Box>
  );
};

// ---- the import dialog
// Takes the commanders' own Excel files (or a whole workbook) and does the
// macros' work here: standardise columns, Check File, Scan Criteria, then import.
const ImportDialog = ({ onClose }) => {
  const { user } = useAuth(); // only Admins can open this dialog
  const { users, vehicles, vehicleTypes, criteria, saveCriteria, importVehicles, refresh } = useVehicles();
  const fileInput = useRef(null);
  const accounts = users;

  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]); // file names
  const [sheets, setSheets] = useState([]); // [{ id, name, file, rows, manual, ownerId, kind, ownerTouched }]
  const [workbookCriteria, setWorkbookCriteria] = useState([]); // from a CriteriaConfig sheet
  const [workbookDisregards, setWorkbookDisregards] = useState({}); // from a DisregardConfig sheet
  const [useDisregards, setUseDisregards] = useState(true);
  const [editing, setEditing] = useState(null); // sheet id whose columns are being fixed
  const [openReport, setOpenReport] = useState(null);
  const [onDuplicate, setOnDuplicate] = useState("update");
  const [remember, setRemember] = useState(true);
  const [fallbackType, setFallbackType] = useState("");
  const [toDelete, setToDelete] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [undone, setUndone] = useState(null);

  const readFiles = async (event) => {
    const chosen = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!chosen.length) return;
    setBusy(true);
    setError("");
    try {
      const parsed = [];
      const configCriteria = [];
      const configDisregards = {};
      for (const file of chosen) {
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
        const fileSheets = [];
        wb.SheetNames.forEach((name, i) => {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
            header: 1,
            defval: "",
            raw: false,
            blankrows: true, // keep blank rows so row numbers match Excel
          });
          if (sheetKey(name) === sheetKey("CriteriaConfig")) configCriteria.push(...readCriteriaConfig(rows));
          if (sheetKey(name) === sheetKey("DisregardConfig")) Object.assign(configDisregards, readDisregardConfig(rows));
          if (isConfigSheet(name)) return;
          fileSheets.push({ name, rows, hidden: (wb.Workbook?.Sheets?.[i]?.Hidden ?? 0) !== 0 });
        });
        // A commander's own file (one fleet sheet, none of the macro sheets) is
        // named after the file, like the macro's Import File did
        // (a file with the macros' own sheets - Dashboard, CriteriaConfig... - is the whole workbook)
        const withVehicles = fileSheets.filter((s) => detectLayout(s.rows, criteria));
        const macroWorkbook =
          wb.SheetNames.some(isConfigSheet) ||
          fileSheets.some((s) => isGeneralSheet(s.name, GENERAL_SHEETS) && !GENERIC_NAME.test(s.name));
        const ownFile = withVehicles.length === 1 && !macroWorkbook;
        for (const s of fileSheets) {
          const named = ownFile && s === withVehicles[0];
          const name = named || (GENERIC_NAME.test(s.name) && withVehicles.includes(s)) ? baseName(file.name) : s.name;
          parsed.push({ ...s, name, file: file.name });
        }
      }
      // two files with the same sheet name: number them
      const seen = new Map();
      for (const s of parsed) {
        const key = sheetKey(s.name);
        const n = (seen.get(key) ?? 0) + 1;
        seen.set(key, n);
        if (n > 1) s.name = `${s.name.slice(0, 26)} (${n})`;
      }
      setSheets(
        parsed.map((s, i) => {
          const layout = detectLayout(s.rows, criteria);
          return { ...s, id: `${i}:${s.name}`, manual: null, ownerTouched: false, ...sheetDefaults(s.name, layout, accounts) };
        })
      );
      setFiles(chosen.map((f) => f.name));
      setWorkbookCriteria(configCriteria);
      setWorkbookDisregards(configDisregards);
      setResult(null);
      setToDelete([]);
      setStep(1);
    } catch {
      setError("Couldn't read that file. Please choose Excel files (.xlsx, .xlsm, .xls) or .csv.");
    } finally {
      setBusy(false);
    }
  };

  const updateSheet = (id, changes) => setSheets((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));

  // layouts are worked out again whenever the criteria change (after Scan criteria)
  const withLayouts = useMemo(
    () =>
      sheets.map((s) => ({
        ...s,
        layout: s.manual
          ? layoutFromHeader(s.rows, s.manual.headerRow, s.manual.mid, criteria, s.manual)
          : detectLayout(s.rows, criteria),
      })),
    [sheets, criteria]
  );
  const fleetSheets = useMemo(() => withLayouts.filter((s) => s.layout && s.kind !== "general"), [withLayouts]);
  const reports = useMemo(
    () => new Map(fleetSheets.map((s) => [s.id, checkSheet(s.name, s.rows, s.layout, criteria)])),
    [fleetSheets, criteria]
  );
  const found = useMemo(
    () => scanCriteria(fleetSheets.filter((s) => s.ownerId), criteria),
    [fleetSheets, criteria]
  );

  // vehicles per sheet, with vehicle types standardised, then merged (one row per MID)
  const plans = useMemo(() => {
    const standardType = typeStandardizer([...vehicleTypes, ...DEFAULT_VEHICLE_TYPES]);
    const blockNames = BLOCK_FIELDS.map((f) => f.name);
    return withLayouts.map((s) => ({
      ...s,
      vehicles: readVehicles(s.rows, s.layout, blockNames).map((v) => ({ ...v, type: v.type && standardType(v.type) })),
      priority: PRIORITY[s.kind] ?? 1,
    }));
    // criteria: BLOCK_FIELDS changes with it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withLayouts, vehicleTypes, criteria]);
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

  // what the import will change in the app
  const preview = useMemo(() => {
    const byMid = new Map(vehicles.map((v) => [v.mid, v]));
    const differs = (row, v) =>
      row.type !== v.type ||
      Object.entries(row.blocks ?? {}).some(([f, x]) => (x || "") !== (v.blocks?.[f]?.value ?? "")) ||
      Object.entries(row.maintenance ?? {}).some(([f, x]) => (x || "") !== (v.maintenance?.[f]?.level ?? ""));
    let added = 0;
    let changed = 0;
    let same = 0;
    for (const row of importable) {
      const v = byMid.get(row.mid);
      if (!v) added += 1;
      else if (differs(row, v)) changed += 1;
      else same += 1;
    }
    // vehicles that came from these sheets but aren't in the files any more
    const importedSheets = new Set(plans.filter((p) => p.ownerId && p.layout).map((p) => sheetKey(p.name)));
    const mids = new Set(importable.map((r) => r.mid));
    const missing = vehicles.filter(
      (v) => v.sourceSheet && importedSheets.has(sheetKey(v.sourceSheet)) && !mids.has(v.mid)
    );
    return { added, changed, same, missing };
  }, [importable, vehicles, plans]);

  const classify = async (items) => {
    setBusy(true);
    setError("");
    try {
      await saveCriteria({ set: items });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disregardCount = Object.keys(workbookDisregards).length;

  const runImport = async () => {
    setBusy(true);
    setError("");
    try {
      const sheetLinks = {};
      if (remember) {
        for (const s of plans) {
          if (s.kind === "linked" && s.ownerId && s.ownerId !== UNASSIGNED) {
            (sheetLinks[s.ownerId] ??= []).push(s.name);
          }
        }
      }
      // every commander sheet in this import, so commanders can claim theirs
      const commanderSheets = plans
        .filter((p) => p.layout && p.kind !== "general" && p.ownerId)
        .map((p) => ({ name: p.name, vehicles: p.vehicles.length }));
      setResult(
        await importVehicles({
          rows: importable,
          onDuplicate,
          sheetLinks,
          sheets: commanderSheets,
          disregards: useDisregards && disregardCount ? workbookDisregards : undefined,
          deleteIds: toDelete,
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const undoImport = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api("/vehicles/import/undo", { method: "POST" });
      await refresh();
      setUndone(data.restoredTo);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const editingSheet = withLayouts.find((s) => s.id === editing);
  const totalErrors = [...reports.values()].reduce((n, r) => n + r.errors, 0);
  const totalWarnings = [...reports.values()].reduce((n, r) => n + r.warnings, 0);
  const listed = withLayouts.filter((s) => s.layout);
  const noVehicles = withLayouts.filter((s) => !s.layout);

  // ---------------------------------------------------------------- step 2 rows
  const sheetRow = (p) => {
    const report = reports.get(p.id);
    const count = plans.find((x) => x.id === p.id)?.vehicles.length ?? 0;
    return [
      <TableRow key={p.id} sx={{ opacity: p.ownerId ? 1 : 0.55, "& td": { borderBottom: openReport === p.id ? 0 : undefined } }}>
        <TableCell sx={{ minWidth: 170 }}>
          <TextField
            variant="standard"
            size="small"
            value={p.name}
            slotProps={{ htmlInput: { maxLength: 31, style: { fontWeight: 700 }, "aria-label": "Sheet name" } }}
            onChange={(e) => {
              const name = e.target.value;
              const changes = { name };
              if (!p.ownerTouched) Object.assign(changes, sheetDefaults(name, p.layout, accounts));
              updateSheet(p.id, changes);
            }}
            fullWidth
          />
          <Typography variant="caption" sx={{ opacity: 0.65 }}>
            {p.file}
            {p.hidden ? " · hidden sheet" : ""}
          </Typography>
        </TableCell>
        <TableCell align="right">{p.layout ? count : "-"}</TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          {p.layout ? (
            <Typography variant="body2" component="span">
              row {p.layout.headerRow} · MID {columnLetter(p.layout.mid)} · type{" "}
              {p.layout.type === "" ? (p.layout.fixedType ? `"${p.layout.fixedType}"` : "-") : columnLetter(p.layout.type)} ·{" "}
              <span title={Object.keys(p.layout.fields ?? {}).join(", ")}>
                {Object.keys(p.layout.fields ?? {}).length} criteria
              </span>
            </Typography>
          ) : (
            <Typography variant="body2" component="span" sx={{ opacity: 0.7 }}>
              no MID column found
            </Typography>
          )}
          <Button size="small" sx={{ ml: 1 }} onClick={() => setEditing(p.id)}>
            {p.layout ? "Change" : "Set columns"}
          </Button>
        </TableCell>
        <TableCell>
          {p.kind === "general" ? (
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              Report sheet - not checked
            </Typography>
          ) : (
            <CheckChip report={report} open={openReport === p.id} onClick={() => setOpenReport(openReport === p.id ? null : p.id)} />
          )}
        </TableCell>
        <TableCell sx={{ minWidth: 210 }}>
          <TextField
            select
            size="small"
            fullWidth
            value={p.ownerId}
            disabled={!p.layout}
            onChange={(e) =>
              updateSheet(p.id, {
                ownerId: e.target.value,
                ownerTouched: true,
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
          {p.layout && p.ownerId && p.kind === "unclaimed" && (
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              No account yet - Unassigned until its commander claims it
            </Typography>
          )}
          {p.kind === "general" && (
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              Made by the Excel macros (whole fleet)
            </Typography>
          )}
        </TableCell>
      </TableRow>,
      report && (
        <TableRow key={`${p.id}-report`}>
          <TableCell colSpan={5} sx={{ py: 0 }}>
            <Collapse in={openReport === p.id} unmountOnExit>
              <Box sx={{ pb: 1.5 }}>
                <CheckReport report={report} />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      ),
    ];
  };

  // ---------------------------------------------------------------- steps
  let content;
  if (result) {
    content = (
      <Box>
        <Alert severity={result.errors.length ? "warning" : "success"} sx={{ mb: 2 }}>
          Added {result.created}, updated {result.updated}
          {result.unchanged ? `, ${result.unchanged} already up to date` : ""}
          {result.skipped ? `, skipped ${result.skipped} that already existed` : ""}
          {result.deleted ? `, deleted ${result.deleted} no longer in the files` : ""}
          {result.disregardTypes ? `, disregard rules set for ${result.disregardTypes} vehicle type(s)` : ""}.
          {result.errors.length > 0 && ` ${result.errors.length} row(s) had problems:`}
        </Alert>
        {result.errors.map((e) => (
          <Typography key={e} variant="body2" sx={{ ml: 1 }}>
            &bull; {e}
          </Typography>
        ))}
        {undone ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Import undone - everything is back as it was before.
          </Alert>
        ) : (
          (result.created > 0 || result.updated > 0 || result.deleted > 0) && (
            <Box sx={{ mt: 2, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Something look wrong?
              </Typography>
              <Button size="small" color="warning" variant="outlined" startIcon={<UndoOutlinedIcon />} disabled={busy} onClick={undoImport}>
                Undo this import
              </Button>
            </Box>
          )
        )}
      </Box>
    );
  } else if (step === 0) {
    content = (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography sx={{ mb: 1 }}>
          Choose the commanders&rsquo; Excel files - select several at once - or one whole workbook.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>
          No need to run the Excel macros first: column titles are standardised, every file is checked and new
          columns are classified right here.
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, opacity: 0.7 }}>
          Files are read on this computer; only the vehicles are saved to the database.
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <UploadFileOutlinedIcon />}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          Choose Excel files
        </Button>
      </Box>
    );
  } else if (step === 1) {
    content = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <Typography sx={{ flex: "1 1 260px" }}>
            {files.length} file(s) · <strong>{fleetSheets.length}</strong> fleet sheet(s) ·{" "}
            {totalErrors ? (
              <Typography component="span" color="error.main">{totalErrors} error(s)</Typography>
            ) : (
              "no errors"
            )}
            {totalWarnings ? `, ${totalWarnings} warning(s)` : ""}
          </Typography>
          <Button size="small" color="inherit" onClick={() => fileInput.current?.click()}>
            Choose other files
          </Button>
        </Box>
        {(workbookCriteria.length > 0 || disregardCount > 0) && (
          <Alert severity="info">
            This workbook has the Excel macros&rsquo; settings:
            {workbookCriteria.length > 0 && ` ${workbookCriteria.length} classified criteria (offered in Scan criteria)`}
            {workbookCriteria.length > 0 && disregardCount > 0 && " and"}
            {disregardCount > 0 && ` disregard rules for ${disregardCount} vehicle type(s) (imported in the last step)`}.
          </Alert>
        )}
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          Click a check result to see the full File Check report. You can rename a sheet (its name decides which
          commander it belongs to).
        </Typography>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sheet</TableCell>
                <TableCell align="right">Vehicles</TableCell>
                <TableCell>Columns found</TableCell>
                <TableCell>File check</TableCell>
                <TableCell>Give to</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listed.flatMap(sheetRow)}
              {noVehicles.length > 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ pt: 2, opacity: 0.7 }}>
                    No vehicle list found on these sheets (use &ldquo;Set columns&rdquo; if one does have vehicles):
                  </TableCell>
                </TableRow>
              )}
              {noVehicles.flatMap(sheetRow)}
            </TableBody>
          </Table>
        </Box>
      </Box>
    );
  } else if (step === 2) {
    content = <ScanStep found={found} workbookCriteria={workbookCriteria} onClassify={classify} busy={busy} />;
  } else {
    content = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ p: 2, borderRadius: "4px", bgcolor: "action.hover" }}>
          <Typography sx={{ mb: 1 }}>
            <strong>{importable.length}</strong> vehicle(s) in the files:{" "}
            <strong>{preview.added}</strong> new, <strong>{preview.changed}</strong> different from the app,{" "}
            {preview.same} the same
            {merged.duplicates > 0 && ` · ${merged.duplicates} appear on more than one sheet (a commander's own sheet decides who gets it)`}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {perAccount.map((a) => (
              <Chip key={a.id} label={`${a.name}: ${a.n}`} size="small" />
            ))}
          </Box>
          {merged.missingType > 0 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 1 }}>
                {merged.missingType} vehicle(s) have no vehicle type on any sheet and will be left out, unless you
                give them a type here.
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

        {preview.missing.length > 0 && (
          <Box>
            <Typography sx={{ fontWeight: 600 }}>
              {preview.missing.length} vehicle(s) came from these sheets before but are not in the files any more:
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
              They are kept unless you tick them here.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {preview.missing.map((v) => (
                <Chip
                  key={v.id}
                  size="small"
                  label={`${v.mid} · ${v.type}`}
                  color={toDelete.includes(v.id) ? "error" : "default"}
                  variant={toDelete.includes(v.id) ? "filled" : "outlined"}
                  onClick={() => setToDelete((d) => (d.includes(v.id) ? d.filter((x) => x !== v.id) : [...d, v.id]))}
                />
              ))}
            </Box>
            {toDelete.length > 0 && (
              <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                {toDelete.length} will be deleted.
              </Typography>
            )}
          </Box>
        )}

        <Box>
          <Typography sx={{ fontWeight: 600 }}>If a MID is already in the app:</Typography>
          <RadioGroup value={onDuplicate} onChange={(e) => setOnDuplicate(e.target.value)}>
            <FormControlLabel
              value="update"
              control={<Radio size="small" />}
              label="Update it from the files: type, blocked fields, Y/N items and remarks (recommended)"
            />
            <FormControlLabel
              value="owner"
              control={<Radio size="small" />}
              label="Only move it to the account above (keep the values entered in the app)"
            />
            <FormControlLabel value="skip" control={<Radio size="small" />} label="Leave it as it is" />
          </RadioGroup>
          <FormControlLabel
            control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
            label="Remember which sheet belongs to which account (shown on the Accounts page)"
          />
          {disregardCount > 0 && (
            <FormControlLabel
              control={<Checkbox checked={useDisregards} onChange={(e) => setUseDisregards(e.target.checked)} />}
              label={`Also use the workbook's disregard rules (${disregardCount} vehicle type(s))`}
            />
          )}
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          A copy of everything is kept before the import, so you can undo it afterwards.
        </Typography>
      </Box>
    );
  }

  const canNext =
    (step === 1 && fleetSheets.some((s) => s.ownerId)) || step === 2;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Import vehicles from Excel</DialogTitle>
      <DialogContent dividers>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".xlsx,.xlsm,.xls,.csv"
          onChange={readFiles}
          style={{ display: "none" }}
        />
        {!result && (
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
            {STEPS.map((label, i) => (
              <Step key={label} completed={step > i}>
                <StepLabel
                  optional={
                    i === 2 && step >= 1 && found.length > 0 ? (
                      <Typography variant="caption" color="warning.main">
                        {found.length} new column(s)
                      </Typography>
                    ) : undefined
                  }
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        )}
        {content}
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
        {!result && step > 1 && (
          <Button color="inherit" disabled={busy} onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {!result && (step === 1 || step === 2) && (
          <Tooltip title={step === 1 && !canNext ? "Choose who gets at least one sheet" : ""}>
            <span>
              <Button variant="contained" color="secondary" disabled={busy || !canNext} onClick={() => setStep(step + 1)}>
                Next
              </Button>
            </span>
          </Tooltip>
        )}
        {!result && step === 3 && (
          <Button
            variant="contained"
            color="secondary"
            onClick={runImport}
            disabled={busy || importable.length === 0}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Import {importable.length || ""} vehicle(s)
          </Button>
        )}
      </DialogActions>

      {editingSheet && (
        <ColumnsDialog
          sheet={editingSheet}
          criteria={criteria}
          onClose={() => setEditing(null)}
          onSave={(manual) => {
            const changes = { manual };
            if (!editingSheet.ownerId) {
              const layout = layoutFromHeader(editingSheet.rows, manual.headerRow, manual.mid, criteria, manual);
              Object.assign(changes, sheetDefaults(editingSheet.name, layout, accounts));
            }
            updateSheet(editingSheet.id, changes);
            setEditing(null);
          }}
        />
      )}
    </Dialog>
  );
};

export default ImportDialog;
