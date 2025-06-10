const { haversineDistance } = require("../utils/distanceCalculator");
const {deliveryFeeCalculator,deliveryFeeCalculator2} = require("../utils/deliveryFeeCalculator")
const TAX_PERCENTAGE = 5;

exports.calculateOrderCost = ({ cartProducts, restaurant, userCoords, couponCode }) => {
  if (!cartProducts.length) throw new Error("Cart is empty");

  // Subtotal
  let subtotal = 0;
  // console.log("🛒 Incoming cart items:", cartProducts);

  cartProducts.forEach((item, index) => {
      console.log(`Checking item ${index}:`, item);
    if (
      item.price == null ||
      item.quantity == null ||
      typeof item.price !== "number" ||
      typeof item.quantity !== "number" ||
      item.quantity <= 0 ||
      item.price < 0
    ) {
        console.log("🚨 Invalid cart item:", item);
      throw new Error(`Each cart item must have price and quantity (check item at index ${index})`);
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
  console.log("Subtotal:", subtotal, "Tax:", tax, "Total:", total);


  return {
    subtotal,
    discount,
    tax,
    deliveryFee,
    total,
    distanceKm,
  };
};




exports.calculateOrderCost2 = ({
  cartProducts,
  tipAmount = 0,
  couponCode,
  restaurantCoords,
  userCoords,
  revenueShare = { type: 'percentage', value: 10 } // default if not provided
}) => {
  let cartTotal = 0;
  cartProducts.forEach(item => {
    cartTotal += item.price * item.quantity;
  });

  // Delivery Fee based on distance
  const deliveryFee = deliveryFeeCalculator2(restaurantCoords, userCoords);

  // Dummy discount logic (can replace with DB coupon lookup)
  let discount = 0;
  if (couponCode) {
    if (couponCode === "WELCOME50") {
      discount = 50;
    } else if (couponCode === "FREEDLV") {
      discount = deliveryFee;
    }
  }

  // Calculate final amount before revenue share
  const finalAmountBeforeRevenueShare = cartTotal + deliveryFee + tipAmount - discount;

  // Calculate revenue share
  let revenueShareAmount = 0;
  if (revenueShare.type === 'percentage') {
    revenueShareAmount = (finalAmountBeforeRevenueShare * revenueShare.value) / 100;
  } else if (revenueShare.type === 'fixed') {
    revenueShareAmount = revenueShare.value;
  }

  // Optional: You can either return revenueShareAmount separately for reporting,
  // or if you want it included in the final cost the customer pays, add it here:
  // const finalAmount = finalAmountBeforeRevenueShare + revenueShareAmount;

  // But usually revenue share is platform’s cut, not charged extra to customer:
  const finalAmount = finalAmountBeforeRevenueShare;

  return {
    cartTotal,
    deliveryFee,
    tipAmount,
    discount,
    revenueShareAmount,
    finalAmount
  };
}
