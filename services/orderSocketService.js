const Order = require('../models/orderModel');
const Restaurant = require('../models/restaurantModel');
const User = require('../models/userModel');

async function emitNewOrderToAdmin(io, orderId) {
  try {
    const savedOrder = await Order.findById(orderId);
    if (!savedOrder) {
      console.error('Order not found for socket emission');
      return;
    }

    const [restaurant, user] = await Promise.all([
      Restaurant.findById(savedOrder.restaurantId),
      User.findById(savedOrder.customerId)
    ]);

    if (!restaurant || !user) {
      console.error('Restaurant or user not found for socket emission');
      return;
    }

    const adminOrderData = {
      orderId: savedOrder._id,
      restaurantId: savedOrder.restaurantId,
      orderStatus: savedOrder.orderStatus,
      restaurantName: restaurant.name,
      restaurantAddress: {
        street: restaurant.address.street,
        city: restaurant.address.city,
        state: restaurant.address.state,
        zip: restaurant.address.pincode
      },
      restaurantLocation: restaurant.location,
      customerName: user.name,
      customerId: user._id,
      amount: `₹${savedOrder.totalAmount.toFixed(2)}`,
      address: `${savedOrder.deliveryAddress.street}, ${savedOrder.deliveryAddress.city}, ${savedOrder.deliveryAddress.state}`,
      paymentStatus: savedOrder.paymentMethod === "online" ? "pending" : "paid",
      paymentMethod: savedOrder.paymentMethod,
      preparationTime: calculatePreparationTime(savedOrder),
      orderTime: savedOrder.createdAt,
      scheduledDeliveryTime: new Date(Date.now() + 20*60000),
      orderItems: savedOrder.orderItems,
      deliveryLocation: savedOrder.deliveryLocation,
      distanceKm: savedOrder.distanceKm,
      subtotal: savedOrder.subtotal,
      tax: savedOrder.tax,
      discountAmount: savedOrder.discountAmount,
      deliveryCharge: savedOrder.deliveryCharge,
      tipAmount: savedOrder.tipAmount,
      totalAmount: savedOrder.totalAmount,
      couponCode: savedOrder.couponCode,
      instructions: savedOrder.instructions,
      agentAssignmentStatus: savedOrder.agentAssignmentStatus
    };

    io.to('admin_group').emit('new_order', adminOrderData);
    console.log('New order emitted to admin channel');
  } catch (error) {
    console.error('Error emitting new order to admin:', error);
  }
}

function calculatePreparationTime(order) {
  // Implement your logic to calculate preparation time
  return "20 Mins"; // Default for now
}

module.exports = {
  emitNewOrderToAdmin
};