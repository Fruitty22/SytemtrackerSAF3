// The nodes. Each node has its own accounts, vehicles, Excel imports, criteria,
// disregards, bookings, "Remove all" and "Undo" - stored separately, so one
// node can never see another's data. The Super Admin (see server/api.js) can
// enter every node.
//
// To add a node: add a line here and push. `key` is used in the database and
// must never change once a node has data; `name` is what people see.
export const NODES = [
  { key: "ktn", name: "KTN" },
  { key: "kranji", name: "KRANJI" },
  { key: "mandai-hill", name: "MANDAI HILL" },
  { key: "ltc", name: "LTC" },
  { key: "hq", name: "HQ" },
  { key: "alpha", name: "ALPHA" },
  { key: "charlie", name: "CHARLIE" },
  { key: "csc", name: "CSC" },
];

// The node that holds the data from before nodes existed, and the Super Admin accounts
export const MAIN_NODE = "ktn";

export const nodeByKey = (key) => NODES.find((n) => n.key === String(key ?? "").toLowerCase()) ?? null;
