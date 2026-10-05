import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

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
    plugins: [emailOTPClient()],
  });

export const authClient = createClientAuth();
export type AuthClient = typeof authClient;
