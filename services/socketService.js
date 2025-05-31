// Emit new order event to restaurant room



exports.emitNewOrder = (io, restaurantId, orderData) => {
  io.to(restaurantId.toString()).emit('new-order', orderData);
};

// Emit order status update event to customer room
exports.emitOrderStatusUpdate = (io, customerId, statusUpdate) => {
  io.to(customerId.toString()).emit('order-status-update', statusUpdate);
};

// Emit a generic notification to a specific user room
exports.emitNotification = (io, userId, notification) => {
  io.to(userId.toString()).emit('notification', notification);
};
