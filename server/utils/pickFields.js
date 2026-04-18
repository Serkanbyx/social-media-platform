// Returns a shallow copy of `source` containing only the whitelisted keys.
// Useful as a defence against mass-assignment in update endpoints.

const pickFields = (source, allowedKeys) => {
  if (!source || typeof source !== "object") return {};
  const result = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
};

export default pickFields;
