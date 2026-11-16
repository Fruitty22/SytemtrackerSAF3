// One place that defines the sidebar AND the routes.
// `roles` says which kind of account can open the page.
// Items without a real page in App.jsx show a "not built yet" page.
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import SkipNextOutlinedIcon from "@mui/icons-material/SkipNextOutlined";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";

const EVERYONE = ["admin", "commander"];
const ADMIN = ["admin"];

export const navSections = [
  {
    title: "Fleet",
    items: [
      {
        key: "vehicles",
        title: "Manage Vehicles",
        to: "/",
        icon: DirectionsCarOutlinedIcon,
        roles: EVERYONE,
      },
    ],
  },
  {
    title: "Pages",
    items: [
      {
        key: "serviceable-vehicle",
        title: "Serviceable Vehicle",
        to: "/serviceable-vehicle",
        icon: CheckCircleOutlinedIcon,
        roles: EVERYONE,
      },
      {
        key: "tasking",
        title: "Tasking",
        to: "/tasking",
        icon: AssignmentOutlinedIcon,
        roles: EVERYONE, // who is out on what, and why the rest are not available
      },
      {
        key: "edit-maintenance",
        title: "Edit Maintenance Level",
        to: "/edit-maintenance",
        icon: BuildOutlinedIcon,
        roles: EVERYONE,
      },
      {
        key: "edit-blocked",
        title: "Edit Blocked Vehicles",
        to: "/edit-blocked",
        icon: BlockOutlinedIcon,
        roles: EVERYONE,
      },
      {
        key: "commander-dashboard",
        title: "Fleet Commander Dashboard",
        to: "/commander-dashboard",
        icon: InsightsOutlinedIcon,
        roles: EVERYONE, // everyone sees their OWN fleet here (NC Dashboard = whole fleet, admin)
      },
      {
        key: "manage-disregards",
        title: "Manage Disregards",
        to: "/manage-disregards",
        icon: RuleOutlinedIcon,
        roles: EVERYONE, // per vehicle type: which criteria are ignored
      },
      {
        key: "manage-criteria",
        title: "Manage Criteria",
        to: "/manage-criteria",
        icon: FactCheckOutlinedIcon,
        roles: ADMIN, // which columns count (the workbook's CriteriaConfig)
      },
    ],
  },
  {
    title: "Fleet Administration",
    items: [
      {
        key: "accounts",
        title: "Accounts",
        to: "/accounts",
        icon: PeopleOutlinedIcon,
        roles: ADMIN,
      },
      {
        key: "next-day",
        title: "Next Day",
        to: "/next-day",
        icon: SkipNextOutlinedIcon,
        roles: ADMIN,
      },
      {
        key: "nc-dashboard",
        title: "NC Dashboard",
        to: "/nc-dashboard",
        icon: SpaceDashboardOutlinedIcon,
        roles: ADMIN,
      },
    ],
  },
];

export const navItems = navSections.flatMap((section) => section.items);

// Can this user open the page with this key?
export const canOpen = (user, key) =>
  !!user && !!navItems.find((item) => item.key === key)?.roles.includes(user.role);
