'use client';

/**
 * Auth context — stores the access token in React state (memory only, NOT localStorage).
 *
 * Token lifecycle:
 * - On mount: attempt a silent refresh via auth.refresh to restore session
 *   from the refresh token stored in an httpOnly cookie (set by the API).
 * - On login/register: store the access token in state. The refresh token is
 *   set by the API as an httpOnly cookie — never visible to JavaScript.
 * - The tRPC client reads the token from getAccessToken() on every request.
 * - On 401: trigger a refresh automatically, retry the request.
 * - On logout: call auth.logout, clear in-memory token.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const TOKEN_REFRESH_INTERVAL = 12 * 60 * 1000; // 12 minutes (80% of 15-min TTL)

interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  getAccessToken: () => string | null;
  updateUser: (partial: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Call the refresh endpoint. The browser automatically sends the httpOnly
 * refresh token cookie — no token is read from or written to localStorage.
 */
async function callRefresh(): Promise<{ user: AuthUser; accessToken: string } | null> {
  try {
    const res = await fetch('/api/trpc/auth.refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No body needed — refresh token is sent automatically via cookie.
      // tRPC v11 mutations with no input schema accept an empty/absent body.
      credentials: 'include',
    });

    if (!res.ok) return null;

    // tRPC v11 response format (no transformer): {"result":{"data":<output>}}
    // Note: tRPC v10 used {"result":{"data":{"json":<output>}}} — v11 drops the json wrapper.
    const data = (await res.json()) as {
      result?: { data?: { user: AuthUser; accessToken: string } };
    };

    const payload = data?.result?.data;
    if (payload?.accessToken && payload?.user) {
      return { user: payload.user, accessToken: payload.accessToken };
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
  });

  // Keep a ref so the tRPC client can read the latest token synchronously
  // without needing the React render cycle.
  const tokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Guard: prevent concurrent refresh calls (React strict mode double-mount)
  const refreshInFlightRef = useRef(false);

  const refreshSession = useCallback(async () => {
    const result = await callRefresh();
    if (!result) return;

    tokenRef.current = result.accessToken;
    setState({ user: result.user, accessToken: result.accessToken, isLoading: false });

    // Schedule next proactive refresh before the access token expires
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void refreshSession();
    }, TOKEN_REFRESH_INTERVAL);
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void refreshSession();
    }, TOKEN_REFRESH_INTERVAL);
  }, [refreshSession]);

  const setAuth = useCallback((user: AuthUser, accessToken: string) => {
    tokenRef.current = accessToken;
    setState({ user, accessToken, isLoading: false });
    scheduleRefresh();
  }, [scheduleRefresh]);

  const clearAuth = useCallback(() => {
    tokenRef.current = null;
    setState({ user: null, accessToken: null, isLoading: false });
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const getAccessToken = useCallback(() => tokenRef.current, []);

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setState((prev) =>
      prev.user ? { ...prev, user: { ...prev.user, ...partial } } : prev,
    );
  }, []);

  // Attempt silent refresh on mount to restore session from httpOnly cookie.
  // Guard prevents React strict mode double-mount from racing two refresh calls
  // (which would trigger token-reuse detection and nuke all sessions).
  useEffect(() => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    const restoreSession = async () => {
      const result = await callRefresh();
      refreshInFlightRef.current = false;
      if (result) {
        setAuth(result.user, result.accessToken);
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    void restoreSession();
  }, [setAuth]);

  // Clean up refresh timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, setAuth, clearAuth, getAccessToken, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
