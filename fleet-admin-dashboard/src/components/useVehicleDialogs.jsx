import { useState } from "react";
import VehicleDialog from "./VehicleDialog";
import ConfirmDialog from "./ConfirmDialog";
import { useVehicles } from "../data/VehiclesContext";

// Add / edit / delete vehicle dialogs that any page can use:
//   const { openCreate, openEdit, openDelete, dialogs } = useVehicleDialogs({ onCreated });
//   ...render {dialogs} somewhere in the page.
export default function useVehicleDialogs({ onCreated, onDeleted, defaultType } = {}) {
  const { deleteVehicle } = useVehicles();
  const [editing, setEditing] = useState(null); // { vehicle } ; vehicle null = create
  const [deleting, setDeleting] = useState(null);

  const dialogs = (
    <>
      {editing && (
        <VehicleDialog
          vehicle={editing.vehicle}
          defaultType={defaultType}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            if (!editing.vehicle) onCreated?.(saved);
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete vehicle ${deleting?.mid ?? ""}?`}
        message="Its status, maintenance records and block record are deleted too. This can't be undone."
        confirmLabel="Delete vehicle"
        onConfirm={async () => {
          await deleteVehicle(deleting.id);
          onDeleted?.(deleting);
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );

  return {
    openCreate: () => setEditing({ vehicle: null }),
    openEdit: (vehicle) => setEditing({ vehicle }),
    openDelete: (vehicle) => setDeleting(vehicle),
    dialogs,
  };
}
