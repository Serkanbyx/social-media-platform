/**
 * linkify — splits user-provided text into a token stream that callers can
 * render as React elements. Recognises three patterns commonly found in
 * post / comment bodies:
 *
 *   - `@username`  → mention   (`/u/<username>`)
 *   - `#tag`       → hashtag   (`/explore?q=#<tag>`)
 *   - `http(s)://` → external URL (target=_blank, rel="noopener noreferrer")
 *
 * Returns plain data — never raw HTML — so the consumer always renders via
 * React (auto-escaped). This is the safe equivalent of
 * `dangerouslySetInnerHTML` and intentionally avoids it.
 *
 * Trailing punctuation (`.`, `,`, `!`, `?`, `:`, `;`, `)`) is stripped from
 * the matched URL/mention/tag and pushed back into a following text token,
 * so e.g. "Visit https://x.com." doesn't link the period.
 */

const TOKEN_PATTERN =
  /(@[a-zA-Z0-9_]{1,30})|(#[\p{L}\p{N}_]{1,50})|(https?:\/\/[^\s]+)/gu;

const TRAILING_PUNCTUATION = /[.,!?:;)]+$/;

const splitTrailingPunctuation = (value) => {
  const match = value.match(TRAILING_PUNCTUATION);
  if (!match) return [value, ""];
  const cut = value.length - match[0].length;
  if (cut <= 0) return [value, ""];
  return [value.slice(0, cut), match[0]];
};

export function tokenize(text) {
  if (typeof text !== "string" || text.length === 0) return [];

  const tokens = [];
  let cursor = 0;

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      tokens.push({ type: "text", value: text.slice(cursor, start) });
    }

    const raw = match[0];
    const [body, trailing] = splitTrailingPunctuation(raw);

    if (match[1]) {
      tokens.push({
        type: "mention",
        value: body,
        username: body.slice(1),
      });
    } else if (match[2]) {
      tokens.push({
        type: "hashtag",
        value: body,
        tag: body.slice(1),
      });
    } else if (match[3]) {
      tokens.push({ type: "url", value: body, href: body });
    }

    if (trailing) tokens.push({ type: "text", value: trailing });
    cursor = start + raw.length;
  }

  if (cursor < text.length) {
    tokens.push({ type: "text", value: text.slice(cursor) });
  }

  return tokens;
}

export default tokenize;
