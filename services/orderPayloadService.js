const geolib = require("geolib");
const axios = require("axios");

/**
 * Build a reusable order payload for Socket.IO / push notifications
 * @param {Object} order - Mongoose order document
 * @param {Object} agent - Mongoose agent document (optional, for personalized payload)
 * @param {Object} config - Additional options
 * @returns {Object} payload
 */
const buildOrderPayload = async (order, agent = null, config = {}) => {
  let distanceKm = 0;
  let mapboxDistance = 0;

  // 1️⃣ Calculate straight-line distance
  if (Array.isArray(order.restaurantId?.location?.coordinates) && Array.isArray(order.deliveryLocation?.coordinates)) {
    const fromCoords = order.restaurantId.location.coordinates;
    const toCoords = order.deliveryLocation.coordinates;

    const from = { latitude: fromCoords[1], longitude: fromCoords[0] };
    const to = { latitude: toCoords[1], longitude: toCoords[0] };
    const distanceInMeters = geolib.getDistance(from, to);
    distanceKm = distanceInMeters / 1000;

    // 2️⃣ Mapbox driving distance (optional)
    if (config.useMapboxDistance) {
      const accessToken = process.env.MAPBOX_ACCESS_TOKEN || config.mapboxAccessToken;
      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromCoords[0]},${fromCoords[1]};${toCoords[0]},${toCoords[1]}?geometries=geojson&access_token=${accessToken}`;
        const response = await axios.get(url);
        mapboxDistance = response.data.routes[0].distance / 1000;
      } catch (err) {
        console.warn("Mapbox distance fetch failed, using straight line distance");
        mapboxDistance = distanceKm;
      }
    } else {
      mapboxDistance = distanceKm;
    }
  }

  // 3️⃣ Construct payload
  return {
    orderDetails: {
      id: order._id,
      totalPrice: order.totalAmount,
      deliveryAddress: order.deliveryAddress,
      deliveryLocation: {
        lat: order.deliveryLocation?.coordinates?.[1] || 0,
        long: order.deliveryLocation?.coordinates?.[0] || 0,
      },
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      orderItems: order.orderItems || [],
      estimatedEarning: config.estimatedEarning || 0,
      distanceKm: mapboxDistance.toFixed(2),
      customer: {
        name: order.customerId?.name || "",
        phone: order.customerId?.phone || "",
        email: order.customerId?.email || "",
      },
      restaurant: {
        name: order.restaurantId?.name || "",
        address: order.restaurantId?.address || "",
        location: {
          lat: order.restaurantId?.location?.coordinates?.[1] || 0,
          long: order.restaurantId?.location?.coordinates?.[0] || 0,
        },
      },
    },
    allocationMethod: config.allocationMethod || "manual",
    requestExpirySec: config.requestExpirySec || 30,
    showAcceptReject: config.showAcceptReject ?? true,
  };
};

module.exports = { buildOrderPayload };
