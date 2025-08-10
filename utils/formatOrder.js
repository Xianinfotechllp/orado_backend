// utils/formatOrder.js
const formatOrder = (order, agentId) => {
  const isAssigned = order.assignedAgent?.toString() === agentId.toString();

  // Find the candidate entry for this agent
  const candidateEntry = order.agentCandidates?.find(
    (entry) => entry.agent.toString() === agentId.toString()
  );

  // Treat "sent" as "pending" for frontend display
  const normalizedStatus =
    candidateEntry?.status === "sent" ? "pending" : candidateEntry?.status;

  const isCandidateAccepted = normalizedStatus === "accepted";
  const isCandidatePending = normalizedStatus === "pending";

  const isAutoAssigned = isAssigned && !candidateEntry;
  const showAcceptReject =
    !isAutoAssigned && isCandidatePending && !isAssigned;
  const showOrderFlow =
    isAutoAssigned || isCandidateAccepted || isAssigned;

  const deliveryCoords =
    order.deliveryLocation?.coordinates?.length === 2
      ? {
          lat: order.deliveryLocation.coordinates[1],
          lon: order.deliveryLocation.coordinates[0],
        }
      : null;

  const restaurantCoords =
    order.restaurantId?.location?.coordinates?.length === 2
      ? {
          lat: order.restaurantId.location.coordinates[1],
          lon: order.restaurantId.location.coordinates[0],
        }
      : null;

  const orderItems = order.orderItems.map((item) => {
    const product = item.productId;
    return {
      name: product?.name || item.name || "",
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.totalPrice,
      image: product?.images?.[0] || item.image || "",
      description: product?.description || "",
      unit: product?.unit || "piece",
      foodType: product?.foodType || "",
      preparationTime: product?.preparationTime || 0,
      addOns: product?.addOns || [],
      attributes: product?.attributes || [],
    };
  });

  return {
    id: order._id,
    status: order.orderStatus,
    agentAssignmentStatus: order.agentAssignmentStatus,
    agentDeliveryStatus: order.agentDeliveryStatus,

    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    subtotal: order.subtotal,
    tax: order.tax,
    deliveryCharge: order.deliveryCharge,
    tipAmount: order.tipAmount,

    createdAt: order.createdAt,
    scheduledTime: order.scheduledTime || null,
    instructions: order.instructions || "",
    deliveryAddress: order.deliveryAddress,
    deliveryLocation: deliveryCoords,

    customer: {
      name: order.customerId?.name || "",
      phone: order.customerId?.phone || "",
      email: order.customerId?.email || "",
    },

    restaurant: {
      name: order.restaurantId?.name || "",
      address: order.restaurantId?.address || "",
      location: restaurantCoords,
      phone: order.restaurantId?.phone || "",
    },

    paymentMethod: order.paymentMethod,
    collectAmount: order.totalAmount || 0,

    items: orderItems,

    offer: {
      name: order.offerName || "",
      discount: order.offerDiscount || 0,
      couponCode: order.couponCode || "",
    },

    taxDetails: order.taxDetails || [],

    // UI Flags
    isAssigned,
    isAutoAssigned,
    showAcceptReject,
    showOrderFlow,
  };
};

module.exports = formatOrder;
