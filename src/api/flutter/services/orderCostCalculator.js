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











// exports.calculateOrderCostV2 = ({
//   cartProducts,
//   tipAmount = 0,
//   couponCode,
//   deliveryFee = 0,
//   offers = [],
//   revenueShare = { type: 'percentage', value: 20 },
//   taxes = [],  // ✅ now an array of tax objects
//   isSurge = false,
//   surgeFeeAmount = 0,
//   surgeReason = null
// }) => {
//   let cartTotal = 0;
//   cartProducts.forEach(item => {
//     cartTotal += item.price * item.quantity;
//   });

//   // Offers
//   let offerDiscount = 0;
//   let appliedOffer = null;
//   if (offers.length) {
//     offers.forEach(offer => {
//       let discount = 0;
//       if (offer.type === "flat") {
//         discount = offer.discountValue;
//       } else if (offer.type === "percentage") {
//         discount = (cartTotal * offer.discountValue) / 100;
//         if (offer.maxDiscount) {
//           discount = Math.min(discount, offer.maxDiscount);
//         }
//       }
//       if (discount > offerDiscount) {
//         offerDiscount = discount;
//         appliedOffer = offer;
//       }
//     });
//   }

//   // Coupons
//   let couponDiscount = 0;
//   if (couponCode) {
//     if (couponCode === "WELCOME50") {
//       couponDiscount = 50;
//     } else if (couponCode === "FREEDLV") {
//       couponDiscount = deliveryFee;
//     }
//   }

//   const taxableAmount = cartTotal - offerDiscount;

//   // ✅ Multiple Tax calculation
//   const taxBreakdown = taxes.map(tax => {
//     const amount = (taxableAmount * tax.percentage) / 100;
//     return {
//       name: tax.name,
//       percentage: tax.percentage,
//       amount
//     };
//   });

//   const totalTaxAmount = taxBreakdown.reduce((sum, t) => sum + t.amount, 0);

//   const surgeFee = isSurge ? surgeFeeAmount : 0;

//   const finalAmountBeforeRevenueShare = taxableAmount + deliveryFee + tipAmount + totalTaxAmount + surgeFee - couponDiscount;

//   let revenueShareAmount = 0;
//   if (revenueShare.type === 'percentage') {
//     revenueShareAmount = (finalAmountBeforeRevenueShare * revenueShare.value) / 100;
//   } else if (revenueShare.type === 'fixed') {
//     revenueShareAmount = revenueShare.value;
//   }

//   return {
//     cartTotal,
//     deliveryFee,
//     tipAmount,
//     taxBreakdown,     // detailed taxes
//     totalTaxAmount,   // total tax
//     surgeFee,
//     offerDiscount,
//     couponDiscount,
//     offersApplied: appliedOffer ? [appliedOffer.title] : [],
//     finalAmount: finalAmountBeforeRevenueShare,
//     revenueShareAmount,
//     isSurge,
//     surgeReason,
//     appliedOffer
//   };
// };

exports.calculateOrderCostV2 = async ({
  cartProducts,
  tipAmount = 0,
  couponCode,
  promoCode,
  deliveryFee = 0,
  offers = [],
  revenueShare = { type: 'percentage', value: 20 },
  taxes = [],
  isSurge = false,
  surgeFeeAmount = 0,
  surgeReason = null,
  merchantId,
  userId,
  PromoCode,
  // Loyalty settings parameters
  useLoyaltyPoints = false,
  loyaltyPointsAvailable = 0,
  loyaltySettings = null,
  loyaltyPointsToRedeem = null
}) => {
  let cartTotal = 0;
  cartProducts.forEach(item => {
    cartTotal += item.price * item.quantity;
  });

  // Promo Code Validation
  let promoDiscount = 0;
  let promoCodeMessages = [];
  let isPromoApplied = false;
  let validatedPromo = null;

  if (promoCode && PromoCode) {
    try {
      const promo = await PromoCode.findOne({
        code: promoCode.toUpperCase(),
        isActive: true
      });

      if (promo) {
        const now = new Date();
        validatedPromo = promo;

        if (now < promo.validFrom) {
          promoCodeMessages.push("This promo code is not yet valid");
        } else if (now > promo.validTill) {
          promoCodeMessages.push("This promo code has expired");
        } else if (cartTotal < promo.minOrderValue) {
          promoCodeMessages.push(`Minimum order value of ₹${promo.minOrderValue} required`);
        } else if (promo.isMerchantSpecific && !promo.applicableMerchants.includes(merchantId)) {
          promoCodeMessages.push("This promo code is not valid for this merchant");
        } else if (promo.isCustomerSpecific && userId && !promo.applicableCustomers.includes(userId)) {
          promoCodeMessages.push("This promo code is not valid for your account");
        } else if (userId && promo.maxUsagePerCustomer > 0 && 
                  promo.customersUsed.filter(id => id.equals(userId)).length >= promo.maxUsagePerCustomer) {
          promoCodeMessages.push("You've reached maximum usage limit for this promo");
        } else {
          if (promo.discountType === "fixed") {
            promoDiscount = Math.min(promo.discountValue, cartTotal);
          } else {
            promoDiscount = (cartTotal * promo.discountValue) / 100;
          }
          isPromoApplied = true;
          promoCodeMessages.push(`Promo code applied: ${promo.code}`);
        }
      } else {
        promoCodeMessages.push("Invalid promo code");
      }
    } catch (error) {
      console.error("Error validating promo code:", error);
      promoCodeMessages.push("Error validating promo code");
    }
  }

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

  // Calculate taxable amount
  const taxableAmount = cartTotal - offerDiscount - (isPromoApplied ? promoDiscount : 0);

  // Multiple Tax calculation
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

  const finalAmountBeforeRevenueShare = taxableAmount + 
                                      deliveryFee + 
                                      tipAmount + 
                                      totalTaxAmount + 
                                      surgeFee - 
                                      couponDiscount;

  // Loyalty Points Handling
  let loyaltyDiscount = 0;
  let pointsUsed = 0;
  let loyaltyMessages = [];
  let potentialPointsEarned = 0;

  if (useLoyaltyPoints && loyaltySettings) {
    if (loyaltyPointsAvailable <= 0) {
      loyaltyMessages.push("You don't have any points to redeem");
    } else if (finalAmountBeforeRevenueShare < loyaltySettings.minOrderAmountForRedemption) {
      loyaltyMessages.push(
        `Minimum order amount of ₹${loyaltySettings.minOrderAmountForRedemption} required to redeem points`
      );
    } else {
      // Calculate maximum allowed redemption
      const maxRedemptionAmount = 
        (finalAmountBeforeRevenueShare * loyaltySettings.maxRedemptionPercent) / 100;
      const maxPointsCanUse = Math.floor(
        maxRedemptionAmount / loyaltySettings.valuePerPoint
      );

      // If user specified an amount, use it (within limits)
      if (loyaltyPointsToRedeem !== null && loyaltyPointsToRedeem > 0) {
        pointsUsed = Math.min(
          loyaltyPointsToRedeem,
          loyaltyPointsAvailable,
          maxPointsCanUse
        );

        // Ensure minimum points requirement is met
        if (pointsUsed < loyaltySettings.minPointsForRedemption) {
          pointsUsed = 0;
          loyaltyMessages.push(
            `Minimum ${loyaltySettings.minPointsForRedemption} points required for redemption`
          );
        }
      } else {
        // Auto-apply maximum if user didn't specify
        pointsUsed = Math.min(
          loyaltyPointsAvailable,
          maxPointsCanUse,
          Math.max(loyaltySettings.minPointsForRedemption, 0)
        );
      }

      if (pointsUsed > 0) {
        loyaltyDiscount = pointsUsed * loyaltySettings.valuePerPoint;
        loyaltyMessages.push(
          `Redeemed ${pointsUsed} points (₹${loyaltyDiscount} discount)`
        );
      }
    }
  }

  // Calculate potential points to earn
  if (loyaltySettings) {
    if (finalAmountBeforeRevenueShare >= loyaltySettings.minOrderAmountForEarning) {
      potentialPointsEarned = Math.min(
        Math.floor(
          (finalAmountBeforeRevenueShare / 100) * loyaltySettings.pointsPerAmount
        ),
        loyaltySettings.maxEarningPoints
      );
      if (potentialPointsEarned > 0) {
        loyaltyMessages.push(
          `Earn ${potentialPointsEarned} points after successful delivery (${loyaltySettings.pointsPerAmount} pts per ₹100)`
        );
      }
    } else {
      loyaltyMessages.push(
        `Add ₹${
          loyaltySettings.minOrderAmountForEarning - finalAmountBeforeRevenueShare
        } more to earn loyalty points`
      );
    }
  }

  // Final Amount After Loyalty Redemption
  const finalAmountAfterLoyalty = finalAmountBeforeRevenueShare - loyaltyDiscount;

  // Revenue Share
  let revenueShareAmount = 0;
  if (revenueShare.type === 'percentage') {
    revenueShareAmount = (finalAmountAfterLoyalty * revenueShare.value) / 100;
  } else if (revenueShare.type === 'fixed') {
    revenueShareAmount = revenueShare.value;
  }

  return {
    cartTotal,
    deliveryFee,
    tipAmount,
    taxBreakdown,
    totalTaxAmount,
    surgeFee,
    offerDiscount,
    couponDiscount,
    promoCodeInfo: {
      code: validatedPromo?.code || null,
      applied: isPromoApplied,
      messages: promoCodeMessages,
      discount: promoDiscount
    },
    offersApplied: appliedOffer ? [appliedOffer.title] : [],
    finalAmount: finalAmountAfterLoyalty,
    revenueShareAmount,
    isSurge,
    surgeReason,
    appliedOffer,
    totalDiscount: offerDiscount + couponDiscount + promoDiscount + loyaltyDiscount,
    loyaltyPoints: {
      used: pointsUsed,
      potentialEarned: potentialPointsEarned,
      discount: loyaltyDiscount,
      messages: loyaltyMessages,
      redemptionInfo: {
        minOrderAmount: loyaltySettings?.minOrderAmountForRedemption || 0,
        minPoints: loyaltySettings?.minPointsForRedemption || 0,
        maxPercent: loyaltySettings?.maxRedemptionPercent || 0,
        valuePerPoint: loyaltySettings?.valuePerPoint || 0,
      },
      earningInfo: {
        minOrderAmount: loyaltySettings?.minOrderAmountForEarning || 0,
        pointsPerAmount: loyaltySettings?.pointsPerAmount || 0,
        maxPoints: loyaltySettings?.maxEarningPoints || 0,
      },
    }
  };
};