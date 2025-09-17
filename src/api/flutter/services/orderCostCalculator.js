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
  isSurge = false,
  surgeFeeAmount = 0,
  surgeReason = null,
  merchantId,
  userId,
  PromoCode,
  TaxAndCharge,
  useLoyaltyPoints = false,
  loyaltyPointsAvailable = 0,
  loyaltySettings = null,
  loyaltyPointsToRedeem = null
}) => {
  // Calculate original cart total before any discounts
  const originalCartTotal = cartProducts.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Create a deep copy of cart products and create a lookup map
  let cartCopy = JSON.parse(JSON.stringify(cartProducts));
  const productMap = new Map();
  cartCopy.forEach(item => {
    productMap.set(item.productId.toString(), item);
  });

  let cartTotal = 0;
  let appliedCombos = [];
  let appliedOffers = []; // This will store offers in the requested format
  let comboDiscount = 0;

  // Process combo offers first
  const comboOffers = offers.filter(o => o.type === "combo" && o.comboProducts?.length);
  
  for (const offer of comboOffers) {
    for (const combo of offer.comboProducts) {
      let matchCount = Infinity;
      const comboItems = [];

      // Check if all products in the combo are available
      for (const comboItem of combo.products) {
        const productId = comboItem.product.toString();
        const cartItem = productMap.get(productId);
        
        if (!cartItem || cartItem.quantity < comboItem.quantity) {
          matchCount = 0;
          break;
        }
        
        comboItems.push({ cartItem, comboItem });
        matchCount = Math.min(matchCount, Math.floor(cartItem.quantity / comboItem.quantity));
      }

      if (matchCount > 0) {
        // Calculate actual price of the combo items
        let actualPrice = 0;
        
        for (const { cartItem, comboItem } of comboItems) {
          actualPrice += cartItem.price * comboItem.quantity * matchCount;
          cartItem.quantity -= comboItem.quantity * matchCount;
        }

        const comboPriceTotal = combo.comboPrice * matchCount;
        const comboDiscountAmount = actualPrice - comboPriceTotal;
        comboDiscount += comboDiscountAmount;
        cartTotal += comboPriceTotal;

        // Add to applied offers array in the requested format
        appliedOffers.push({
          type: "combo",
          offerId: offer._id.toString(),
          title: combo.name || offer.title,
          appliedOn: combo.products.map(p => ({
            productId: p.product.toString(),
            name: p.name || "Product"
          })),
          amount: parseFloat(comboDiscountAmount.toFixed(2))
        });

        appliedCombos.push({
          title: combo.name || offer.title,
          times: matchCount,
          saved: comboDiscountAmount,
        });
      }
    }
  }

  // Add remaining products (not part of combos)
  for (const item of cartCopy) {
    if (item.quantity > 0) {
      cartTotal += item.price * item.quantity;
    }
  }

  // Process Flat/Percentage Offers (excluding combo items)
  let offerDiscount = 0;
  const regularOffers = offers.filter(o => o.type === "flat" || o.type === "percentage");
  
  for (const offer of regularOffers) {
    let discount = 0;
    let applicableItems = [];
    let appliedOn = [];
    
    // Check eligibility (you might want to add more eligibility checks here)
    if (cartTotal < offer.minOrderValue) continue;

    if (offer.applicableLevel === "Product") {
      // Filter out combo items from product-level offers
      applicableItems = cartCopy.filter(cp => 
        cp.quantity > 0 && 
        offer.applicableProducts?.some(p => p.toString() === cp.productId.toString())
      );
      
      if (!applicableItems.length) continue;
      
      const matchedTotal = applicableItems.reduce((sum, p) => sum + p.price * p.quantity, 0);
      if (matchedTotal < offer.minOrderValue) continue;
      
      // Create appliedOn array for product-level offers
      appliedOn = applicableItems.map(item => ({
        productId: item.productId,
        name: item.name || "Product"
      }));
    } else {
      // For order-level offers
      appliedOn = ["cart"]; // Indicate this applies to the entire cart
    }
    
    // Calculate discount based on offer type
    if (offer.type === "flat") {
      discount = offer.discountValue;
    } else if (offer.type === "percentage") {
      const baseAmount = offer.applicableLevel === "Product" ? 
        applicableItems.reduce((sum, p) => sum + p.price * p.quantity, 0) : 
        cartTotal;
      
      discount = (baseAmount * offer.discountValue) / 100;
      if (offer.maxDiscount) {
        discount = Math.min(discount, offer.maxDiscount);
      }
    }
    
    // Add to applied offers array
    appliedOffers.push({
      type: offer.applicableLevel === "Product" ? "product" : "restaurant",
      offerId: offer._id.toString(),
      title: offer.title,
      appliedOn: appliedOn,
      amount: parseFloat(discount.toFixed(2))
    });
    
    offerDiscount += discount;
  }

  // Promo and Coupon Code Validation (merged logic)
  let promoDiscount = 0;
  let couponDiscount = 0;
  let promoCodeMessages = [];
  let isPromoApplied = false;
  let validatedPromo = null;
  let couponApplied = null;

  // Process promo code if provided
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
        } else if (originalCartTotal < promo.minOrderValue) {
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
            promoDiscount = Math.min(promo.discountValue, originalCartTotal);
          } else {
            promoDiscount = (originalCartTotal * promo.discountValue) / 100;
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

  // Process coupon code if provided (and no promo code applied)
  if (couponCode && !isPromoApplied) {
    const couponMap = {
      "WELCOME50": { discount: 50, message: "Welcome coupon applied", name: "WELCOME50" },
      "FREEDLV": { discount: deliveryFee, message: "Free delivery coupon applied", name: "FREEDLV" }
    };
    
    const coupon = couponMap[couponCode.toUpperCase()];
    if (coupon) {
      couponDiscount = coupon.discount;
      couponApplied = couponCode.toUpperCase();
      promoCodeMessages.push(coupon.message);
    } else {
      promoCodeMessages.push("Invalid coupon code");
    }
  }

  // Calculate taxable amount based on cartTotal
  const taxableAmount = cartTotal - offerDiscount - (isPromoApplied ? promoDiscount : 0) - couponDiscount;

  // Charges Breakdown
  let taxBreakdown = [];
  let totalTaxAmount = 0;
  let packingCharges = { marketplace: [], merchant: [] };
  let totalPackingCharge = 0;
  let additionalCharges = { marketplace: [], merchant: [] };
  let totalAdditionalCharges = 0;

  if (TaxAndCharge) {
    const query = {
      status: true,
      $or: [
        { level: "Marketplace" },
        { level: "Merchant", merchant: merchantId },
      ],
    };

    // Fetch all charges in a single query for better performance
    const allCharges = await TaxAndCharge.find(query);
    
    const taxes = allCharges.filter(c => c.category === "Tax");
    const additions = allCharges.filter(c => c.category === "AdditionalCharge");
    const packingList = allCharges.filter(c => c.category === "PackingCharge");

    // Process taxes
    for (const tax of taxes) {
      let baseAmount = 0;
      switch (tax.applicableOn) {
        case "All Orders":
        case "Food Items":
          baseAmount = taxableAmount;
          break;
        case "Delivery Fee":
          baseAmount = deliveryFee;
          break;
        default:
          continue;
      }

      const amount = tax.type === "Percentage" 
        ? (baseAmount * tax.value) / 100 
        : tax.value;

      totalTaxAmount += amount;
      taxBreakdown.push({
        name: tax.name,
        level: tax.level,
        type: tax.type,
        rate: tax.type === "Percentage" ? `${tax.value.toFixed(2)}%` : `₹${tax.value.toFixed(2)}`,
        amount: parseFloat(amount.toFixed(2)),
      });
    }

    // Process additional charges
    for (const charge of additions) {
      const baseAmount = taxableAmount;
      const amount = charge.type === "Percentage"
        ? (baseAmount * charge.value) / 100
        : charge.value;

      totalAdditionalCharges += amount;
      const chargeData = {
        name: charge.name,
        level: charge.level,
        type: charge.type,
        rate: charge.type === "Percentage" ? `${charge.value.toFixed(2)}%` : `₹${charge.value.toFixed(2)}`,
        amount: parseFloat(amount.toFixed(2)),
      };

      if (charge.level === "Marketplace") {
        additionalCharges.marketplace.push(chargeData);
      } else {
        additionalCharges.merchant.push(chargeData);
      }
    }

    // Process packing charges
    for (const charge of packingList) {
      const baseAmount = taxableAmount;
      const amount = charge.type === "Percentage"
        ? (baseAmount * charge.value) / 100
        : charge.value;

      totalPackingCharge += amount;
      const chargeData = {
        name: charge.name,
        level: charge.level,
        type: charge.type,
        rate: charge.type === "Percentage" ? `${charge.value.toFixed(2)}%` : `₹${charge.value.toFixed(2)}`,
        amount: parseFloat(amount.toFixed(2)),
        description: charge.description || "Packing Charge",
      };

      if (charge.level === "Marketplace") {
        packingCharges.marketplace.push(chargeData);
      } else {
        packingCharges.merchant.push(chargeData);
      }
    }
  }

  const surgeFee = isSurge ? surgeFeeAmount : 0;

  // Final Amount Before Revenue Share and Loyalty
  const finalAmountBeforeRevenueShare =
    taxableAmount +
    deliveryFee +
    tipAmount +
    totalTaxAmount +
    totalPackingCharge +
    totalAdditionalCharges +
    surgeFee;

  // Loyalty Points Handling
  let loyaltyDiscount = 0;
  let pointsUsed = 0;
  let loyaltyMessages = [];
  let potentialPointsEarned = 0;

  // Calculate base amount for loyalty calculations
  const baseAmountForLoyalty = cartTotal - offerDiscount - (isPromoApplied ? promoDiscount : 0) - couponDiscount;

  if (useLoyaltyPoints && loyaltySettings) {
    if (loyaltyPointsAvailable <= 0) {
      loyaltyMessages.push("You don't have any points to redeem");
    } else if (baseAmountForLoyalty < loyaltySettings.minOrderAmountForRedemption) {
      loyaltyMessages.push(
        `Minimum order amount of ₹${loyaltySettings.minOrderAmountForRedemption} required to redeem points`
      );
    } else {
      // Calculate maximum allowed redemption
      const maxRedemptionAmount = Math.min(
        (baseAmountForLoyalty * loyaltySettings.maxRedemptionPercent) / 100,
        baseAmountForLoyalty
      );
      
      const maxPointsCanUse = Math.floor(maxRedemptionAmount / loyaltySettings.valuePerPoint);

      // Determine points to use
      if (loyaltyPointsToRedeem !== null && loyaltyPointsToRedeem > 0) {
        pointsUsed = Math.min(loyaltyPointsToRedeem, loyaltyPointsAvailable, maxPointsCanUse);
      } else {
        pointsUsed = Math.min(loyaltyPointsAvailable, maxPointsCanUse);
      }

      // Apply minimum points requirement
      if (pointsUsed > 0 && pointsUsed < loyaltySettings.minPointsForRedemption) {
        loyaltyMessages.push(
          `Minimum ${loyaltySettings.minPointsForRedemption} points required for redemption`
        );
        pointsUsed = 0;
      }

      if (pointsUsed > 0) {
        loyaltyDiscount = pointsUsed * loyaltySettings.valuePerPoint;
        loyaltyMessages.push(
          `Redeemed ${pointsUsed} points (₹${loyaltyDiscount.toFixed(2)} discount)`
        );
      }
    }
  }

  // Calculate potential points to earn
  if (loyaltySettings) {
    if (baseAmountForLoyalty >= loyaltySettings.minOrderAmountForEarning) {
      potentialPointsEarned = Math.min(
        Math.floor((baseAmountForLoyalty / 100) * loyaltySettings.pointsPerAmount),
        loyaltySettings.maxEarningPoints
      );
      if (potentialPointsEarned > 0) {
        loyaltyMessages.push(
          `Earn ${potentialPointsEarned} points after successful delivery (${loyaltySettings.pointsPerAmount} pts per ₹100)`
        );
      }
    } else if (useLoyaltyPoints) {
      loyaltyMessages.push(
        `Add ₹${(loyaltySettings.minOrderAmountForEarning - baseAmountForLoyalty).toFixed(2)} more to earn loyalty points`
      );
    }
  }

  // Final Amount After Loyalty Redemption
  const finalAmountAfterLoyalty = finalAmountBeforeRevenueShare - loyaltyDiscount;

  // Revenue Share
  let revenueShareAmount = 0;
  if (revenueShare.type === "percentage") {
    revenueShareAmount = (finalAmountAfterLoyalty * revenueShare.value) / 100;
  } else if (revenueShare.type === "fixed") {
    revenueShareAmount = revenueShare.value;
  }

  // Final Response
  return {
    originalCartTotal: parseFloat(originalCartTotal.toFixed(2)),
    cartTotal: parseFloat(cartTotal.toFixed(2)),
    deliveryFee: parseFloat(deliveryFee.toFixed(2)),
    tipAmount: parseFloat(tipAmount.toFixed(2)),
    comboDiscount: parseFloat(comboDiscount.toFixed(2)),
    offerDiscount: parseFloat(offerDiscount.toFixed(2)),
    couponDiscount: parseFloat(couponDiscount.toFixed(2)),
    loyaltyDiscount: parseFloat(loyaltyDiscount.toFixed(2)),
    promoDiscount: parseFloat(promoDiscount.toFixed(2)),
    totalDiscount: parseFloat((
      comboDiscount + 
      offerDiscount + 
      promoDiscount + 
      couponDiscount + 
      loyaltyDiscount
    ).toFixed(2)),
    offersApplied: appliedOffers, // This now has the requested format
    combosApplied: appliedCombos,
    promoCodeInfo: {
      code: validatedPromo?.code || couponApplied || null,
      promoCodeId: validatedPromo?._id?.toString() || null,
      applied: isPromoApplied || Boolean(couponApplied),
      messages: promoCodeMessages,
      discount: promoDiscount + couponDiscount
    },
    taxableAmount: parseFloat(taxableAmount.toFixed(2)),
    taxBreakdown,
    totalTaxAmount: parseFloat(totalTaxAmount.toFixed(2)),
    packingCharges,
    totalPackingCharge: parseFloat(totalPackingCharge.toFixed(2)),
    additionalCharges,
    totalAdditionalCharges: parseFloat(totalAdditionalCharges.toFixed(2)),
    surgeFee: parseFloat(surgeFee.toFixed(2)),
    isSurge,
    surgeReason,
    finalAmount: parseFloat(finalAmountAfterLoyalty.toFixed(2)),
    revenueShareAmount: parseFloat(revenueShareAmount.toFixed(2)),
    loyaltyPoints: {
      used: pointsUsed,
      potentialEarned: potentialPointsEarned,
      discount: parseFloat(loyaltyDiscount.toFixed(2)),
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