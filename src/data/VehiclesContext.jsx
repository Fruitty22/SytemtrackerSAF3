import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DEFAULT_VEHICLE_TYPES } from "../../shared/config.js";
import { deployability } from "../../shared/deployability.js";
import { eventsByVehicleOn, isoDate } from "../../shared/schedule.js";
import { applyCriteria } from "../../shared/criteria.js";

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
  const [events, setEvents] = useState([]); // calendar bookings
  const [criteria, setCriteria] = useState([]); // [{ name, category }] - see shared/criteria.js
  const [valueMeanings, setValueMeanings] = useState({}); // { "GOOD": "Y", "X": "" } - see shared/values.js
  const [today, setToday] = useState(() => isoDate());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Only the newest reload may update the page: an older one that answers
  // late is ignored, and "loading" always ends with the newest one.
  const latest = useRef(0);
  const inFlight = useRef(false);
  // { soft: true } = only if nothing is loading right now (page opened, first load)
  const refresh = useCallback(async ({ soft = false } = {}) => {
    if (!user) return;
    if (soft && inFlight.current) return;
    const mine = ++latest.current;
    inFlight.current = true;
    setLoading(true);
    setError("");
    try {
      // one request for everything (see /api/bootstrap)
      const all = await api("/bootstrap");
      if (mine !== latest.current) return;
      const vehicleData = all;
      const userData = all;
      const disregardData = all;
      const eventData = all;
      // the criteria list decides which fields every page shows and counts,
      // so it is applied before the vehicles are shown
      applyCriteria(disregardData.criteria);
      setCriteria(disregardData.criteria ?? []);
      setValueMeanings(disregardData.valueMeanings ?? {});
      setEvents(eventData.events);
      setVehicles(vehicleData.vehicles);
      setUsers(userData.users);
      setDisregards(disregardData.disregards);
      setDisregardsUpdated(disregardData.updated ?? {});
    } catch (err) {
      if (mine === latest.current) setError(err.message);
    } finally {
      if (mine === latest.current) {
        setLoading(false);
        inFlight.current = false;
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh({ soft: true });
    else {
      setVehicles([]);
      setUsers([]);
      setEvents([]);
    }
  }, [user, refresh]);

  // a new day starts bookings / ends them: check the date every minute
  useEffect(() => {
    const id = setInterval(() => setToday((d) => (d === isoDate() ? d : isoDate())), 60000);
    return () => clearInterval(id);
  }, []);

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

  // Show an account straight away after it's added or changed (Accounts page),
  // before the full reload comes back
  const upsertUser = useCallback((u) => {
    if (!u?.id) return;
    setUsers((list) => (list.some((x) => x.id === u.id) ? list.map((x) => (x.id === u.id ? { ...x, ...u } : x)) : [...list, u]));
  }, []);

  // Add / reclassify / remove criteria (Admin). changes: { set?, remove?, reset? }
  // Everything is reloaded afterwards, because every page counts the criteria.
  const saveCriteria = useCallback(
    async (changes) => {
      const data = await api("/criteria", { method: "PUT", body: changes });
      applyCriteria(data.criteria);
      setCriteria(data.criteria);
      if (data.valueMeanings) setValueMeanings(data.valueMeanings);
      await refresh();
      return data;
    },
    [refresh]
  );

  // Calendar bookings - each one throws an ApiError with a readable message
  const createEvent = useCallback(async (input) => {
    const { event } = await api("/events", { method: "POST", body: input });
    setEvents((list) => [...list, event]);
    return event;
  }, []);
  const updateEvent = useCallback(async (id, patch) => {
    const { event } = await api(`/events/${id}`, { method: "PATCH", body: patch });
    setEvents((list) => list.map((e) => (e.id === id ? event : e)));
    return event;
  }, []);
  const deleteEvent = useCallback(async (id) => {
    await api(`/events/${id}`, { method: "DELETE" });
    setEvents((list) => list.filter((e) => e.id !== id));
  }, []);

  // bookings that are on today, per vehicle
  const todayEvents = useMemo(() => eventsByVehicleOn(events, today), [events, today]);

  // AVAILABLE / DEPLOYED / UNAVAILABLE for every vehicle (today, including
  // today's calendar bookings), worked out once per change
  const deployMap = useMemo(
    () => new Map(vehicles.map((v) => [v.id, deployability(v, disregards, todayEvents.get(v.id) ?? [])])),
    // criteria: the lists deployability() reads change with it
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicles, disregards, todayEvents, criteria]
  );
  const deployOf = useCallback(
    (vehicle) => deployMap.get(vehicle.id) ?? deployability(vehicle, disregards, todayEvents.get(vehicle.id) ?? []),
    [deployMap, disregards, todayEvents]
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
      upsertUser,
      vehicleTypes,
      disregards,
      disregardsUpdated,
      saveDisregards,
      criteria,
      valueMeanings,
      saveCriteria,
      deployOf,
      events,
      today,
      createEvent,
      updateEvent,
      deleteEvent,
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
    [vehicles, users, upsertUser, vehicleTypes, disregards, disregardsUpdated, saveDisregards, criteria, saveCriteria, valueMeanings, deployOf, events, today, createEvent, updateEvent, deleteEvent, loading, error, refresh, createVehicle, updateVehicle, deleteVehicle, importVehicles, assignVehicles, deleteVehicles]
  );

  return <VehiclesContext.Provider value={value}>{children}</VehiclesContext.Provider>;
}

export const useVehicles = () => useContext(VehiclesContext);
