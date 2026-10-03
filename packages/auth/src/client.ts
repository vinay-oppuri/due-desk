import { createAuthClient } from "better-auth/react";

export const createClientAuth = (baseURL: string) => createAuthClient({
  baseURL,
  fetchOptions: { credentials: "include" },
});
