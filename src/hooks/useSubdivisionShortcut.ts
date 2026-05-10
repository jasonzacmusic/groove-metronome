import { useCallback, useEffect, useRef } from "react";

import { subdivisionShortcutForKey, type SubdivisionCount } from "@/lib/metronome-types";

export function useSubdivisionShortcut(bpm: number) {
  const heldSubdivisionRef = useRef<SubdivisionCount | null>(null);

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
    return heldSubdivisionRef.current;
  }, []);
}
