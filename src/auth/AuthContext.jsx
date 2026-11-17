import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, nodeStore, tokenStore } from "../api/client";
import { MAIN_NODE, nodeByKey } from "../../shared/nodes.js";

// logged in before nodes existed: that login was for KTN
if (tokenStore.get() && !nodeStore.get()) nodeStore.set(MAIN_NODE);

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // the node this browser is in (null = show the node picker)
  const [node, setNode] = useState(() => nodeByKey(nodeStore.get()));
  // true while we check a saved login with the server
  const [checking, setChecking] = useState(() => !!tokenStore.get());
  // the animated cover shown while moving between nodes / the node picker:
  // null, or { to: node key (null = node picker), phase: "cover" | "reveal" }
  const [transition, setTransition] = useState(null);
  const busy = useRef(false);

  // Fade the cover in, make the change underneath it, then fade it out.
  const runTransition = useCallback(async (to, change) => {
    if (busy.current) return;
    busy.current = true;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    try {
      setTransition({ to, phase: "cover" });
      await wait(reduced ? 0 : 380);
      const started = Date.now();
      await change();
      await wait(Math.max(0, (reduced ? 0 : 650) - (Date.now() - started)));
      setTransition({ to, phase: "reveal" });
      await wait(reduced ? 0 : 480);
    } finally {
      setTransition(null);
      busy.current = false;
    }
  }, []);

  // restore the login after a page refresh
  useEffect(() => {
    if (!tokenStore.get()) return undefined;
    let active = true;
    api("/auth/me")
      .then((data) => active && setUser(data.user))
      .catch(() => tokenStore.set(null))
      .finally(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, []);

  // any request that comes back "not logged in" signs the user out
  useEffect(() => {
    const onLoggedOut = () => {
      tokenStore.set(null);
      setUser(null);
    };
    window.addEventListener("fleet:logged-out", onLoggedOut);
    return () => window.removeEventListener("fleet:logged-out", onLoggedOut);
  }, []);

  const startSession = useCallback(({ token, user: newUser }) => {
    tokenStore.set(token);
    setUser(newUser);
  }, []);

  // Both throw an ApiError with a readable message when they fail.
  const login = useCallback(
    async (username, password) =>
      startSession(await api("/auth/login", { method: "POST", body: { username, password } })),
    [startSession]
  );

  const signup = useCallback(
    async ({ username, name, password }) =>
      startSession(await api("/auth/signup", { method: "POST", body: { username, name, password } })),
    [startSession]
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* already logged out on the server */
    }
    tokenStore.set(null);
    setUser(null);
  }, []);

  const changePassword = useCallback(
    (currentPassword, newPassword) =>
      api("/auth/password", { method: "POST", body: { currentPassword, newPassword } }),
    []
  );

  // Change your own username / display name; the new details show everywhere
  const updateProfile = useCallback(async (changes) => {
    const { user: updated } = await api("/auth/me", { method: "PATCH", body: changes });
    setUser(updated);
    return updated;
  }, []);

  // "This worksheet is mine": links it to you and moves its vehicles to you
  const claimSheet = useCallback(async (sheet) => {
    const { user: updated, moved } = await api("/sheets/claim", { method: "POST", body: { sheet } });
    setUser(updated); // also reloads the vehicle list
    return moved;
  }, []);

  // Re-read the logged-in account (e.g. after an admin edits their own account)
  const reloadUser = useCallback(async () => {
    const { user: fresh } = await api("/auth/me");
    setUser(fresh);
  }, []);

  // Node picker (before logging in): remember the node, show its login page
  const chooseNode = useCallback(
    (key) =>
      runTransition(key, () => {
        nodeStore.set(key);
        setNode(nodeByKey(key));
      }),
    [runTransition]
  );

  // Back to the node picker. A node's own account is logged out (it only
  // exists in that node); the Super Admin stays logged in.
  const leaveNode = useCallback(
    () =>
      runTransition(null, () => {
        if (user && !user.superAdmin) tokenStore.set(null);
        nodeStore.set(null);
        setUser(null);
        setNode(null);
      }),
    [user, runTransition]
  );

  // Super Admin: go to another node (same login), without reloading the page:
  // behind the cover the node changes, the account is read again from that
  // node, and every page / list starts fresh for it.
  const switchNode = useCallback(
    (key) =>
      runTransition(key, async () => {
        nodeStore.set(key);
        setNode(nodeByKey(key));
        try {
          const { user: fresh } = await api("/auth/me");
          setUser(fresh);
        } catch {
          window.location.assign("/"); // fall back to a full reload
        }
      }),
    [runTransition]
  );

  const value = useMemo(
    () => ({
      user,
      node,
      chooseNode,
      leaveNode,
      switchNode,
      transition,
      isSuperAdmin: !!user?.superAdmin,
      updateProfile,
      reloadUser,
      claimSheet,
      checking,
      isAdmin: user?.role === "admin",
      login,
      signup,
      logout,
      changePassword,
    }),
    [user, node, chooseNode, leaveNode, switchNode, transition, checking, login, signup, logout, changePassword, updateProfile, reloadUser, claimSheet]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
