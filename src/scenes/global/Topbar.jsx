import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import {
  Box,
  Button,
  ClickAwayListener,
  Collapse,
  IconButton,
  Paper,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
  useTheme,
  Divider,
  Switch,
} from "@mui/material";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import BlurOnOutlinedIcon from "@mui/icons-material/BlurOnOutlined";
import BlurOffOutlinedIcon from "@mui/icons-material/BlurOffOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckIcon from "@mui/icons-material/Check";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import { usePrefs } from "../../prefs/PrefsContext";
import { api } from "../../api/client";
import { NODES } from "../../../shared/nodes.js";
import { NavList } from "./Sidebar";
import { ColorModeContext, tokens, PANEL } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import ChangePasswordDialog from "../../components/ChangePasswordDialog";
import MyAccountDialog from "../../components/MyAccountDialog";
import ArgusBrand from "../../components/ArgusBrand";
import ArgusMark from "../../components/ArgusMark";
import ClaimSheetDialog from "../../components/ClaimSheetDialog";

function formatGmt8Date(date = new Date()) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  return `${formatted}`;
}

const Topbar = () => {
  const theme = useTheme();
  const { glass, colorLabels, toggleGlass, toggleColorLabels } = usePrefs();
  const colors = tokens(theme.palette.mode);
  const colorMode = useContext(ColorModeContext);
  const { user, logout, node, switchNode, leaveNode } = useAuth();
  const [nodeAnchor, setNodeAnchor] = useState(null); // Super Admin's node menu
  const [nodeCounts, setNodeCounts] = useState({}); // key -> { accounts, vehicles }
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const openNodes = (event) => {
    setNodeAnchor(event.currentTarget);
    api("/nodes/summary")
      .then((d) => setNodeCounts(Object.fromEntries(d.nodes.map((n) => [n.key, n]))))
      .catch(() => {});
  };
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false); // phone drop-down menu
  const { pathname } = useLocation();

  // new page: close the phone menu and start at the top
  useEffect(() => {
    setNavOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <ClickAwayListener onClickAway={() => setNavOpen(false)}>
    <Box
      component="header"
      sx={{
        // on phones the bar stays at the top while scrolling, like a website header
        position: { xs: "sticky", md: "static" },
        top: 0,
        zIndex: theme.zIndex.appBar,
        backgroundColor: { xs: "background.default", md: "transparent" },
        // glass look: the bar stays readable over the page scrolling under it
        ...(theme.argus?.glass ? { backdropFilter: { xs: "blur(18px) saturate(165%)", md: "none" }, WebkitBackdropFilter: { xs: "blur(18px) saturate(165%)", md: "none" } } : {}),
        boxShadow: { xs: navOpen ? 0 : `0 1px 0 ${theme.palette.divider}`, md: "none" },
      }}
    >
    <Box sx={{ display: "flex", alignItems: "center", px: { xs: 1, sm: 2 }, py: { xs: 1, md: 2 }, gap: { xs: 0.5, sm: 1 } }}>
      {/* PHONE ONLY: menu button + name (the sidebar is hidden below 900px) */}
      <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 0.5, minWidth: 0 }}>
        <IconButton
          aria-label={navOpen ? "Close menu" : "Open menu"}
          aria-expanded={navOpen}
          aria-controls="phone-menu"
          onClick={() => setNavOpen((open) => !open)}
        >
          {navOpen ? <CloseOutlinedIcon /> : <MenuOutlinedIcon />}
        </IconButton>
        <ArgusBrand size="xs" node={node?.key} color={colors.grey[100]} captionColor={colors.greenAccent[500]} />
      </Box>

      {/* Current GMT+8 date (inlined in Topbar so it appears on every page) */}
      <Box
        sx={{
          display: { xs: "none", sm: "inline-flex" },
          alignItems: "center",
          gap: 1,
          ml: { md: 1 },
          px: 1.5,
          py: 0.5,
          borderRadius: "4px",
          ...PANEL,
          border: `1px solid ${colors.primary[300] ?? colors.grey[700]}`,
          color: colors.grey[100],
          whiteSpace: "nowrap",
        }}
      >
        <CalendarTodayOutlinedIcon sx={{ fontSize: 19, color: colors.grey[300] }} />
        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "1.5rem" }}>
          {formatGmt8Date(now)}
        </Typography>
      </Box>

      <Box sx={{ flex: 1 }} />
      {/* which node you're in; the Super Admin can switch here */}
      {node && (
        <Button
          size="small"
          variant="outlined"
          color="secondary"
          startIcon={<HubOutlinedIcon />}
          endIcon={user.superAdmin ? <ExpandMoreIcon /> : null}
          onClick={user.superAdmin ? openNodes : undefined}
          disableRipple={!user.superAdmin}
          aria-label={user.superAdmin ? `Node ${node.name} - switch node` : `Node ${node.name}`}
          sx={{
            fontWeight: 800,
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            cursor: user.superAdmin ? "pointer" : "default",
            mr: { xs: 0, sm: 1 },
            "& .MuiButton-startIcon": { display: { xs: "none", sm: "inherit" } },
          }}
        >
          {node.name}
        </Button>
      )}
      <Menu
        anchorEl={nodeAnchor}
        open={!!nodeAnchor}
        onClose={() => setNodeAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, display: "block", opacity: 0.7 }}>
          Super Admin: switch node
        </Typography>
        {NODES.map((n) => {
          const c = nodeCounts[n.key];
          return (
            <MenuItem
              key={n.key}
              selected={n.key === node?.key}
              onClick={() => {
                setNodeAnchor(null);
                if (n.key !== node?.key) switchNode(n.key);
              }}
              sx={{ minWidth: 240 }}
            >
              <ListItemIcon sx={{ minWidth: 44 }}>
                <ArgusMark size={30} node={n.key} animate={false} />
              </ListItemIcon>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>{n.name}</Typography>
                {c && c.accounts !== null && (
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    {c.accounts} account(s) · {c.vehicles} vehicle(s)
                  </Typography>
                )}
              </Box>
              {n.key === node?.key && <CheckIcon fontSize="small" sx={{ ml: 1, opacity: 0.8 }} />}
            </MenuItem>
          );
        })}
      </Menu>
      {/* glass look on / off (also in the account menu) */}
      <IconButton
        onClick={toggleGlass}
        title={glass ? "Glass effect: on - click to turn off" : "Glass effect: off - click to turn on"}
        aria-label="Glass effect on or off (top bar)"
        aria-pressed={glass}
        sx={glass ? { color: theme.palette.mode === "dark" ? "#4fb3bb" : "#1c6f68" } : undefined}
      >
        {glass ? <BlurOnOutlinedIcon /> : <BlurOffOutlinedIcon />}
      </IconButton>
      <IconButton
        onClick={colorMode.toggleColorMode}
        title="Switch light / dark mode"
        aria-label="Switch light / dark mode"
      >
        {theme.palette.mode === "dark" ? <DarkModeOutlinedIcon /> : <LightModeOutlinedIcon />}
      </IconButton>

      <Button
        color="inherit"
        startIcon={<AccountCircleOutlinedIcon />}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        aria-label="Account menu"
        sx={{
          textTransform: "none",
          color: colors.grey[100],
          minWidth: 0,
          // icon only on phones
          "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } },
        }}
      >
        <Box sx={{ textAlign: "left", lineHeight: 1.2, display: { xs: "none", sm: "block" } }}>
          <Typography component="div" sx={{ fontWeight: 600 }}>
            {user.name}
          </Typography>
          <Typography component="div" variant="caption" sx={{ color: colors.greenAccent[400] }}>
            {user.roleLabel}
          </Typography>
        </Box>
      </Button>

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setAccountOpen(true);
          }}
        >
          <ListItemIcon>
            <ManageAccountsOutlinedIcon fontSize="small" />
          </ListItemIcon>
          My account (name &amp; username)
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setSheetOpen(true);
          }}
        >
          <ListItemIcon>
            <TableChartOutlinedIcon fontSize="small" />
          </ListItemIcon>
          My worksheet{user.sheets?.length ? ` (${user.sheets.join(", ")})` : ""}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setPasswordOpen(true);
          }}
        >
          <ListItemIcon>
            <KeyOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Change password
        </MenuItem>
        {!user.superAdmin && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              leaveNode(); // back to the node picker (logs out of this node)
            }}
          >
            <ListItemIcon>
              <HubOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Change node
          </MenuItem>
        )}
        <Divider />
        {/* look-and-feel switches (kept in this browser) - the menu stays open to see the change */}
        <MenuItem onClick={toggleGlass} aria-label="Glass effect on or off">
          <ListItemIcon>
            <BlurOnOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <Box sx={{ flex: 1, pr: 1 }}>Glass effect</Box>
          <Switch size="small" checked={glass} tabIndex={-1} sx={{ pointerEvents: "none" }} />
        </MenuItem>
        <MenuItem onClick={toggleColorLabels} aria-label="Coloured stat labels on or off">
          <ListItemIcon>
            <LabelOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <Box sx={{ flex: 1, pr: 1 }}>Coloured stat labels</Box>
          <Switch size="small" checked={colorLabels} tabIndex={-1} sx={{ pointerEvents: "none" }} />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            logout();
          }}
        >
          <ListItemIcon>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      {accountOpen && <MyAccountDialog onClose={() => setAccountOpen(false)} />}
      {sheetOpen && <ClaimSheetDialog onClose={() => setSheetOpen(false)} />}
    </Box>

    {/* PHONE DROP-DOWN MENU: a panel that slides down under the bar */}
    <Collapse
      in={navOpen}
      // opens with a short slide, closes instantly so the new page shows straight away
      timeout={{ enter: 180, exit: 0 }}
      unmountOnExit
      sx={{ display: { md: "none" }, position: "absolute", left: 0, right: 0, top: "100%" }}
    >
      <Paper
        id="phone-menu"
        square
        elevation={8}
        sx={{ maxHeight: "calc(100dvh - 64px)", overflowY: "auto", pb: 1.5, backgroundColor: "background.paper" }}
      >
        <Box sx={{ px: 2.5, pt: 1.5, pb: 0.5 }}>
          <Typography sx={{ fontWeight: 700 }}>{user.name}</Typography>
          <Typography variant="caption" sx={{ color: colors.greenAccent[400] }}>
            {user.roleLabel}
          </Typography>
        </Box>
        <NavList onNavigate={() => setNavOpen(false)} />
      </Paper>
    </Collapse>
    </Box>
    </ClickAwayListener>
  );
};

export default Topbar;