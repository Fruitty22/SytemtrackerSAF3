// The AI assistant: a chat button on every page.
// Ask how to do something, ask about the fleet ("how many 6 TON GS are down?"),
// or ask for a change ("set 21714 AIRCON to N"). Changes come back as cards and
// are only saved when you press Confirm - through the same API the pages use,
// so the server checks permissions and values again.
import { Fragment, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Fab,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useVehicles } from "../../data/VehiclesContext";
import { navItems } from "../../navigation";

const STORE_KEY = "fleet.assistant";
// the only API calls a card may make (anything else is refused here)
const ALLOWED = [
  { method: "PATCH", re: /^\/vehicles\/[\w-]+$/ },
  { method: "POST", re: /^\/vehicles$/ },
  { method: "POST", re: /^\/events$/ },
];

const SUGGESTIONS = {
  admin: [
    "How do I import the commanders' Excel files?",
    "How many vehicles are unavailable, and why?",
    "Which vehicles are on tasking today?",
    "Set MID 21714 VOR STATUS to X",
  ],
  commander: [
    "How do I mark a vehicle as blocked?",
    "Which of my vehicles are not available?",
    "Book 21714 for tasking XCA tomorrow",
    "What does DEPLOYED mean?",
  ],
};

const load = (key) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};
const store = (key, items) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(items.slice(-40)));
  } catch {
    /* storage blocked: the chat just won't survive a refresh */
  }
};

// a little formatting: **bold**, `code`, "- " bullets, numbered lines
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith("`") && part.endsWith("`") ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}
function Formatted({ text }) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <Box key={i} sx={{ height: 6 }} />;
    const bullet = /^[-*•]\s+/.test(trimmed);
    const heading = /^#{1,4}\s+/.test(trimmed);
    const content = trimmed.replace(/^[-*•]\s+/, "").replace(/^#{1,4}\s+/, "");
    return (
      <Typography
        key={i}
        variant="body2"
        component="div"
        sx={{ pl: bullet ? 2 : 0, textIndent: bullet ? -10 : 0, fontWeight: heading ? 700 : 400, mb: 0.25 }}
      >
        {bullet && "• "}
        {inline(content)}
      </Typography>
    );
  });
}

const ActionCard = ({ action, onConfirm, onCancel }) => {
  const done = action.state === "saved";
  const failed = action.state === "failed";
  const cancelled = action.state === "cancelled";
  return (
    <Paper variant="outlined" sx={{ p: 1.25, mt: 1, opacity: cancelled ? 0.55 : 1, borderColor: done ? "success.main" : failed ? "error.main" : undefined }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {action.title}
      </Typography>
      {action.changes.map((c) => (
        <Typography key={c.field} variant="caption" component="div">
          {c.field}: {c.from ? <s>{c.from}</s> : null}
          {c.from ? " → " : ""}
          <strong>{c.to || "(cleared)"}</strong>
        </Typography>
      ))}
      {action.statusAfter && (
        <Typography variant="caption" component="div" sx={{ opacity: 0.8 }}>
          Status: {action.statusBefore && action.statusBefore !== action.statusAfter ? `${action.statusBefore} → ` : ""}
          {action.statusAfter}
        </Typography>
      )}
      {action.state === "pending" && (
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <Button size="small" variant="contained" color="secondary" onClick={onConfirm}>
            Confirm
          </Button>
          <Button size="small" color="inherit" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      )}
      {action.state === "saving" && <CircularProgress size={18} sx={{ mt: 1 }} />}
      {done && (
        <Typography variant="caption" color="success.main" sx={{ fontWeight: 700 }}>
          Saved
        </Typography>
      )}
      {cancelled && <Typography variant="caption">Cancelled</Typography>}
      {failed && (
        <Typography variant="caption" color="error.main" component="div">
          Not saved: {action.error}
        </Typography>
      )}
    </Paper>
  );
};

const Assistant = () => {
  const { user } = useAuth();
  const { refresh } = useVehicles();
  const { pathname } = useLocation();
  const phone = useMediaQuery("(max-width:600px)");
  const [open, setOpen] = useState(false);
  const storeKey = `${STORE_KEY}.${user.id}`;
  const [items, setItems] = useState(() => load(storeKey)); // [{ role, content, actions? }]
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(null); // "Built-in" | "AI (Groq, free tier)" ...
  const bottom = useRef(null);

  useEffect(() => store(storeKey, items), [storeKey, items]);
  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, open, busy]);
  useEffect(() => {
    if (!open || mode !== null) return;
    api("/assistant/status")
      .then((d) => setMode(d.mode))
      .catch(() => setMode(""));
  }, [open, mode]);

  const page = navItems.find((n) => n.to === pathname)?.title ?? "";

  const send = async (text) => {
    const question = String(text ?? input).trim();
    if (!question || busy) return;
    setInput("");
    setError("");
    const next = [...items, { role: "user", content: question }];
    setItems(next);
    setBusy(true);
    try {
      const data = await api("/assistant/chat", {
        method: "POST",
        body: { messages: next.map(({ role, content }) => ({ role, content })), page },
      });
      setItems((list) => [
        ...list,
        { role: "assistant", content: data.reply, actions: (data.actions ?? []).map((a) => ({ ...a, state: "pending" })) },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setAction = (msgIndex, id, changes) =>
    setItems((list) =>
      list.map((m, i) => (i === msgIndex ? { ...m, actions: m.actions.map((a) => (a.id === id ? { ...a, ...changes } : a)) } : m))
    );

  const confirm = async (msgIndex, action) => {
    const ok = ALLOWED.some((a) => a.method === action.request.method && a.re.test(action.request.path));
    if (!ok) return setAction(msgIndex, action.id, { state: "failed", error: "This kind of change isn't allowed from the chat." });
    setAction(msgIndex, action.id, { state: "saving" });
    try {
      await api(action.request.path, { method: action.request.method, body: action.request.body });
      setAction(msgIndex, action.id, { state: "saved" });
      return true;
    } catch (err) {
      setAction(msgIndex, action.id, { state: "failed", error: err.message });
      return false;
    }
  };

  // after confirming, tell the assistant (in the history) what was saved
  const note = (text) => setItems((list) => [...list, { role: "assistant", content: text, system: true }]);

  const confirmOne = async (msgIndex, action) => {
    const saved = await confirm(msgIndex, action);
    await refresh();
    note(saved ? `(Saved: ${action.title}.)` : `(Not saved: ${action.title}.)`);
  };
  const confirmAll = async (msgIndex) => {
    const pending = items[msgIndex].actions.filter((a) => a.state === "pending");
    let saved = 0;
    for (const a of pending) if (await confirm(msgIndex, a)) saved += 1;
    await refresh();
    note(`(Saved ${saved} of ${pending.length} changes.)`);
  };
  const cancelOne = (msgIndex, action) => {
    setAction(msgIndex, action.id, { state: "cancelled" });
    note(`(Cancelled: ${action.title}.)`);
  };

  const panel = (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        zIndex: 1300,
        right: phone ? 0 : 20,
        bottom: phone ? 0 : 20,
        width: phone ? "100vw" : 420,
        height: phone ? "100dvh" : "min(640px, calc(100vh - 40px))",
        display: "flex",
        flexDirection: "column",
        borderRadius: phone ? 0 : 2,
        overflow: "hidden",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, bgcolor: "secondary.main", color: "secondary.contrastText" }}>
        <SmartToyOutlinedIcon />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>Fleet assistant</Typography>
          {mode && (
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {mode === "Built-in" ? "Built-in · free · works offline" : mode}
            </Typography>
          )}
        </Box>
        <Tooltip title="Clear the chat">
          <IconButton size="small" color="inherit" onClick={() => setItems([])} disabled={busy}>
            <DeleteSweepOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" color="inherit" onClick={() => setOpen(false)} aria-label="Close the assistant">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        {items.length === 0 && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Hi {user.name}! Ask me how to use any page, about your vehicles, or to make a change - I&rsquo;ll show
              each change for you to confirm before anything is saved.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {(SUGGESTIONS[user.role] ?? SUGGESTIONS.commander).map((s) => (
                <Chip key={s} label={s} size="small" variant="outlined" onClick={() => send(s)} sx={{ height: "auto", "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 } }} />
              ))}
            </Box>
          </Box>
        )}
        {items.map((m, i) =>
          m.system ? (
            <Typography key={i} variant="caption" sx={{ alignSelf: "center", opacity: 0.7 }}>
              {m.content.replace(/^\(|\)$/g, "")}
            </Typography>
          ) : (
            <Box
              key={i}
              sx={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "88%",
                px: 1.5,
                py: 1,
                borderRadius: 2,
                bgcolor: m.role === "user" ? "secondary.main" : "action.hover",
                color: m.role === "user" ? "secondary.contrastText" : "text.primary",
              }}
            >
              {m.role === "user" ? <Typography variant="body2">{m.content}</Typography> : <Formatted text={m.content} />}
              {m.actions?.map((a) => (
                <ActionCard key={a.id} action={a} onConfirm={() => confirmOne(i, a)} onCancel={() => cancelOne(i, a)} />
              ))}
              {m.actions?.filter((a) => a.state === "pending").length > 1 && (
                <Button size="small" variant="outlined" color="secondary" sx={{ mt: 1 }} onClick={() => confirmAll(i)}>
                  Confirm all {m.actions.filter((a) => a.state === "pending").length}
                </Button>
              )}
            </Box>
          )
        )}
        {busy && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.7 }}>
            <CircularProgress size={16} />
            <Typography variant="caption">Looking into it...</Typography>
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        <div ref={bottom} />
      </Box>

      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        sx={{ display: "flex", gap: 1, p: 1.25, borderTop: 1, borderColor: "divider" }}
      >
        <TextField
          size="small"
          fullWidth
          multiline
          maxRows={4}
          placeholder="Ask or tell me what to change..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          slotProps={{ htmlInput: { maxLength: 2000, "aria-label": "Message to the assistant" } }}
        />
        <IconButton type="submit" color="secondary" disabled={busy || !input.trim()} aria-label="Send">
          <SendIcon />
        </IconButton>
      </Box>
      <Typography variant="caption" sx={{ px: 1.5, pb: 1, opacity: 0.6 }}>
        Check each card before you confirm - nothing is saved until you do.
      </Typography>
    </Paper>
  );

  return open ? (
    panel
  ) : (
    <Tooltip title="Ask the fleet assistant" placement="left">
      <Fab
        color="secondary"
        onClick={() => setOpen(true)}
        aria-label="Open the fleet assistant"
        sx={{ position: "fixed", right: 20, bottom: 20, zIndex: 1200 }}
      >
        <SmartToyOutlinedIcon />
      </Fab>
    </Tooltip>
  );
};

export default Assistant;
