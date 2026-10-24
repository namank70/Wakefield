import { dataMode } from "@/lib/config/env";
import { liveClient } from "@/lib/api/live-client";
import { mockClient } from "@/lib/api/mock-client";
import type { WakefieldClient } from "@/lib/types";

export function getClient(): WakefieldClient {
  return dataMode === "live" ? liveClient : mockClient;
}

export type { WakefieldClient };
