import { Alert, Button, Collapse } from "@mui/material";
import { useVehicles } from "../data/VehiclesContext";

// Shown when loading the data takes more than a few seconds (usually the
// server waking up after a quiet spell). It retries by itself; "Try again"
// starts a fresh load straight away instead of waiting.
export default function SlowNotice() {
  const { slow, refresh } = useVehicles();
  return (
    <Collapse in={slow} unmountOnExit>
      <Alert
        severity="info"
        sx={{ mx: { xs: 1.5, sm: 2.5 }, mb: 1 }}
        action={
          <Button color="inherit" size="small" onClick={() => refresh()}>
            Try again
          </Button>
        }
      >
        Still loading - the server is waking up. This usually takes a few seconds.
      </Alert>
    </Collapse>
  );
}
