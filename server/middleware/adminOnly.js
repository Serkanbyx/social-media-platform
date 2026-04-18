// Must run AFTER `protect` so req.user is guaranteed to exist when the user
// is authenticated. Returns 401 for anonymous callers and 403 for authenticated
// non-admins so the client can distinguish "log in" from "you can't do that".

const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ status: "error", message: "Authentication required." });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ status: "error", message: "Admin access required." });
  }
  return next();
};

export default adminOnly;
