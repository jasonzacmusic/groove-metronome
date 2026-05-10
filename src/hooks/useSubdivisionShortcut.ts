import { useCallback, useEffect, useRef } from "react";

import { subdivisionShortcutForKey, type SubdivisionCount } from "@/lib/metronome-types";

const RECENT_SHORTCUT_MS = 1200;

export function useSubdivisionShortcut(bpm: number) {
  const heldSubdivisionRef = useRef<SubdivisionCount | null>(null);
  const recentSubdivisionRef = useRef<{ subdivision: SubdivisionCount; expiresAt: number } | null>(null);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLInputElement
      || target instanceof HTMLSelectElement
      || target instanceof HTMLTextAreaElement
      || (target instanceof HTMLElement && target.isContentEditable);
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const shortcut = subdivisionShortcutForKey(event.key, bpm);
      if (!shortcut) return;
      heldSubdivisionRef.current = shortcut;
      recentSubdivisionRef.current = {
        subdivision: shortcut,
        expiresAt: window.performance.now() + RECENT_SHORTCUT_MS,
      };
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const shortcut = subdivisionShortcutForKey(event.key, bpm);
      if (shortcut && heldSubdivisionRef.current === shortcut) heldSubdivisionRef.current = null;
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
    };
  }, [bpm]);

  return useCallback((): SubdivisionCount | null => {
    if (heldSubdivisionRef.current) return heldSubdivisionRef.current;
    const recent = recentSubdivisionRef.current;
    if (!recent || recent.expiresAt < window.performance.now()) return null;
    return recent.subdivision;
  }, []);
}
