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
} from "@mui/material";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import { NavList } from "./Sidebar";
import { ColorModeContext, tokens } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import ChangePasswordDialog from "../../components/ChangePasswordDialog";
import MyAccountDialog from "../../components/MyAccountDialog";
import ClaimSheetDialog from "../../components/ClaimSheetDialog";

const Topbar = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const colorMode = useContext(ColorModeContext);
  const { user, logout } = useAuth();
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
        <Typography variant="h4" noWrap sx={{ fontWeight: 700, color: colors.grey[100] }}>
          FLEET ADMIN
        </Typography>
      </Box>
      <Box sx={{ flex: 1 }} />
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
