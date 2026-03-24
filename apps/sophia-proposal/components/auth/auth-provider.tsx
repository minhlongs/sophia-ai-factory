"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type User = {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
};

export type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

export type AuthContextType = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "sophia_auth_session";
const API_BASE = "/api/auth";

// Strip sensitive fields before persisting to localStorage — keep display data only
function toSafeUser(raw: Record<string, unknown>): User {
  return {
    id: raw.id as string,
    email: raw.email as string,
    name: raw.name as string | undefined,
    avatar: raw.avatar as string | undefined,
    // Intentionally omit: token, api_key, password_hash, etc.
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored) as User;
        setState({ user, isLoading: false, isAuthenticated: true });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } else {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/session`);
      if (res.ok) {
        const raw = await res.json();
        const user = toSafeUser(raw);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        setState({ user, isLoading: false, isAuthenticated: true });
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const raw = await res.json();
    const user = toSafeUser(raw);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setState({ user, isLoading: false, isAuthenticated: true });
  };

  const signInWithMagicLink = async (email: string) => {
    const res = await fetch(`${API_BASE}/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error("Failed to send magic link");
  };

  const signUp = async (email: string, password: string, name: string) => {
    const res = await fetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) throw new Error("Signup failed");
    const raw = await res.json();
    const user = toSafeUser(raw);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setState({ user, isLoading: false, isAuthenticated: true });
  };

  const signOut = async () => {
    await fetch(`${API_BASE}/logout`, { method: "POST" });
    localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, isLoading: false, isAuthenticated: false });
  };

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signInWithMagicLink, signUp, signOut, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
