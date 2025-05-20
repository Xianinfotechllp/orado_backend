const Agent = require('../models/agentModel'); // Adjust the path
const Restaurant = require('../models/restaurantModel');

async function awardDeliveryPoints(agentId, deliveryPoints = 10) {
  const agent = await Agent.findById(agentId);
  if (!agent) throw new Error("Agent not found");

  if (!agent.points) {
    agent.points = {
      totalPoints: 0,
      lastAwardedDate: null
    };
  }

  agent.points.totalPoints += deliveryPoints;
  agent.points.lastAwardedDate = new Date();
  agent.dashboard.totalDeliveries += 1;

  await agent.save();
  return agent;
}

module.exports = { awardDeliveryPoints };


async function awardPointsToRestaurant(restaurantId, points, reason, orderId = null) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) return false;

  const alreadyRewarded = orderId && restaurant.pointsHistory.some(entry =>
    entry.orderId?.toString() === orderId.toString() && entry.reason === reason
  );

  if (alreadyRewarded) return false;

  restaurant.points.totalPoints += points;
  restaurant.points.lastAwardedDate = new Date();
  restaurant.pointsHistory.push({
    points,
    reason,
    date: new Date(),
    orderId
  });

  await restaurant.save();
  return true;
}

module.exports = { awardPointsToRestaurant };
