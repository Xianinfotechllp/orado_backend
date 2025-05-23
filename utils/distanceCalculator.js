exports.haversineDistance = (coord1, coord2) => {
  const toRad = angle => (angle * Math.PI) / 180;

  const [lon1, lat1] = coord1;  // array: [longitude, latitude]
  const [lon2, lat2] = coord2;

  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance; // in km
};
