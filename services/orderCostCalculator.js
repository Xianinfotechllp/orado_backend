const { haversineDistance } = require("../utils/distanceCalculator");
const {
  deliveryFeeCalculator,
  deliveryFeeCalculator2,
} = require("../utils/deliveryFeeCalculator");
const TAX_PERCENTAGE = 5;
const Offer = require("../models/offerModel");
const TaxAndCharge = require("../models/taxAndChargeModel");

exports.calculateOrderCost = ({
  cartProducts,
  restaurant,
  userCoords,
  couponCode,
  useWallet = false,
  walletBalance = 0,
}) => {
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
      throw new Error(
        `Each cart item must have price and quantity (check item at index ${index})`
      );
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
    payable,
  };
};

exports.calculateOrderCost2 = ({
  cartProducts,
  tipAmount = 0,
  couponCode,
  restaurantCoords,
  userCoords,
  revenueShare = { type: "percentage", value: 10 }, // default if not provided
}) => {
  let cartTotal = 0;
  cartProducts.forEach((item) => {
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
  const finalAmountBeforeRevenueShare =
    cartTotal + deliveryFee + tipAmount - discount;

  // Calculate revenue share
  let revenueShareAmount = 0;
  if (revenueShare.type === "percentage") {
    revenueShareAmount =
      (finalAmountBeforeRevenueShare * revenueShare.value) / 100;
  } else if (revenueShare.type === "fixed") {
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
    finalAmount,
  };
};

exports.calculateOrderCostWithOffer = async ({
  cartProducts,
  tipAmount = 0,
  couponCode,
  restaurantId,
  restaurantCoords,
  userCoords,
  revenueShare = { type: "percentage", value: 10 },
}) => {
  let cartTotal = 0;
  cartProducts.forEach((item) => {
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
    minOrderValue: { $lte: cartTotal },
  });

  if (activeOffers.length) {
    // Apply best discount — you can change this logic if needed
    activeOffers.forEach((offer) => {
      let discount = 0;
      if (offer.type === "flat") {
        discount = offer.discountValue;
      } else if (offer.type === "percentage") {
        discount = (cartTotal * offer.discountValue) / 100;
        if (offer.maxDiscount) discount = Math.min(discount, offer.maxDiscount);
      }
      if (discount > offerDiscount) offerDiscount = discount;
    });
  }

  // 4️⃣ Final Amount Before Revenue Share
  const finalAmountBeforeRevenueShare =
    cartTotal + deliveryFee + tipAmount - couponDiscount - offerDiscount;

  // 5️⃣ Revenue Share Calculation
  let revenueShareAmount = 0;
  if (revenueShare.type === "percentage") {
    revenueShareAmount =
      (finalAmountBeforeRevenueShare * revenueShare.value) / 100;
  } else if (revenueShare.type === "fixed") {
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
    finalAmount,
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

async function calculateChargesBreakdown({
  subtotal,
  deliveryFee,
  merchantId,
}) {
  const query = {
    status: true,
    $or: [
      { level: "Marketplace" },
      { level: "Merchant", merchant: merchantId },
    ],
  };

  // === FETCH TAXES, ADDITIONAL CHARGES, PACKING CHARGES ===
  const [taxes, additions, packingList] = await Promise.all([
    TaxAndCharge.find({ ...query, category: "Tax" }),
    TaxAndCharge.find({ ...query, category: "AdditionalCharge" }),
    TaxAndCharge.find({ ...query, category: "PackingCharge" }),
  ]);

  // === TAXES ===
  const taxBreakdown = [];
  let totalTax = 0;

  for (const tax of taxes) {
    let baseAmount = 0;
    switch (tax.applicableOn) {
      case "All Orders":
      case "Food Items":
        baseAmount = subtotal;
        break;
      case "Delivery Fee":
        baseAmount = deliveryFee;
        break;
      default:
        continue;
    }

    const amount =
      tax.type === "Percentage" ? (baseAmount * tax.value) / 100 : tax.value;

    totalTax += amount;

    taxBreakdown.push({
      name: tax.name,
      level: tax.level,
      type: tax.type,
      rate:
        tax.type === "Percentage"
          ? `${tax.value.toFixed(2)}%`
          : `${tax.value.toFixed(2)}`,
      amount: parseFloat(amount.toFixed(2)),
    });
  }

  // === ADDITIONAL CHARGES ===
  const additionalCharges = {
    marketplace: [],
    merchant: [],
  };
  let totalAdditionalCharges = 0;

  for (const charge of additions) {
    const baseAmount = subtotal;
    const amount =
      charge.type === "Percentage"
        ? (baseAmount * charge.value) / 100
        : charge.value;

    totalAdditionalCharges += amount;

    const chargeData = {
      name: charge.name,
      level: charge.level,
      type: charge.type,
      rate:
        charge.type === "Percentage"
          ? `${charge.value.toFixed(2)}%`
          : `${charge.value.toFixed(2)}`,
      amount: parseFloat(amount.toFixed(2)),
    };

    if (charge.level === "Marketplace") {
      additionalCharges.marketplace.push(chargeData);
    } else {
      additionalCharges.merchant.push(chargeData);
    }
  }

  // === PACKING CHARGES ===
  const packingCharges = {
    marketplace: [],
    merchant: [],
  };
  let totalPackingCharge = 0;

  for (const charge of packingList) {
    const baseAmount = subtotal;
    const amount =
      charge.type === "Percentage"
        ? (baseAmount * charge.value) / 100
        : charge.value;

    totalPackingCharge += amount;

    const chargeData = {
      name: charge.name,
      level: charge.level,
      type: charge.type,
      rate:
        charge.type === "Percentage"
          ? `${charge.value.toFixed(2)}%`
          : `${charge.value.toFixed(2)}`,
      amount: parseFloat(amount.toFixed(2)),
      description: charge.description || "Packing Charge",
    };

    if (charge.level === "Marketplace") {
      packingCharges.marketplace.push(chargeData);
    } else {
      packingCharges.merchant.push(chargeData);
    }
  }

  // === RETURN FINAL BREAKDOWN ===
  return {
    taxBreakdown,
    totalTaxAmount: parseFloat(totalTax.toFixed(2)),

    additionalCharges,
    totalAdditionalCharges: parseFloat(totalAdditionalCharges.toFixed(2)),

    packingCharges,
    totalPackingCharge: parseFloat(totalPackingCharge.toFixed(2)),
  };
}

// ✅ Now async version of calculateOrderCostV2
// ✅ Async version of calculateOrderCostV2
  exports. calculateOrderCostV2 = async ({
    cartProducts,
    tipAmount = 0,
    promoCode, // The promo code string entered by user
    deliveryFee = 0,
    offers = [],
    revenueShare = { type: "percentage", value: 20 },
    isSurge = false,
    surgeFeeAmount = 0,
    surgeReason = null,
    merchantId,
    cartId,
    useLoyaltyPoints = false,
    loyaltyPointsAvailable = 0,
    loyaltySettings = null,
    loyaltyPointsToRedeem = null,
    userId = null, // Needed for promo code validation
    PromoCode, // Pass your Mongoose model as parameter
  }) => {
    let cartTotal = 0;
    let appliedCombos = [];

    // Clone cartProducts to modify quantities during combo processing
    let cartCopy = JSON.parse(JSON.stringify(cartProducts));

    // ✅ Handle Combo Offers
    let comboDiscount = 0;
    const comboOffers = offers.filter(
      (o) => o.type === "combo" && o.comboProducts?.length
    );

    comboOffers.forEach((offer) => {
      offer.comboProducts.forEach((combo) => {
        let matchCount = Infinity;

        combo.products.forEach((comboItem) => {
          const cartItem = cartCopy.find(
            (ci) => ci.productId.toString() === comboItem.product.toString()
          );
          if (!cartItem || cartItem.quantity < comboItem.quantity) {
            matchCount = 0;
          } else {
            matchCount = Math.min(
              matchCount,
              Math.floor(cartItem.quantity / comboItem.quantity)
            );
          }
        });

        if (matchCount > 0) {
          // Calculate actual price of the combo items
          let actualPrice = 0;
          combo.products.forEach((ci) => {
            const cartItem = cartCopy.find(
              (item) => item.productId.toString() === ci.product.toString()
            );
            actualPrice += cartItem.price * ci.quantity * matchCount;
            cartItem.quantity -= ci.quantity * matchCount;
          });

          const comboPriceTotal = combo.comboPrice * matchCount;
          comboDiscount += actualPrice - comboPriceTotal;
          cartTotal += comboPriceTotal;

          appliedCombos.push({
            title: combo.name || offer.title,
            times: matchCount,
            saved: actualPrice - comboPriceTotal,
          });
        }
      });
    });

    // ✅ Add remaining products (not part of combos)
    cartCopy.forEach((item) => {
      if (item.quantity > 0) {
        cartTotal += item.price * item.quantity;
      }
    });


      let promoDiscount = 0;
    let promoCodeMessages = [];
    let isPromoApplied = false;
    let validatedPromo = null;

  if (promoCode && PromoCode) {
      try {
        // Find active promo code
        const promo = await PromoCode.findOne({
          code: promoCode.toUpperCase(),
          isActive: true
        });

        if (promo) {
          const now = new Date();
          validatedPromo = promo;

          // Validate promo code
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
            // All validations passed - apply discount
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
















    // ✅ Apply Flat / Percentage Offers
    let offerDiscount = 0;
    let appliedOffer = null;

    const regularOffers = offers.filter(
      (o) => o.type === "flat" || o.type === "percentage"
    );

    regularOffers.forEach((offer) => {
      let discount = 0;

      if (offer.applicableLevel === "Product") {
        const matchedProducts = cartProducts.filter((cp) =>
          offer.applicableProducts?.some(
            (p) => p.toString() === cp.productId.toString()
          )
        );

        if (!matchedProducts.length) return;

        const matchedTotal = matchedProducts.reduce(
          (sum, p) => sum + p.price * p.quantity,
          0
        );

        if (matchedTotal < offer.minOrderValue) return;

        if (offer.type === "flat") {
          discount = offer.discountValue;
        } else if (offer.type === "percentage") {
          discount = (matchedTotal * offer.discountValue) / 100;
          if (offer.maxDiscount) {
            discount = Math.min(discount, offer.maxDiscount);
          }
        }
      } else {
        if (cartTotal < offer.minOrderValue) return;

        if (offer.type === "flat") {
          discount = offer.discountValue;
        } else if (offer.type === "percentage") {
          discount = (cartTotal * offer.discountValue) / 100;
          if (offer.maxDiscount) {
            discount = Math.min(discount, offer.maxDiscount);
          }
        }
      }

      if (discount > offerDiscount) {
        offerDiscount = discount;
        appliedOffer = offer;
      }
    });




    // ✅ Calculate taxable amount
  const taxableAmount = cartTotal - offerDiscount - (isPromoApplied ? promoDiscount : 0);
    // ✅ Charges Breakdown
    const {
      totalTaxAmount,
      taxBreakdown,
      totalPackingCharge,
      packingCharges,
      totalAdditionalCharges,
      additionalCharges,
    } = await calculateChargesBreakdown({
      subtotal: taxableAmount,
      deliveryFee,
      merchantId,
    });

    // ✅ Surge Fee
    const surgeFee = isSurge ? surgeFeeAmount : 0;

    // ✅ Final Amount Before Revenue Share
    const finalAmountBeforeRevenueShare =
      taxableAmount +
      deliveryFee +
      tipAmount +
      totalTaxAmount +
      totalPackingCharge +
      totalAdditionalCharges +
      surgeFee -
      promoDiscount;

    // ✅ Loyalty Points Handling
    let loyaltyDiscount = 0;
    let pointsUsed = 0;
    let loyaltyMessages = [];
    let potentialPointsEarned = 0;
   
    if (useLoyaltyPoints) {
      if (!loyaltySettings) {
        loyaltyMessages.push("Loyalty program not available for this merchant");
      } else if (loyaltyPointsAvailable <= 0) {
        loyaltyMessages.push("You don't have any points to redeem");
      } else if (
        finalAmountBeforeRevenueShare <
        loyaltySettings.minOrderAmountForRedemption
      ) {
        loyaltyMessages.push(
          `Minimum order amount of ₹${loyaltySettings.minOrderAmountForRedemption} required to redeem points`
        );
      } else {
        // Calculate maximum allowed redemption
        const maxRedemptionAmount =
          (finalAmountBeforeRevenueShare * loyaltySettings.maxRedemptionPercent) /
          100;
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
      if (
        finalAmountBeforeRevenueShare >= loyaltySettings.minOrderAmountForEarning
      ) {
        potentialPointsEarned = Math.min(
          Math.floor(
            (finalAmountBeforeRevenueShare / 100) *
              loyaltySettings.pointsPerAmount
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
            loyaltySettings.minOrderAmountForEarning -
            finalAmountBeforeRevenueShare
          } more to earn loyalty points`
        );
      }
    }

    // ✅ Final Amount After Loyalty Redemption
    const finalAmountAfterLoyalty =
      finalAmountBeforeRevenueShare - loyaltyDiscount;

    // ✅ Revenue Share
    let revenueShareAmount = 0;
    if (revenueShare.type === "percentage") {
      revenueShareAmount = (finalAmountAfterLoyalty * revenueShare.value) / 100;
    } else if (revenueShare.type === "fixed") {
      revenueShareAmount = revenueShare.value;
    }

    // ✅ Final Response
    return {
      cartTotal,
      deliveryFee,
      tipAmount,
      comboDiscount,
      offerDiscount,

      loyaltyDiscount,
      totalDiscount:
        comboDiscount + offerDiscount + promoDiscount + loyaltyDiscount,
      offersApplied: appliedOffer ? [appliedOffer.title] : [],
      combosApplied: appliedCombos,
        promoCodeInfo: {
        code: validatedPromo?.code || null,
        applied: isPromoApplied,
        messages: promoCodeMessages,
        discount: promoDiscount
      },
      taxableAmount,
      taxBreakdown,
      totalTaxAmount,
      packingCharges,
      totalPackingCharge,
      additionalCharges,
      totalAdditionalCharges,
      surgeFee,
      isSurge,
      surgeReason,
      finalAmount: parseFloat(finalAmountAfterLoyalty.toFixed(2)),
      revenueShareAmount: parseFloat(revenueShareAmount.toFixed(2)),
      appliedOffer,
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
      },
    };
  };
