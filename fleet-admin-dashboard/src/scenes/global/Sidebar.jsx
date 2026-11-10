import { useState } from "react";
import { Link, useLocation } from "react-router";
import {
  Avatar,
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import { tokens } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import { canOpen, navSections } from "../../navigation";

const WIDTH = 270;
const COLLAPSED_WIDTH = 80;

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const Item = ({ title, to, icon: Icon, collapsed, onNavigate }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <ListItemButton
      component={Link}
      to={to}
      onClick={onNavigate}
      title={collapsed ? title : undefined}
      sx={{
        py: "3px",
        pl: "20px",
        pr: collapsed ? "20px" : "35px",
        color: active ? "#6870fa" : colors.grey[100],
        backgroundColor: "transparent",
        "&:hover": { backgroundColor: "transparent", color: "#868dfb" },
      }}
    >
      <ListItemIcon
        sx={{ color: "inherit", minWidth: 0, mr: collapsed ? 0 : "15px" }}
      >
        <Icon />
      </ListItemIcon>
      {!collapsed && <ListItemText primary={title} />}
    </ListItemButton>
  );
};

const SectionTitle = ({ children, collapsed }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  if (collapsed) return null;
  return (
    <Typography
      variant="h6"
      sx={{ color: colors.grey[300], m: "15px 0 5px 20px" }}
    >
      {children}
    </Typography>
  );
};

// The page links. Used by the desktop sidebar and by the phone drop-down menu.
export const NavList = ({ collapsed = false, onNavigate }) => {
  const { user } = useAuth();
  return (
    <List component="nav" disablePadding sx={{ pl: collapsed ? 0 : "10%" }}>
      {navSections.map((section, index) => {
        const items = section.items.filter((item) => canOpen(user, item.key));
        if (items.length === 0) return null;
        return (
          <Box key={section.title ?? index}>
            {section.title && <SectionTitle collapsed={collapsed}>{section.title}</SectionTitle>}
            {items.map((item) => (
              <Item
                key={item.key}
                title={item.title}
                to={item.to}
                icon={item.icon}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </Box>
        );
      })}
    </List>
  );
};

// Desktop / tablet only. On phones (below 900px) the Topbar's menu button
// opens the same links as a drop-down panel instead.
const Sidebar = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  // on phones the sidebar isn't drawn at all (not just hidden), so pages open faster
  const isPhone = useMediaQuery(theme.breakpoints.down("md"), { noSsr: true });
  if (isPhone) return null;

  return (
    <Box
      component="aside"
      sx={{
        display: { xs: "none", md: "block" },
        // a bit narrower on small laptops / tablets in landscape
        width: isCollapsed ? COLLAPSED_WIDTH : { md: 240, lg: WIDTH },
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowX: "hidden",
        overflowY: "hidden",
        backgroundColor: colors.primary[400],
        transition: theme.transitions.create("width", {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      {/* LOGO AND MENU ICON */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          m: "10px 0 20px 0",
          pl: isCollapsed ? 0 : "35px",
          pr: isCollapsed ? 0 : "15px",
          minHeight: 48,
        }}
      >
        {!isCollapsed && (
          <Typography variant="h3" sx={{ color: colors.grey[100] }}>
            FLEET ADMIN
          </Typography>
        )}
        <IconButton
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          <MenuOutlinedIcon />
        </IconButton>
      </Box>

      {/* LOGGED IN COMMANDER */}
      {!isCollapsed && (
        <Box sx={{ mb: "25px" }}>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Avatar
              sx={{
                width: 100,
                height: 100,
                fontSize: 36,
                bgcolor: colors.blueAccent[600],
                color: colors.grey[100],
              }}
            >
              {initials(user.name)}
            </Avatar>
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography
              variant="h2"
              sx={{ color: colors.grey[100], fontWeight: "bold", m: "10px 0 0 0" }}
            >
              {user.name}
            </Typography>
            <Typography variant="h5" sx={{ color: colors.greenAccent[500] }}>
              {user.roleLabel}
            </Typography>
          </Box>
        </Box>
      )}

      {/* MENU (only the pages this account may open) */}
      <NavList collapsed={isCollapsed} />
    </Box>
  );
};

export default Sidebar;
