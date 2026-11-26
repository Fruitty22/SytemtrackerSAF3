import { Box, Chip, Typography, alpha, useTheme } from "@mui/material";
import { tokens, BRAND, PANEL } from "../theme";
import { usePrefs } from "../prefs/PrefsContext";

// What each kind of number looks like - the same colours as the chips in the
// tables (AVAILABLE green, DEPLOYED blue, UNAVAILABLE red, BLOCKED red outline,
// maintenance items orange), so a colour means the same thing everywhere.
const TONES = {
  total: { palette: null, variant: "outlined" },
  available: { palette: "success", variant: "filled" },
  deployed: { palette: "info", variant: "filled" },
  tasking: { palette: "info", variant: "outlined" },
  unavailable: { palette: "error", variant: "filled" },
  blocked: { palette: "error", variant: "outlined" },
  maintenance: { palette: "warning", variant: "filled" },
};

// A number with a coloured label, a coloured left edge and a light tint,
// used in the summary rows. tone = one of TONES (or pass color for anything else).
const StatBox = ({ label, value, tone = "total", color, hint }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const t = TONES[tone] ?? TONES.total;
  const accent = theme.palette.mode === "dark" ? BRAND.accentText : "#1c6f68"; // darker teal on light backgrounds
  const main = color ?? (t.palette ? theme.palette[t.palette].main : accent);
  const filled = t.variant === "filled";
  const { colorLabels } = usePrefs(); // account menu > Coloured stat labels
  const glass = !!theme.argus?.glass;
  return (
    <Box
      sx={{
        // two per row on a phone, one row on a wide screen
        flex: { xs: "1 1 calc(50% - 8px)", sm: "1 1 150px" },
        minWidth: 0,
        p: { xs: "10px 12px", sm: "14px 18px" },
        ...PANEL,
        ...(colorLabels
          ? { backgroundImage: `linear-gradient(135deg, ${alpha(main, 0.16)} 0%, ${alpha(main, 0.04)} 55%, transparent 100%)` }
          : {}),
        borderRadius: glass ? "14px" : "6px",
        borderLeft: `4px solid ${main}`,
      }}
    >
      <Typography variant="h3" sx={{ fontWeight: "bold", color: colors.grey[100], lineHeight: 1.2 }}>
        {value}
      </Typography>
      {!colorLabels ? (
        <Typography sx={{ color: colors.grey[300], fontSize: { xs: 13, sm: 14 }, overflowWrap: "anywhere" }}>{label}</Typography>
      ) : (
      <Chip
        size="small"
        label={label}
        variant={filled ? "filled" : "outlined"}
        sx={{
          mt: 0.75,
          maxWidth: "100%",
          height: "auto",
          minHeight: 22,
          fontWeight: 600,
          fontSize: { xs: 11, sm: 12 },
          letterSpacing: 0.2,
          "& .MuiChip-label": { whiteSpace: "normal", py: "2px" },
          ...(filled
            ? { backgroundColor: main, color: theme.palette.getContrastText(main) }
            : { borderColor: main, color: main, backgroundColor: alpha(main, 0.08) }),
        }}
      />
      )}
      {hint && (
        <Typography variant="caption" component="div" sx={{ color: colors.grey[400], mt: 0.5 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
};

export default StatBox;
