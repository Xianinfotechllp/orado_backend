const Product = require('../../../../models/productModel');
const Restaurant = require('../../../../models/restaurantModel');

const productService = {
  /**
   * Helper: Check if restaurant is open now based on openingHours
   * @param {Object} restaurant 
   * @returns {Object} { isOpen: Boolean, nextOpeningTime: Date|null }
   */
  isRestaurantOpenNow: (restaurant) => {
    if (!restaurant.openingHours || restaurant.openingHours.length === 0) {
      // Assume open if no hours set, or could treat as closed
      return { isOpen: true, nextOpeningTime: null };
    }

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(); // e.g. 'monday'
    const currentTime = now.toTimeString().slice(0, 5); // 'HH:mm' format

    // Find today's hours
    const todayHours = restaurant.openingHours.find(h => h.day === currentDay);

    if (!todayHours || todayHours.isClosed) {
      // Find next opening day/time after today
      const sortedDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const todayIndex = sortedDays.indexOf(currentDay);
      for(let i=1; i<=7; i++) {
        const nextDayIndex = (todayIndex + i) % 7;
        const nextDay = sortedDays[nextDayIndex];
        const nextDayHours = restaurant.openingHours.find(h => h.day === nextDay);
        if (nextDayHours && !nextDayHours.isClosed) {
          // Return next day opening time as a Date object
          const nextOpenDate = new Date(now);
          nextOpenDate.setDate(now.getDate() + i);
          const [h, m] = nextDayHours.openingTime.split(':');
          nextOpenDate.setHours(parseInt(h), parseInt(m), 0, 0);
          return { isOpen: false, nextOpeningTime: nextOpenDate };
        }
      }
      // No opening times found, treat closed
      return { isOpen: false, nextOpeningTime: null };
    }

    // Check if current time falls between opening and closing
    if (currentTime >= todayHours.openingTime && currentTime < todayHours.closingTime) {
      return { isOpen: true, nextOpeningTime: null };
    }

    // Otherwise closed now, calculate next opening time (could be today or next days)
    // If current time < openingTime, then next opening is today at openingTime
    if (currentTime < todayHours.openingTime) {
      const nextOpenDate = new Date(now);
      const [h, m] = todayHours.openingTime.split(':');
      nextOpenDate.setHours(parseInt(h), parseInt(m), 0, 0);
      return { isOpen: false, nextOpeningTime: nextOpenDate };
    }

    // If current time >= closingTime, find next opening day after today (like above)
    const sortedDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const todayIndex = sortedDays.indexOf(currentDay);
    for(let i=1; i<=7; i++) {
      const nextDayIndex = (todayIndex + i) % 7;
      const nextDay = sortedDays[nextDayIndex];
      const nextDayHours = restaurant.openingHours.find(h => h.day === nextDay);
      if (nextDayHours && !nextDayHours.isClosed) {
        const nextOpenDate = new Date(now);
        nextOpenDate.setDate(now.getDate() + i);
        const [h, m] = nextDayHours.openingTime.split(':');
        nextOpenDate.setHours(parseInt(h), parseInt(m), 0, 0);
        return { isOpen: false, nextOpeningTime: nextOpenDate };
      }
    }

    // Fallback closed with no next open found
    return { isOpen: false, nextOpeningTime: null };
  },

  /**
   * Check availability for a single product
   * @param {String} productId 
   * @returns {Promise<Object>}
   */
  checkProductAvailability: async (productId) => {
    try {
      const product = await Product.findById(productId)
        .populate('restaurantId', 'openingHours active autoOnOff');

      if (!product) {
        return productService._availabilityResponse(false, 'Product not found');
      }

      if (!product.active) {
        return productService._availabilityResponse(false, 'Product is currently unavailable');
      }

      const restaurant = product.restaurantId;

      if (!restaurant || !restaurant.active) {
        return productService._availabilityResponse(false, 'Restaurant is  temporary closed');
      }

      // If autoOnOff is false, consider always open
      if (restaurant.autoOnOff === false) {
        return productService._availabilityResponse(true, null, null, product.preparationTime || 10);
      }

      // Check restaurant opening hours
      const { isOpen, nextOpeningTime } = productService.isRestaurantOpenNow(restaurant);

      if (!isOpen) {
        return productService._availabilityResponse(false, 'Restaurant is currently closed', nextOpeningTime);
      }

      // All good
      return productService._availabilityResponse(true, null, null, product.preparationTime || 10);

    } catch (error) {
      console.error('❌ Error in checkProductAvailability:', error);
      return productService._availabilityResponse(false, 'Error checking availability');
    }
  },

  /**
   * Check availability for multiple products
   * @param {Array<String>} productIds 
   * @returns {Promise<Object>}
   */
  checkMultipleProducts: async (productIds) => {
    try {
      const products = await Product.find({ _id: { $in: productIds } })
        .populate('restaurantId', 'openingHours active autoOnOff');

      // Build unique restaurants map
      const restaurantMap = {};
      for (const product of products) {
        if (product.restaurantId) {
          restaurantMap[product.restaurantId._id] = product.restaurantId;
        }
      }

      const results = {};

      for (const productId of productIds) {
        const product = products.find(p => p._id.equals(productId));

        if (!product) {
          results[productId] = productService._availabilityResponse(false, 'Product not found');
          continue;
        }

        if (!product.active) {
          results[productId] = productService._availabilityResponse(false, 'Product is inactive');
          continue;
        }

        const restaurant = restaurantMap[product.restaurantId?._id];

        if (!restaurant || !restaurant.active) {
          results[productId] = productService._availabilityResponse(false, 'Restaurant is inactive or not found');
          continue;
        }

        if (restaurant.autoOnOff === false) {
          results[productId] = productService._availabilityResponse(true, null, null, product.preparationTime || 10);
          continue;
        }

        const { isOpen, nextOpeningTime } = productService.isRestaurantOpenNow(restaurant);

        if (!isOpen) {
          results[productId] = productService._availabilityResponse(false, 'Restaurant is closed', nextOpeningTime);
          continue;
        }

        results[productId] = productService._availabilityResponse(true, null, null, product.preparationTime || 10);
      }

      return results;

    } catch (error) {
      console.error('❌ Error in checkMultipleProducts:', error);
      throw error;
    }
  },

  /**
   * Get detailed product info with availability
   * @param {String} productId 
   * @returns {Promise<Object|null>}
   */
  getProductDetails: async (productId) => {
    try {
      const product = await Product.findById(productId)
        .populate('restaurantId', 'name openingHours active autoOnOff')
        .populate('categoryId', 'name')
        .populate('addOns', 'name price isAvailable');

      if (!product) return null;

      const availability = await productService.checkProductAvailability(productId);

      return {
        ...product.toObject(),
        availability
      };

    } catch (error) {
      console.error('❌ Error in getProductDetails:', error);
      throw error;
    }
  },

  /**
   * Standardized product availability response
   */
  _availabilityResponse: (isAvailable, reason = null, nextAvailableTime = null, preparationTime = null) => {
    return {
      isAvailable,
      reason,
      nextAvailableTime,
      preparationTime
    };
  }
};

module.exports = productService;
