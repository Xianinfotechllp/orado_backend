exports.formatMinutesToReadable = (minutes) => {
  if (minutes < 60) return `${minutes} mins`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0
    ? `${hours} hr ${remainingMins} mins`
    : `${hours} hr`;
};
