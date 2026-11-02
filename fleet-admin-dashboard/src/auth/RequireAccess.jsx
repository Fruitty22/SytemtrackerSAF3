import { Box, Typography } from "@mui/material";
import { useAuth } from "./AuthContext";
import { canOpen } from "../navigation";

// Wrap a page so only the right kind of account can see it.
// (The server checks permissions too; this just hides the screen.)
const RequireAccess = ({ access, children }) => {
  const { user } = useAuth();

  if (!canOpen(user, access)) {
    return (
      <Box sx={{ m: "20px" }}>
        <Typography variant="h3">No access</Typography>
        <Typography sx={{ mt: 1 }}>
          Your account doesn&rsquo;t have access to this page.
        </Typography>
      </Box>
    );
  }
  return children;
};

export default RequireAccess;
