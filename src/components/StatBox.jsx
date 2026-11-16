import { Box, Typography, useTheme } from "@mui/material";
import { tokens } from "../theme";

// A number with a label and a coloured left edge, used in the summary rows
const StatBox = ({ label, value, color, hint }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  return (
    <Box
      sx={{
        // two per row on a phone, one row on a wide screen
        flex: { xs: "1 1 calc(50% - 8px)", sm: "1 1 150px" },
        minWidth: 0,
        p: { xs: "10px 12px", sm: "14px 18px" },
        backgroundColor: colors.primary[400],
        borderRadius: "4px",
        borderLeft: `4px solid ${color}`,
      }}
    >
      <Typography variant="h3" sx={{ fontWeight: "bold", color: colors.grey[100] }}>
        {value}
      </Typography>
      <Typography sx={{ color: colors.grey[300], fontSize: { xs: 13, sm: 14 }, overflowWrap: "anywhere" }}>
        {label}
      </Typography>
      {hint && (
        <Typography variant="caption" sx={{ color: colors.grey[400] }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
};

export default StatBox;
