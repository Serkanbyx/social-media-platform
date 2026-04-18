// ReDoS-safe regex escaper for user-provided search input.
//
// Mongo's `$regex` operator compiles whatever string we pass straight into a
// PCRE-style pattern, so anything we forward from `req.query.q` MUST first
// have its regex metacharacters neutralised. Without this, a single character
// like `(` would crash the query, and a crafted catastrophic-backtracking
// pattern (e.g. `(a+)+$`) could pin the event loop for seconds.
//
// We also clamp the input to 80 characters: search terms longer than that
// add no UX value and only widen the attack surface.
const REGEX_METACHARS = /[.*+?^${}()|[\]\\]/g;
const MAX_QUERY_LENGTH = 80;

const escapeRegex = (input) =>
  String(input).replace(REGEX_METACHARS, "\\$&").slice(0, MAX_QUERY_LENGTH);

export default escapeRegex;
