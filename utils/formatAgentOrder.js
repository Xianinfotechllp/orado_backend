// utils/formatAgentOrder.js
function formatAgentOrder(order, agentId) {
  const deliveryCoords =
    order.deliveryLocation?.coordinates?.length === 2
      ? {
          lon: order.deliveryLocation.coordinates[0],
          lat: order.deliveryLocation.coordinates[1],
        }
      : null;

  const restaurantCoords =
    order.restaurantId?.location?.coordinates?.length === 2
      ? {
          lon: order.restaurantId.location.coordinates[0],
          lat: order.restaurantId.location.coordinates[1],
        }
      : null;

  const isAutoAssigned =
    order.assignedAgent?.toString() === agentId.toString();

  const candidateEntry = order.agentCandidates?.find(
    (c) => c.agent.toString() === agentId.toString()
  );

  const isManualPending = candidateEntry?.status === 'pending';
  const isManualAccepted = candidateEntry?.status === 'accepted';

  return {
    id: order._id,
    status: order.orderStatus,
    agentDeliveryStatus: order.agentDeliveryStatus || 'awaiting_start',
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    scheduledTime: order.scheduledTime || null,
    instructions: order.instructions || '',
    deliveryLocation: deliveryCoords,
    deliveryAddress: order.deliveryAddress,
    items: order.orderItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.totalPrice,
      image: item.image,
    })),
    customer: {
      name: order.customerId?.name || '',
      phone: order.customerId?.phone || '',
      email: order.customerId?.email || '',
    },
    restaurant: {
      name: order.restaurantId?.name || '',
      address: order.restaurantId?.address || '',
      location: restaurantCoords,
    },

    // UI decision flags
    isAutoAssigned,
    showAcceptReject: !isAutoAssigned && isManualPending,
    showOrderFlow: isAutoAssigned || isManualAccepted,
  };
}
