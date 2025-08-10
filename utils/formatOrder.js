// utils/formatOrder.js
const formatOrder = (order, agentId) => {
  const isAssigned = order.assignedAgent?.toString() === agentId.toString();

  // Find the candidate entry for this agent
  const candidateEntry = order.agentCandidates?.find(
    (entry) => entry.agent.toString() === agentId.toString()
  );

  const candidateStatus = candidateEntry?.status || null;
  const isCandidateAccepted = candidateStatus === "accepted";
  const isCandidatePending = candidateStatus === "pending";
  const isCurrentCandidate = candidateEntry?.isCurrentCandidate || false;

  const isAutoAssigned = isAssigned && !candidateEntry;

  // Show Accept/Reject buttons logic
  let showAcceptReject = false;
  if (order.allocationMethod === "one-by-one") {
    // Only current candidate with pending status sees buttons
    showAcceptReject = isCandidatePending && isCurrentCandidate && !isAssigned;
  } else if (order.allocationMethod === "send-to-all") {
    // All pending candidates see buttons
    showAcceptReject = isCandidatePending && !isAssigned;
  }

  const showOrderFlow = isAutoAssigned || isCandidateAccepted || isAssigned;

  // Delivery location coords
  const deliveryCoords =
    order.deliveryLocation?.coordinates?.length === 2
      ? {
          lat: order.deliveryLocation.coordinates[1],
          lon: order.deliveryLocation.coordinates[0],
        }
      : null;

  // Restaurant location coords
  const restaurantCoords =
    order.restaurantId?.location?.coordinates?.length === 2
      ? {
          lat: order.restaurantId.location.coordinates[1],
          lon: order.restaurantId.location.coordinates[0],
        }
      : null;

  // Map order items
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
    collectAmount: order.totalAmount || 0,

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
    candidateStatus,
    isCurrentCandidate,
    showAcceptReject,
    showOrderFlow,
  };
};

module.exports = formatOrder;
