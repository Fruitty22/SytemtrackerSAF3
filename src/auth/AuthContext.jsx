import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  const chooseNode = useCallback((key) => {
    nodeStore.set(key);
    setNode(nodeByKey(key));
  }, []);

  // Back to the node picker. A node's own account is logged out (it only
  // exists in that node); the Super Admin stays logged in.
  const leaveNode = useCallback(() => {
    if (user && !user.superAdmin) tokenStore.set(null);
    nodeStore.set(null);
    window.location.assign("/");
  }, [user]);

  // Super Admin: go to another node (same login). The page reloads so every
  // list is read again from that node.
  const switchNode = useCallback((key) => {
    nodeStore.set(key);
    window.location.assign("/");
  }, []);

  const value = useMemo(
    () => ({
      user,
      node,
      chooseNode,
      leaveNode,
      switchNode,
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
    [user, node, chooseNode, leaveNode, switchNode, checking, login, signup, logout, changePassword, updateProfile, reloadUser, claimSheet]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
