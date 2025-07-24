module.exports = function formatOrderResponse(order) {
  const deliveryCoords = order.deliveryLocation?.coordinates || [];
  const restaurantCoords = order.restaurantId?.location?.coordinates || [];

  return {
    id: order._id,
    status: order.orderStatus,
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
    deliveryLocation: deliveryCoords.length === 2 ? {
      lat: deliveryCoords[1],
      long: deliveryCoords[0],
    } : null,

    customer: {
      name: order.customerId?.name || "",
      phone: order.customerId?.phone || "",
      email: order.customerId?.email || "",
    },

    restaurant: {
      name: order.restaurantId?.name || "",
      address: order.restaurantId?.address || "",
      phone: order.restaurantId?.phone || "",
      location: restaurantCoords.length === 2 ? {
        lat: restaurantCoords[1],
        long: restaurantCoords[0],
      } : null,
    },

    agent: order.assignedAgent ? {
      id: order.assignedAgent._id,
      name: order.assignedAgent.name || "",
      phone: order.assignedAgent.phone || ""
    } : null,

    items: order.orderItems.map((item) => {
      const product = item.productId || {};
      return {
        name: product.name || item.name || "",
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
        image: product.images?.[0] || item.image || "",
        description: product.description || "",
        unit: product.unit || "piece",
        foodType: product.foodType || "",
        preparationTime: product.preparationTime || 0,
        addOns: product.addOns || [],
        attributes: product.attributes || [],
      };
    }),

    offer: {
      name: order.offerName || "",
      discount: order.offerDiscount || 0,
      couponCode: order.couponCode || "",
    },

    taxDetails: order.taxDetails || [],
  };
};
