// Wraps async route handlers so that any thrown/rejected error is forwarded
// to the global Express error middleware. Avoids a forest of try/catch blocks.

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export default asyncHandler;
