exports.toStringSafe = (value) => {
  if (value === null || value === undefined) return "";
  return value.toString();
};
