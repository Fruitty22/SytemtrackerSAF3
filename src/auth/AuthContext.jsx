import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
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

  const value = useMemo(
    () => ({
      user,
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
    [user, checking, login, signup, logout, changePassword, updateProfile, reloadUser, claimSheet]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
