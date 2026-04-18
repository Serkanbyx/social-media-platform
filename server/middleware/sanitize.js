// NoSQL-injection sanitizer compatible with Express 5.
//
// EXPRESS 5 CRITICAL: do NOT call `mongoSanitize()` as global middleware.
// In Express 5 `req.query` is a read-only getter, and the library tries to reassign it,
// which throws "Cannot set property query of #<IncomingMessage> which has only a getter"
// on every request. Sanitize only the writable surfaces: `req.body` and `req.params`.

import mongoSanitize from "express-mongo-sanitize";

const sanitize = (req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    mongoSanitize.sanitize(req.body, { replaceWith: "_" });
  }
  if (req.params && typeof req.params === "object") {
    mongoSanitize.sanitize(req.params, { replaceWith: "_" });
  }
  next();
};

export default sanitize;
