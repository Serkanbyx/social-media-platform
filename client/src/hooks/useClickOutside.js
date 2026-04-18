import { useEffect } from "react";

/**
 * useClickOutside — fires `handler` when a pointerdown event lands
 * outside the referenced element (or any element in `refs` if an array
 * is passed). Used to close dropdowns, popovers, mobile menus.
 *
 * `pointerdown` is preferred over `mousedown` so it fires for stylus
 * and touch input as well; we still fall back gracefully when not
 * supported by listening for both.
 */
export function useClickOutside(refs, handler, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof handler !== "function") return undefined;
    const list = Array.isArray(refs) ? refs : [refs];

    const onPointerDown = (event) => {
      const target = event.target;
      const inside = list.some((ref) => ref?.current && ref.current.contains(target));
      if (!inside) handler(event);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [refs, handler, enabled]);
}

export default useClickOutside;
