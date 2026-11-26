import { useEffect, useRef, useState } from "react";
import { DataGrid as MuiDataGrid } from "@mui/x-data-grid";

// MUI's DataGrid, made safe for pages that are built in the background.
//
// Pages are kept alive in React <Activity> and the ones you haven't opened yet
// are built while hidden (see App.jsx). A hidden page doesn't run its effects,
// and DataGrid copies new rows into its own state with effects - so a table
// built before the data arrived kept showing "0-0 of 0" / loading bars until
// the whole page was refreshed.
//
// Effects run when the page is first shown. If the rows (or loading state)
// changed since the table was built, the table is built again right then, with
// the current data. After that DataGrid follows changes by itself.
export function DataGrid(props) {
  const built = useRef({ rows: props.rows, loading: props.loading, columns: props.columns });
  const [generation, setGeneration] = useState(0);
  const shownOnce = useRef(false);

  useEffect(() => {
    if (shownOnce.current) return;
    shownOnce.current = true;
    const b = built.current;
    if (b.rows !== props.rows || b.loading !== props.loading || b.columns !== props.columns) {
      setGeneration((g) => g + 1);
    }
    // only the first time the page is shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <MuiDataGrid key={generation} {...props} />;
}

export default DataGrid;
