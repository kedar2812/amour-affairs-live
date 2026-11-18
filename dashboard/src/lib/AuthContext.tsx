"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authAPI, storeAuth, clearAuth, getStoredToken, getStoredUser, isAuthenticated, type AuthResponse } from "@/lib/api";

interface AuthContextType {
  user: AuthResponse["user"] | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check existing auth on mount
  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser && isAuthenticated()) {
      setUser(storedUser);
      // Verify token is still valid
      authAPI.me()
        .then((res) => setUser(res.user))
        .catch((err) => {
          const token = getStoredToken();
          if (
            token === "mock_development_access_token_jwt" || 
            (err && err.message && (err.message.includes("Failed to fetch") || err.message.includes("API Error")))
          ) {
            // Mock dev session or backend briefly offline — keep the session active.
            return;
          }
          clearAuth();
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      clearAuth();
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await authAPI.login(email, password);
      storeAuth(data);
      setUser(data.user);
    } catch (err: any) {
      // Mock authentication exists only for local development; in production
      // builds this branch is eliminated so no credentials ship in the bundle.
      if (process.env.NODE_ENV !== "development") {
        throw new Error(err.message || "Invalid credentials");
      }

      console.warn("API login failed, falling back to client-side mock authentication:", err);

      // Let's check against our development/mock accounts
      const mockUsers = [
        { email: "test@test.in", password: "test123", name: "Test User", role: "admin" }
      ];

      // Also support custom users stored in localStorage
      try {
        const storedMockUsers = localStorage.getItem("aa_mock_users");
        if (storedMockUsers) {
          mockUsers.push(...JSON.parse(storedMockUsers));
        }
      } catch (e) {
        console.error("Error loading mock users from local storage", e);
      }

      const match = mockUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (match) {
        const mockAuthData: AuthResponse = {
          user: {
            id: email.toLowerCase() === "test@test.in" ? 999 : 1,
            email: match.email,
            name: match.name,
            role: match.role,
          },
          access_token: "mock_development_access_token_jwt",
          refresh_token: "mock_development_refresh_token_jwt",
          expires_in: 3600,
        };
        storeAuth(mockAuthData);
        setUser(mockAuthData.user);
      } else {
        throw new Error(err.message || "Invalid credentials");
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      // Ignore errors on logout
    } finally {
      clearAuth();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
