const Order = require('../models/orderModel');
const Restaurant = require('../models/restaurantModel');
const User = require('../models/userModel');

async function emitNewOrderToAdmin(io, orderId) {
  try {
    const savedOrder = await Order.findById(orderId)
      .populate('agentCandidates.agent', 'fullName phoneNumber')
      .populate('assignedAgent', 'fullName phoneNumber');
    
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

    // Prepare allocation progress data
    const allocationProgress = {
      total: savedOrder.agentCandidates?.length || 0,
      notified: savedOrder.agentCandidates?.filter(c => c.status === 'notified')?.length || 0,
      pending: savedOrder.agentCandidates?.filter(c => c.status === 'pending')?.length || 0,
      accepted: savedOrder.agentCandidates?.filter(c => c.status === 'accepted')?.length || 0,
      rejected: savedOrder.agentCandidates?.filter(c => c.status === 'rejected')?.length || 0,
      timed_out: savedOrder.agentCandidates?.filter(c => c.status === 'timed_out')?.length || 0,
      queued: savedOrder.agentCandidates?.filter(c => c.status === 'queued')?.length || 0,
      currentCandidate: null,
      candidates: []
    };

    // Find current candidate
    const currentCandidate = savedOrder.agentCandidates?.find(c => c.isCurrentCandidate);
    if (currentCandidate) {
      allocationProgress.currentCandidate = {
        agentId: currentCandidate.agent._id,
        fullName: currentCandidate.agent.fullName,
        status: currentCandidate.status,
        notifiedAt: currentCandidate.notifiedAt,
        assignedAt: currentCandidate.assignedAt,
        expiresIn: calculateExpiresIn(currentCandidate.assignedAt)
      };
    }

    // Prepare all candidates
    allocationProgress.candidates = savedOrder.agentCandidates?.map(candidate => ({
      agentId: candidate.agent._id,
      fullName: candidate.agent.fullName,
      status: candidate.status,
      assignedAt: candidate.assignedAt,
      notifiedAt: candidate.notifiedAt,
      respondedAt: candidate.respondedAt,
      rejectionReason: candidate.rejectionReason,
      isCurrentCandidate: candidate.isCurrentCandidate
    })) || [];

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
      agentAssignmentStatus: savedOrder.agentAssignmentStatus,
      allocationMethod: savedOrder.allocationMethod || 'one_by_one',
      allocationProgress: allocationProgress,
      assignedAgent: savedOrder.assignedAgent ? {
        _id: savedOrder.assignedAgent._id,
        fullName: savedOrder.assignedAgent.fullName,
        phoneNumber: savedOrder.assignedAgent.phoneNumber
      } : null
    };

    io.to('admin_group').emit('new_order', adminOrderData);
    console.log('New order emitted to admin channel with allocation data');
  } catch (error) {
    console.error('Error emitting new order to admin:', error);
  }
}

function calculateExpiresIn(assignedAt) {
  if (!assignedAt) return null;
  const expirySeconds = 120; // 2 minutes expiry
  const elapsed = Math.floor((new Date() - new Date(assignedAt)) / 1000);
  return Math.max(0, expirySeconds - elapsed);
}

function calculatePreparationTime(order) {
  // Implement your logic to calculate preparation time
  return "20 Mins"; // Default for now
}
module.exports = {
  emitNewOrderToAdmin
};