// Tiny JSON-file database. The whole database lives in memory and is written
// back to disk after every change (write to a temp file, then rename, so a
// crash mid-write can't leave a half-written file).
import fs from "node:fs";
import path from "node:path";

const empty = () => ({ version: 1, users: [], sessions: [], vehicles: [], sheets: [] });

export function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  let data = empty();
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, "utf8");
    try {
      data = { ...empty(), ...JSON.parse(text) };
    } catch (err) {
      throw new Error(
        `The database file ${file} is not valid JSON (${err.message}). ` +
          "Fix it, or restore it from db.backup.json in the same folder."
      );
    }
    // keep a copy of the database as it was when the server started
    fs.writeFileSync(path.join(path.dirname(file), "db.backup.json"), text);
  }

  const save = () => {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  };

  if (!fs.existsSync(file)) save();
  return { data, save, file };
}

// A JSON file that holds a plain list (used for the deleted-accounts archive).
export function openJsonList(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let items = [];
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(parsed)) items = parsed;
    } catch (err) {
      throw new Error(`${file} is not valid JSON (${err.message}).`);
    }
  }
  const list = {
    items,
    save() {
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(list.items, null, 2));
      fs.renameSync(tmp, file);
    },
    file,
  };
  if (!fs.existsSync(file)) list.save();
  return list;
}
