// Shared look for every DataGrid (colours come from theme.js)
export const gridSx = (colors) => ({
  "& .MuiDataGrid-root": { border: "none" },
  "& .MuiDataGrid-cell": { borderBottom: "none", display: "flex", alignItems: "center" },
  "& .MuiDataGrid-columnHeaders": { borderBottom: "none" },
  "& .MuiDataGrid-footerContainer": {
    borderTop: "none",
    backgroundColor: colors.blueAccent[700],
  },
  "& .MuiDataGrid-toolbar .MuiButtonBase-root": {
    color: `${colors.grey[100]} !important`,
  },
});
