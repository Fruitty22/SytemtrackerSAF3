import { Typography, Box, useTheme } from "@mui/material";
import { tokens } from "../theme";

const Header = ({ title, subtitle }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  return (
    <Box sx={{ mb: { xs: "16px", sm: "30px" }, minWidth: 0 }}>
      <Typography
        variant="h2"
        sx={{
          color: colors.grey[100],
          fontWeight: "bold",
          m: "0 0 5px 0",
          fontSize: { xs: 22, sm: 28, md: 32 },
          overflowWrap: "anywhere",
        }}
      >
        {title}
      </Typography>
      <Typography variant="h5" sx={{ color: colors.greenAccent[400], fontSize: { xs: 13, sm: 16 } }}>
        {subtitle}
      </Typography>
    </Box>
  );
};

export default Header;
