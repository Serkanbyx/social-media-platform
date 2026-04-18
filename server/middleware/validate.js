import { validationResult } from "express-validator";

// Runs an array of express-validator rule chains and short-circuits with a
// 400 response when any rule fails. The response shape mirrors the global
// error handler so the client can use a single error parser.
const validate = (rules) => async (req, res, next) => {
  await Promise.all(rules.map((rule) => rule.run(req)));

  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = {};
  for (const error of result.array({ onlyFirstError: true })) {
    const field = error.path || error.param || "_";
    if (!errors[field]) errors[field] = error.msg;
  }

  return res.status(400).json({
    status: "error",
    message: "Validation failed.",
    errors,
  });
};

export default validate;
