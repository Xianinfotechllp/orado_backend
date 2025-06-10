const Cart = require("../models/cartModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Restaurant = require("../models/restaurantModel");
const { calculateOrderCost } = require("./orderCostCalculator");
const { findAndAssignNearestAgent } = require("./findAndAssignNearestAgent");
const { sendPushNotification } = require("./notificationService");

/**
 * Service to place an order for both lat/lng and saved address flows
 */
exports.placeOrderService = async ({
  userId,
  cartId,
  paymentMethod,
  couponCode,
  instructions,
  tipAmount = 0,
  deliveryAddress
}) => {
  try {
    const { latitude, longitude } = deliveryAddress;

    // Validate cart
    const cart = await Cart.findOne({ _id: cartId, user: userId });
    if (!cart) throw { status: 404, message: "Cart not found" };

    // Validate restaurant
    const restaurant = await Restaurant.findById(cart.restaurantId);
    if (!restaurant) throw { status: 404, message: "Restaurant not found" };

    const userCoords = [parseFloat(longitude), parseFloat(latitude)];

    // Calculate bill
    const billSummary = calculateOrderCost({
      cartProducts: cart.products,
      restaurant,
      userCoords,
      couponCode,
    });
    console.log(billSummary)

    // Prepare order items with images
    const orderItems = await Promise.all(
      cart.products.map(async (item) => {
        const product = await Product.findById(item.productId).select("images");
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          totalPrice: item.price * item.quantity,
          image: product?.images?.[0] || null,
        };
      })
    );

    // // Create order
    // const newOrder = new Order({
    //   customerId: userId,
    //   restaurantId: cart.restaurantId,
    //   orderItems,
    //   paymentMethod,
    //   orderStatus: "pending",
    //   deliveryLocation: { type: "Point", coordinates: userCoords },
    //   deliveryAddress: {
    //     ...deliveryAddress,
    //     latitude: parseFloat(latitude),
    //     longitude: parseFloat(longitude),
    //   },
    //   subtotal: billSummary.subtotal,
    //   tax: billSummary.tax,
    //   discountAmount: billSummary.discount,
    //   deliveryCharge: billSummary.deliveryFee,
    //   surgeCharge: 0,
    //   tipAmount,
    //   totalAmount: billSummary.total + tipAmount,
    //   distanceKm: billSummary.distanceKm,
    //   couponCode,
    //   instructions,
    // });

    // const savedOrder = await newOrder.save();

    // // Auto-assign agent
    // const assignedAgent = await findAndAssignNearestAgent(savedOrder._id, { longitude, latitude });

    // let updateData = {};
    // let orderStatus = "awaiting_agent_assignment";

    // if (assignedAgent) {
    //   updateData.assignedAgent = assignedAgent._id;

    //   if (assignedAgent.permissions.canAcceptOrRejectOrders) {
    //     orderStatus = "pending_agent_acceptance";
    //     await sendPushNotification(
    //       assignedAgent.userId,
    //       "New Delivery Request",
    //       "You have a new delivery request."
    //     );
    //   } else {
    //     orderStatus = "assigned_to_agent";
    //     const io = global.io; // if io is globally set
    //     io?.to(`agent_${assignedAgent._id}`).emit("startDeliveryTracking", {
    //       orderId: savedOrder._id,
    //       customerId: savedOrder.customerId,
    //       restaurantId: savedOrder.restaurantId,
    //     });
    //   }
    // }

    // updateData.orderStatus = orderStatus;
    // await Order.findByIdAndUpdate(savedOrder._id, updateData);

    // return {
    //   message: "Order placed successfully",
    //   orderId: savedOrder._id,
    //   totalAmount: savedOrder.totalAmount,
    //   billSummary,
    //   orderStatus,
    // };

  } catch (error) {
    console.error("Order placement error:", error);
    throw error;
  }
};
