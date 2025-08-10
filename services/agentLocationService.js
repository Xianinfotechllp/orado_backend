const Order = require("../models/orderModel");

async function handleAgentLocation(io, agentId, lat, lng, deviceInfo, socket) {
  // Notify admins
//   socket.broadcast.emit("admin:updateLocation", { agentId, lat, lng, deviceInfo });

  // Find active order in pickup
  const activeOrder = await Order.findOne({
    assignedAgent: agentId,
    orderStatus: "picked_up"
  }).populate("customerId");

  if (activeOrder && activeOrder.customerId?._id) {
    const customerRoom = `user_${activeOrder.customerId._id}`;
    io.to(customerRoom).emit("agentLocationUpdate", {
      orderId: activeOrder._id,
      agentId,
      latitude:lat,
     longitude: lng,
    });
    console.log(`🚚 Sent live location to customer ${activeOrder.customerId._id}`);
  }
}

module.exports = { handleAgentLocation };
