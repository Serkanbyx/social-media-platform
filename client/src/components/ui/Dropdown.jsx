import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { useEscapeKey } from "../../hooks/useEscapeKey.js";
import { cn } from "../../utils/cn.js";

/**
 * Dropdown — trigger + floating menu, fully keyboard-accessible.
 *
 * Items are passed as a flat list `[{ label, icon, onClick, danger,
 * disabled, divider }]`. Pure data driven so consumers don't have to
 * reimplement the menu shell each time (used by post `⋯` menu, navbar
 * user menu, admin row actions).
 *
 * Keyboard contract (`role="menu"` / `role="menuitem"`):
 *  - ↓ / ↑ moves focus between items (wraps at the ends)
 *  - Home / End jump to first / last
 *  - Enter or Space invokes the focused item
 *  - Esc closes the menu and returns focus to the trigger
 *  - A click outside the dropdown closes it
 */
const ALIGN_CLASSES = {
  start: { bottom: "left-0 origin-top-left", top: "left-0 origin-bottom-left" },
  end: { bottom: "right-0 origin-top-right", top: "right-0 origin-bottom-right" },
};

const PLACEMENT_CLASSES = {
  bottom: "top-full mt-2",
  top: "bottom-full mb-2",
};

// Estimated dropdown height (4 items + padding) used to decide whether the
// menu has enough room below the trigger before opening upward instead.
const ESTIMATED_MENU_HEIGHT = 200;

// Reserved viewport space at the bottom on mobile so the menu doesn't end
// up underneath the fixed bottom navigation bar (h-14 + safety buffer).
const MOBILE_BOTTOM_RESERVE = 80;
const DESKTOP_BOTTOM_RESERVE = 16;

export default function Dropdown({
  trigger,
  items = [],
  align = "end",
  width = "w-56",
  className = "",
}) {
  const reactId = useId();
  const menuId = `menu-${reactId}`;
  const wrapperRef = useRef(null);
  const itemsRef = useRef([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState("bottom");

  // Trigger is the first focusable child inside the wrapper. Looking it
  // up on demand avoids cloneElement-with-ref-callback, which React
  // Compiler can't analyse safely.
  const focusTrigger = () => {
    const node = wrapperRef.current?.querySelector(
      '[aria-haspopup="menu"]'
    );
    node?.focus?.({ preventScroll: true });
  };

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
    focusTrigger();
  };

  useClickOutside(wrapperRef, () => setOpen(false), open);
  useEscapeKey(close, open);

  // Decide opening direction the moment the menu becomes visible. Without
  // this, rows near the bottom of the viewport (or sitting just above a
  // mobile bottom-nav) render their menu below the fold where the user
  // can't reach the last item.
  useEffect(() => {
    if (!open) return;
    const triggerNode = wrapperRef.current?.querySelector(
      '[aria-haspopup="menu"]'
    );
    if (!triggerNode) return;
    const rect = triggerNode.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const bottomReserve =
      window.innerWidth < 768 ? MOBILE_BOTTOM_RESERVE : DESKTOP_BOTTOM_RESERVE;
    const spaceBelow = viewportH - rect.bottom - bottomReserve;
    const spaceAbove = rect.top - 16;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlacement(
      spaceBelow < ESTIMATED_MENU_HEIGHT && spaceAbove > spaceBelow
        ? "top"
        : "bottom"
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const target =
      activeIndex >= 0
        ? itemsRef.current[activeIndex]
        : itemsRef.current.find(Boolean);
    target?.focus?.({ preventScroll: true });
  }, [open, activeIndex]);

  const interactiveItems = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => !item?.divider && !item?.disabled);

  const moveFocus = (direction) => {
    if (!interactiveItems.length) return;
    const currentPos = interactiveItems.findIndex(
      ({ idx }) => idx === activeIndex
    );
    const nextPos =
      direction === "first"
        ? 0
        : direction === "last"
          ? interactiveItems.length - 1
          : (currentPos + direction + interactiveItems.length) %
            interactiveItems.length;
    setActiveIndex(interactiveItems[nextPos].idx);
  };

  const handleKeyDown = (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(-1);
        break;
      case "Home":
        event.preventDefault();
        moveFocus("first");
        break;
      case "End":
        event.preventDefault();
        moveFocus("last");
        break;
      default:
    }
  };

  const originalTriggerOnClick = trigger.props.onClick;
  const handleTriggerClick = useCallback(
    (event) => {
      originalTriggerOnClick?.(event);
      if (!event.defaultPrevented) setOpen((value) => !value);
    },
    [originalTriggerOnClick]
  );

  const triggerEl = cloneElement(trigger, {
    onClick: handleTriggerClick,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": menuId,
  });

  return (
    <div ref={wrapperRef} className={cn("relative inline-block", className)}>
      {triggerEl}

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={handleKeyDown}
          className={cn(
            "absolute z-40 overflow-hidden rounded-xl py-1 surface-overlay animate-modal-in",
            (ALIGN_CLASSES[align] || ALIGN_CLASSES.end)[placement],
            PLACEMENT_CLASSES[placement],
            width
          )}
        >
          {items.map((item, idx) => {
            if (item?.divider) {
              return (
                <div
                  key={`divider-${idx}`}
                  role="separator"
                  className="my-1 h-px bg-zinc-100 dark:bg-zinc-800"
                />
              );
            }
            const Icon = item.icon;
            return (
              <button
                key={item.key || `${item.label}-${idx}`}
                ref={(node) => {
                  itemsRef.current[idx] = node;
                }}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick?.();
                  close();
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors duration-fast",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  item.danger
                    ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      item.danger
                        ? "text-rose-500 dark:text-rose-400"
                        : "text-zinc-500 dark:text-zinc-400"
                    )}
                    aria-hidden="true"
                  />
                )}
                <span className="flex-1 truncate">{item.label}</span>
                {item.shortcut && (
                  <span className="text-2xs text-zinc-400">{item.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
