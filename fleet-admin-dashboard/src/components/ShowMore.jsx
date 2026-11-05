import { useState } from "react";
import { Box, Chip, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";

// "Show 5, then 5 more, then 5 more..." for long lists of MIDs or table rows.
// step = how many to show at first and how many each "+ more" adds
// (Infinity = show everything).
export function useShowMore(total, step = 5) {
  const [limit, setLimit] = useState(step);
  const shown = Math.min(limit, total);
  return {
    limit: shown,
    hidden: total - shown,
    more: () => setLimit((l) => l + step),
    all: () => setLimit(Infinity),
    less: () => setLimit(step),
    expanded: shown > step,
    step,
  };
}

// The buttons that go under / after a cut-down list:
//   [+5 more] [Show all 85] [Show less]
export const ShowMoreButtons = ({ state, noun = "" }) => {
  const { hidden, more, all, less, expanded, step } = state;
  if (!hidden && !expanded) return null;
  const next = Math.min(step, hidden);
  return (
    <>
      {hidden > 0 && (
        <Chip size="small" color="secondary" variant="outlined" clickable onClick={more} label={`+${next} more`} />
      )}
      {hidden > next && (
        <Chip size="small" variant="outlined" clickable onClick={all} label={`Show all (${hidden} left${noun})`} />
      )}
      {expanded && <Chip size="small" variant="outlined" clickable onClick={less} label="Show less" />}
    </>
  );
};

// A row of buttons to choose how many to show at a time: 5 · 10 · 15 · 20 · All
export const STEP_CHOICES = [5, 10, 15, 20, Infinity];

export const StepPicker = ({ value, onChange, label = "MIDs shown" }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
    <Typography variant="body2" sx={{ opacity: 0.8 }}>
      {label}
    </Typography>
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_, v) => v !== null && onChange(v)}
      aria-label={label}
    >
      {STEP_CHOICES.map((n) => (
        <ToggleButton key={n} value={n} sx={{ px: 1.5, py: 0.25 }}>
          {n === Infinity ? "All" : n}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  </Box>
);
