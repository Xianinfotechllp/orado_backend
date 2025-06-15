const { haversineDistance } = require("../utils/distanceCalculator");
const {deliveryFeeCalculator,deliveryFeeCalculator2} = require("../utils/deliveryFeeCalculator")
const TAX_PERCENTAGE = 5;
const Offer = require("../models/offerModel")

exports.calculateOrderCost = ({ cartProducts, restaurant, userCoords, couponCode, useWallet = false, walletBalance = 0 }) => {
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

  let walletUsed = 0;
  let payable = total;

  if (useWallet && walletBalance > 0) {
    walletUsed = Math.min(walletBalance, total);
    payable = total - walletUsed;
  }
  console.log("Subtotal:", subtotal, "Tax:", tax, "Total:", total);


  return {
    subtotal,
    discount,
    tax,
    deliveryFee,
    total,
    distanceKm,
    walletUsed,
    payable
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




exports.calculateOrderCostWithOffer = async ({
  cartProducts,
  tipAmount = 0,
  couponCode,
  restaurantId,
  restaurantCoords,
  userCoords,
  revenueShare = { type: 'percentage', value: 10 }
}) => {
  let cartTotal = 0;
  cartProducts.forEach(item => {
    cartTotal += item.price * item.quantity;
  });

  // 1️⃣ Delivery Fee
  const deliveryFee = deliveryFeeCalculator2(restaurantCoords, userCoords);

  // 2️⃣ Coupon Discount (direct code)
  let couponDiscount = 0;
  if (couponCode) {
    if (couponCode === "WELCOME50") {
      couponDiscount = 50;
    } else if (couponCode === "FREEDLV") {
      couponDiscount = deliveryFee;
    }
  }

  // 3️⃣ Active Offer Discount (DB)
  let offerDiscount = 0;
  const now = moment();

  const activeOffers = await Offer.find({
    applicableRestaurants: restaurantId,
    isActive: true,
    validFrom: { $lte: now },
    validTill: { $gte: now },
    minOrderValue: { $lte: cartTotal }
  });

  if (activeOffers.length) {
    // Apply best discount — you can change this logic if needed
    activeOffers.forEach(offer => {
      let discount = 0;
      if (offer.type === 'flat') {
        discount = offer.discountValue;
      } else if (offer.type === 'percentage') {
        discount = (cartTotal * offer.discountValue) / 100;
        if (offer.maxDiscount) discount = Math.min(discount, offer.maxDiscount);
      }
      if (discount > offerDiscount) offerDiscount = discount;
    });
  }

  // 4️⃣ Final Amount Before Revenue Share
  const finalAmountBeforeRevenueShare = cartTotal + deliveryFee + tipAmount - couponDiscount - offerDiscount;

  // 5️⃣ Revenue Share Calculation
  let revenueShareAmount = 0;
  if (revenueShare.type === 'percentage') {
    revenueShareAmount = (finalAmountBeforeRevenueShare * revenueShare.value) / 100;
  } else if (revenueShare.type === 'fixed') {
    revenueShareAmount = revenueShare.value;
  }

  // 6️⃣ Grand Final Amount (customer pays)
  const finalAmount = finalAmountBeforeRevenueShare;

  // Return full breakdown
  return {
    cartTotal,
    deliveryFee,
    tipAmount,
    couponDiscount,
    offerDiscount,
    revenueShareAmount,
    finalAmount
  };
};




exports.calculateOrderCostV2 = ({
  cartProducts,
  tipAmount = 0,
  couponCode,
  restaurantCoords,
  userCoords,
  offers = [],
  revenueShare = { type: 'percentage', value: 20 },
  taxRate = 5,
  isSurge = false,
  surgeFeeAmount = 0,
  surgeReason = null
}) => {
  let cartTotal = 0;
  cartProducts.forEach(item => {
    cartTotal += item.price * item.quantity;
  });

  const deliveryFee = deliveryFeeCalculator2(restaurantCoords, userCoords);

  let offerDiscount = 0;
  let appliedOffer = null;
  if (offers.length) {
    offers.forEach(offer => {
      let discount = 0;
      if (offer.type === "flat") {
        discount = offer.discountValue;
      } else if (offer.type === "percentage") {
        discount = (cartTotal * offer.discountValue) / 100;
        if (offer.maxDiscount) {
          discount = Math.min(discount, offer.maxDiscount);
        }
      }
      if (discount > offerDiscount) {
        offerDiscount = discount;
        appliedOffer = offer;
      }
    });
  }

  let couponDiscount = 0;
  if (couponCode) {
    if (couponCode === "WELCOME50") {
      couponDiscount = 50;
    } else if (couponCode === "FREEDLV") {
      couponDiscount = deliveryFee;
    }
  }

  const taxableAmount = cartTotal - offerDiscount;
  const taxAmount = (taxableAmount * taxRate) / 100;
  const surgeFee = isSurge ? surgeFeeAmount : 0;

  const finalAmountBeforeRevenueShare = taxableAmount + deliveryFee + tipAmount + taxAmount + surgeFee - couponDiscount;

  let revenueShareAmount = 0;
  if (revenueShare.type === 'percentage') {
    revenueShareAmount = (finalAmountBeforeRevenueShare * revenueShare.value) / 100;
  } else if (revenueShare.type === 'fixed') {
    revenueShareAmount = revenueShare.value;
  }

  return {
    cartTotal,
    deliveryFee,
    tipAmount,
    taxAmount,
    surgeFee,
    offerDiscount,
    couponDiscount,
    offersApplied: appliedOffer ? [appliedOffer.title] : [],
    finalAmount: finalAmountBeforeRevenueShare,
    revenueShareAmount,
    isSurge,
    surgeReason
  };
};
