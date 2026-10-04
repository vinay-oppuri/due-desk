import { createAuthClient } from "better-auth/react";

export const createClientAuth = (baseURL?: string) =>
  createAuthClient({
    baseURL:
      baseURL ??
      (typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000")),
    fetchOptions: {
      credentials: "include",
    },
  });

export const authClient = createClientAuth();
export type AuthClient = typeof authClient;
