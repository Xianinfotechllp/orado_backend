// utils/parseCoordinates.js
module.exports = function parseCoordinates(input) {
  let coords = input;

  if (typeof coords === 'string') {
    try {
      coords = JSON.parse(coords);
    } catch (e) {
      console.error("Failed to parse coordinates string:", e);
      return null;
    }
  }

  if (Array.isArray(coords) && coords.length === 2) {
    const [lng, lat] = coords.map(Number);
    if (!isNaN(lng) && !isNaN(lat)) {
      return [lng, lat];
    }
  }

  console.warn("Invalid coordinates format:", input);
  return null;
};
