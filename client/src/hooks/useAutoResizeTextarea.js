import { useEffect } from "react";

/**
 * useAutoResizeTextarea — keeps a `<textarea>` height in sync with its
 * content so the composer grows naturally as the user types and shrinks
 * when text is removed.
 *
 * We measure with `scrollHeight` after temporarily resetting the height
 * to `auto` (otherwise `scrollHeight` would clamp to the previous
 * height). `maxHeight` caps growth so very long posts don't push the
 * action bar off-screen — past that point the textarea scrolls.
 */
export function useAutoResizeTextarea(textareaRef, value, { maxHeight = 280 } = {}) {
  useEffect(() => {
    const el = textareaRef?.current;
    if (!el) return;
    // The whole point of this hook is to mutate the underlying DOM
    // element's style (not the ref object). The new
    // `react-hooks/immutability` rule is overly cautious here, so we
    // opt out for these intentional DOM writes.
    /* eslint-disable react-hooks/immutability */
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    /* eslint-enable react-hooks/immutability */
  }, [textareaRef, value, maxHeight]);
}

export default useAutoResizeTextarea;
