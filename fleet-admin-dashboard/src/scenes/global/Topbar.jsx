import { useContext, useState } from "react";
import {
  Box,
  Button,
  IconButton,
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

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", p: 2, gap: 1 }}>
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
        sx={{ textTransform: "none", color: colors.grey[100] }}
      >
        <Box sx={{ textAlign: "left", lineHeight: 1.2 }}>
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
  );
};

export default Topbar;
