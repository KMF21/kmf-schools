"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "saved" | "pending" | "saving" | "offline" | "error";

/**
 * Collects changes and saves them in small batches a moment after typing stops.
 * Unsaved changes are kept in this browser, so a dropped connection or a closed
 * tab loses nothing: they are sent again when the page is next open and online.
 */
export function useAutosave<T>({
  storageKey,
  keyOf,
  send,
  delay = 1200,
}: {
  storageKey: string;
  keyOf: (item: T) => string;
  send: (items: T[]) => Promise<{ error?: string }>;
  delay?: number;
}) {
  const queue = useRef(new Map<string, T>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(() => {
    try {
      if (queue.current.size) localStorage.setItem(storageKey, JSON.stringify([...queue.current.values()]));
      else localStorage.removeItem(storageKey);
    } catch {
      /* private browsing: changes still save while the page is open */
    }
  }, [storageKey]);

  const flush = useCallback(async () => {
    if (busy.current || queue.current.size === 0) return;
    if (timer.current) clearTimeout(timer.current);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    busy.current = true;
    setStatus("saving");
    const batch = [...queue.current.entries()];
    let retry = false;
    try {
      const result = await send(batch.map(([, v]) => v));
      if (result.error) {
        // Refused (not a connection problem): keep for "Try again", but don't resend on every visit.
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
        setStatus("error");
        setError(result.error);
      } else {
        // Remove only what was sent and hasn't changed since.
        for (const [k, v] of batch) if (queue.current.get(k) === v) queue.current.delete(k);
        persist();
        setError(null);
        setStatus(queue.current.size ? "pending" : "saved");
        retry = queue.current.size > 0;
      }
    } catch {
      setStatus("offline");
      retry = true;
    } finally {
      busy.current = false;
      if (retry) timer.current = setTimeout(() => void flushRef.current(), 4000);
    }
  }, [persist, send, storageKey]);

  const push = useCallback(
    (item: T) => {
      queue.current.set(keyOf(item), item);
      persist();
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flushRef.current(), delay);
    },
    [delay, keyOf, persist],
  );

  // Changes left from last time (closed tab, lost connection).
  const restore = useCallback((): T[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      const items = raw ? (JSON.parse(raw) as T[]) : [];
      for (const item of items) queue.current.set(keyOf(item), item);
      return items;
    } catch {
      return [];
    }
  }, [keyOf, storageKey]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    const online = () => void flushRef.current();
    const leave = (e: BeforeUnloadEvent) => {
      if (queue.current.size) e.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", leave);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { push, flush, restore, status, error };
}
