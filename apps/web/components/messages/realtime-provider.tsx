"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { realtimeUrl } from "@/lib/messages";

import type { RealtimeEvent } from "@/lib/api-types";
import type { ReactNode } from "react";

export type RealtimeStatus = "connecting" | "open" | "closed";

/** Return true when the event was fully handled on screen (e.g. the open thread showed it). */
type Listener = (event: RealtimeEvent) => boolean;

type RealtimeContextValue = {
  status: RealtimeStatus;
  subscribe: (listener: Listener) => () => void;
};

const PING_MS = 25_000;
const MAX_RETRY_MS = 30_000;
const REFRESH_THROTTLE_MS = 3_000;
// Closed by the server because the token is missing, invalid, or the account can't message.
const AUTH_FAILURES = new Set([4401, 4403]);

const RealtimeContext = createContext<RealtimeContextValue>({
  status: "closed",
  subscribe: () => () => undefined,
});

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

// One socket per signed-in tab. Messages arrive instantly; screens fall back to polling while it's down.
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const listeners = useRef(new Set<Listener>());
  const getTokenRef = useRef(getToken);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    getTokenRef.current = getToken;
  });

  // Nav badges come from the server layout, so an unhandled message refreshes it (throttled).
  const refreshSoon = useCallback(() => {
    if (refreshTimer.current !== null) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, REFRESH_THROTTLE_MS);
  }, [router]);

  useEffect(() => {
    const url = realtimeUrl();
    if (!isSignedIn || !url) {
      setStatus("closed");
      return;
    }
    let socket: WebSocket | null = null;
    let stopped = false;
    let attempt = 0;
    let pingTimer: number | undefined;
    let retryTimer: number | undefined;

    const scheduleReconnect = (slow: boolean) => {
      if (stopped) return;
      attempt += 1;
      const delay = slow ? MAX_RETRY_MS : Math.min(MAX_RETRY_MS, 1000 * 2 ** Math.min(attempt, 5));
      retryTimer = window.setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      setStatus((current) => (current === "open" ? "connecting" : current));
      let token: string | null = null;
      try {
        token = await getTokenRef.current();
      } catch {
        token = null;
      }
      if (stopped) return;
      if (!token) {
        setStatus("closed");
        scheduleReconnect(true);
        return;
      }
      const current = new WebSocket(url);
      socket = current;
      current.onopen = () => current.send(JSON.stringify({ type: "auth", token }));
      current.onmessage = (raw) => {
        let event: RealtimeEvent;
        try {
          event = JSON.parse(String(raw.data)) as RealtimeEvent;
        } catch {
          return;
        }
        if (event.type === "ready") {
          attempt = 0;
          setStatus("open");
          window.clearInterval(pingTimer);
          pingTimer = window.setInterval(() => {
            if (current.readyState === WebSocket.OPEN) current.send(JSON.stringify({ type: "ping" }));
          }, PING_MS);
          return;
        }
        if (event.type === "pong") return;
        let handled = false;
        for (const listener of listeners.current) {
          handled = listener(event) || handled;
        }
        if (event.type === "message.created" && !event.message.sender_is_me && !handled) {
          refreshSoon();
        }
      };
      current.onclose = (closeEvent) => {
        window.clearInterval(pingTimer);
        if (socket !== current) return;
        socket = null;
        setStatus("closed");
        scheduleReconnect(AUTH_FAILURES.has(closeEvent.code));
      };
    };

    void connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      socket?.close(1000);
      socket = null;
    };
  }, [isSignedIn, refreshSoon]);

  useEffect(
    () => () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    },
    [],
  );

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
