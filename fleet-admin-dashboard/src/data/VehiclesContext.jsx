import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DEFAULT_VEHICLE_TYPES } from "../../shared/config.js";
import { deployability } from "../../shared/deployability.js";

// Holds the vehicles this account can see (all of them for an administrator)
// and, for an administrator, the list of accounts. Every change goes to the
// server first, then the list here is updated with what the server saved.
const VehiclesContext = createContext(null);

export function VehiclesProvider({ children }) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [disregards, setDisregards] = useState({}); // { "VAMTAC (CEREMONY)": ["CANOPY", ...] }
  const [disregardsUpdated, setDisregardsUpdated] = useState({}); // { type: { at, by } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [vehicleData, userData, disregardData] = await Promise.all([
        api("/vehicles"),
        user.role === "admin" ? api("/users") : Promise.resolve({ users: [] }),
        api("/disregards"),
      ]);
      setVehicles(vehicleData.vehicles);
      setUsers(userData.users);
      setDisregards(disregardData.disregards);
      setDisregardsUpdated(disregardData.updated ?? {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
    else {
      setVehicles([]);
      setUsers([]);
    }
  }, [user, refresh]);

  const upsert = useCallback((vehicle) => {
    setVehicles((list) => {
      const index = list.findIndex((v) => v.id === vehicle.id);
      if (index < 0) return [...list, vehicle];
      const copy = [...list];
      copy[index] = vehicle;
      return copy;
    });
  }, []);

  // CRUD - each one throws an ApiError with a readable message if it fails
  const createVehicle = useCallback(
    async (input) => {
      const { vehicle } = await api("/vehicles", { method: "POST", body: input });
      upsert(vehicle);
      return vehicle;
    },
    [upsert]
  );

  const updateVehicle = useCallback(
    async (id, patch) => {
      const { vehicle } = await api(`/vehicles/${id}`, { method: "PATCH", body: patch });
      upsert(vehicle);
      return vehicle;
    },
    [upsert]
  );

  const deleteVehicle = useCallback(async (id) => {
    await api(`/vehicles/${id}`, { method: "DELETE" });
    setVehicles((list) => list.filter((v) => v.id !== id));
  }, []);

  // Bulk actions on several vehicles; both reload the list afterwards
  const assignVehicles = useCallback(
    async (ids, ownerId) => {
      const result = await api("/vehicles/assign", { method: "POST", body: { ids, ownerId } });
      await refresh();
      return result;
    },
    [refresh]
  );

  const deleteVehicles = useCallback(
    async (ids) => {
      const result = await api("/vehicles/delete", { method: "POST", body: { ids } });
      await refresh();
      return result;
    },
    [refresh]
  );

  const importVehicles = useCallback(
    async (payload) => {
      const result = await api("/vehicles/import", { method: "POST", body: payload });
      await refresh();
      return result;
    },
    [refresh]
  );

  // Change which fields are ignored for one vehicle type (any account)
  const saveDisregards = useCallback(async (type, ignored) => {
    const data = await api("/disregards", { method: "PUT", body: { type, ignored } });
    setDisregards(data.disregards);
    setDisregardsUpdated(data.updated ?? {});
  }, []);

  // AVA / NOT AVA for every vehicle, worked out once per change
  const deployMap = useMemo(
    () => new Map(vehicles.map((v) => [v.id, deployability(v, disregards)])),
    [vehicles, disregards]
  );
  const deployOf = useCallback(
    (vehicle) => deployMap.get(vehicle.id) ?? deployability(vehicle, disregards),
    [deployMap, disregards]
  );

  // suggested types = the defaults + every type already in use
  const vehicleTypes = useMemo(
    () =>
      [...new Set([...DEFAULT_VEHICLE_TYPES, ...vehicles.map((v) => v.type)])].sort((a, b) =>
        a.localeCompare(b)
      ),
    [vehicles]
  );

  const value = useMemo(
    () => ({
      vehicles,
      users,
      vehicleTypes,
      disregards,
      disregardsUpdated,
      saveDisregards,
      deployOf,
      loading,
      error,
      refresh,
      createVehicle,
      updateVehicle,
      deleteVehicle,
      importVehicles,
      assignVehicles,
      deleteVehicles,
    }),
    [vehicles, users, vehicleTypes, disregards, disregardsUpdated, saveDisregards, deployOf, loading, error, refresh, createVehicle, updateVehicle, deleteVehicle, importVehicles, assignVehicles, deleteVehicles]
  );

  return <VehiclesContext.Provider value={value}>{children}</VehiclesContext.Provider>;
}

export const useVehicles = () => useContext(VehiclesContext);
