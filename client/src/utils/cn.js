/**
 * cn — minimal class-name merger.
 *
 * Accepts strings, falsy values and objects in the form
 * `{ "class-a": condition }`. Intentionally tiny: we don't pull in
 * `clsx` or `classnames` since native filtering covers our needs and
 * keeps the bundle small.
 */
export function cn(...args) {
  const out = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === "string" || typeof arg === "number") {
      out.push(arg);
    } else if (Array.isArray(arg)) {
      const inner = cn(...arg);
      if (inner) out.push(inner);
    } else if (typeof arg === "object") {
      for (const key of Object.keys(arg)) {
        if (arg[key]) out.push(key);
      }
    }
  }
  return out.join(" ");
}

export default cn;
