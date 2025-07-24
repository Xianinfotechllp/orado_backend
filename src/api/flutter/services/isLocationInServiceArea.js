
const Restaurant = require('../../../../models/restaurantModel')
const isLocationInServiceArea = async (restaurantId, longitude, latitude) => {
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    serviceAreas: {
      $geoIntersects: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
      },
    },
  });

  return restaurant;
};

module.exports = isLocationInServiceArea;
