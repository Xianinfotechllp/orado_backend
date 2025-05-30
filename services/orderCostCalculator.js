const { haversineDistance } = require("../utils/distanceCalculator");
const {deliveryFeeCalculator} = require("../utils/deliveryFeeCalculator")
const TAX_PERCENTAGE = 5;

exports.calculateOrderCost = ({ cartProducts, restaurant, userCoords, couponCode }) => {
  if (!cartProducts.length) throw new Error("Cart is empty");

  // Subtotal
  let subtotal = 0;
  cartProducts.forEach((item) => {
    if (!item.price || !item.quantity) {
      throw new Error("Each cart item must have price and quantity");
    }
    subtotal += item.price * item.quantity;
  });

  // Distance Calculation
  const restaurantCoords = restaurant.location.coordinates;
  const distanceKm = haversineDistance(restaurantCoords, userCoords);

  // Delivery Fee
  const deliveryFee = deliveryFeeCalculator({
    distanceKm,
    orderAmount: subtotal,
  });

  // Coupon Discount
  let discount = 0;
  if (couponCode) {
    const coupon = coupons[couponCode.toUpperCase()];
    if (!coupon) throw new Error("Invalid coupon code");
    if (coupon.type === "percentage") {
      discount = (subtotal * coupon.value) / 100;
    } else if (coupon.type === "flat") {
      discount = coupon.value;
    }
  }

  // Tax
  const taxableAmount = Math.max(subtotal - discount, 0);
  const tax = (taxableAmount * TAX_PERCENTAGE) / 100;

  // Final total
  const total = taxableAmount + tax + deliveryFee;

  return {
    subtotal,
    discount,
    tax,
    deliveryFee,
    total,
    distanceKm,
  };
};