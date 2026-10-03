import { useSyncExternalStore } from "react";
import { browserAuthTransport } from "./client.ts";
import { AuthController } from "./state.ts";

export const auth = new AuthController(browserAuthTransport);
export function useAuth() {
  return useSyncExternalStore(auth.subscribe, auth.getSnapshot);
}
