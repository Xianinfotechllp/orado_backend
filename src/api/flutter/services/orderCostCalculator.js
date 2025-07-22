const { haversineDistance } = require("../utils/distanceCalculator");
const { deliveryFeeCalculator } = require("../utils/deliveryFeeCalculator");
const TAX_PERCENTAGE = 5;

const roundPrice = (num) => Math.round(num); // no decimals now

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
  subtotal = roundPrice(subtotal);

  // Distance Calculation
  const restaurantCoords = restaurant.location.coordinates;
  const distanceKm = haversineDistance(restaurantCoords, userCoords); // keep float for distance if you want km accuracy

  // Delivery Fee
  let deliveryFee = deliveryFeeCalculator({
    distanceKm,
    orderAmount: subtotal,
  });
  deliveryFee = roundPrice(deliveryFee);

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
  discount = roundPrice(discount);

  // Tax
  const taxableAmount = Math.max(subtotal - discount, 0);
  const tax = roundPrice((taxableAmount * TAX_PERCENTAGE) / 100);

  // Final total
  const total = roundPrice(taxableAmount + tax + deliveryFee);

  return {
    subtotal,
    discount,
    tax,
    deliveryFee,
    total,
    distanceKm: Math.round(distanceKm * 100) / 100, // keep 2 decimals for distance if needed
  };
};











exports.calculateOrderCostV2 = ({
  cartProducts,
  tipAmount = 0,
  couponCode,
  deliveryFee = 0,
  offers = [],
  revenueShare = { type: 'percentage', value: 20 },
  taxes = [],  // ✅ now an array of tax objects
  isSurge = false,
  surgeFeeAmount = 0,
  surgeReason = null
}) => {
  let cartTotal = 0;
  cartProducts.forEach(item => {
    cartTotal += item.price * item.quantity;
  });

  // Offers
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

  // Coupons
  let couponDiscount = 0;
  if (couponCode) {
    if (couponCode === "WELCOME50") {
      couponDiscount = 50;
    } else if (couponCode === "FREEDLV") {
      couponDiscount = deliveryFee;
    }
  }

  const taxableAmount = cartTotal - offerDiscount;

  // ✅ Multiple Tax calculation
  const taxBreakdown = taxes.map(tax => {
    const amount = (taxableAmount * tax.percentage) / 100;
    return {
      name: tax.name,
      percentage: tax.percentage,
      amount
    };
  });

  const totalTaxAmount = taxBreakdown.reduce((sum, t) => sum + t.amount, 0);

  const surgeFee = isSurge ? surgeFeeAmount : 0;

  const finalAmountBeforeRevenueShare = taxableAmount + deliveryFee + tipAmount + totalTaxAmount + surgeFee - couponDiscount;

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
    taxBreakdown,     // detailed taxes
    totalTaxAmount,   // total tax
    surgeFee,
    offerDiscount,
    couponDiscount,
    offersApplied: appliedOffer ? [appliedOffer.title] : [],
    finalAmount: finalAmountBeforeRevenueShare,
    revenueShareAmount,
    isSurge,
    surgeReason,
    appliedOffer
  };
};

