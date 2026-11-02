import { Box, Typography, useTheme } from "@mui/material";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const Placeholder = ({ title }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  return (
    <Box sx={{ m: "20px" }}>
      <Header title={title.toUpperCase()} subtitle="Not built yet" />
      <Box
        sx={{
          mt: "40px",
          p: "40px",
          backgroundColor: colors.primary[400],
          borderRadius: "4px",
        }}
      >
        <Typography sx={{ color: colors.grey[300] }}>
          This section has a place in the menu but hasn&rsquo;t been built yet.
        </Typography>
      </Box>
    </Box>
  );
};

export default Placeholder;
