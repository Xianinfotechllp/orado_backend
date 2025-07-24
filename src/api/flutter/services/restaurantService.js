const mongoose = require('mongoose');
const Restaurant = require('../../../../models/restaurantModel');
const moment = require('moment');

const restaurantService = {
  /**
   * Check restaurant status and opening hours
   * @param {String} restaurantId - ID of the restaurant
   * @returns {Promise<Object>} { isAvailable: Boolean, reason: String|null, nextOpeningTime: String|null }
   */
  checkStatus: async (restaurantId) => {
    try {
      const restaurant = await Restaurant.findById(restaurantId).lean();

      if (!restaurant) {
        return restaurantService._statusResponse(false, "Restaurant not found");
      }
      console.log(restaurant.active)
      if (!restaurant.active) {
        return restaurantService._statusResponse(false, "Restaurant is  temporary closed");
      }

      if (!restaurant.autoOnOff) {
        return restaurantService._statusResponse(false, "Restaurant is temporarily closed");
      }

      const now = moment();
      const currentDay = now.format('dddd').toLowerCase();
      let todayHours;

      if (Array.isArray(restaurant.openingHours)) {
        todayHours = restaurant.openingHours.find(oh => oh.day.toLowerCase() === currentDay);
      } else {
        todayHours = restaurant.openingHours[currentDay];
      }

      if (!todayHours || todayHours.isClosed) {
        const nextOpeningTime = await restaurantService.getNextOpeningTime(restaurantId);
        return restaurantService._statusResponse(false, "Restaurant is closed today", nextOpeningTime);
      }

      const currentTime = now.format('HH:mm');
      if (currentTime < todayHours.openingTime || currentTime > todayHours.closingTime) {
        const nextOpeningTime = await restaurantService.getNextOpeningTime(restaurantId);
        return restaurantService._statusResponse(false, "Outside of business hours", nextOpeningTime);
      }

      return restaurantService._statusResponse(true);

    } catch (error) {
      console.error('❌ Error in checkStatus:', error);
      return restaurantService._statusResponse(false, "Error checking restaurant status");
    }
  },

  /**
   * Get next opening time description
   * @param {String} restaurantId - ID of the restaurant
   * @returns {Promise<String>} - Human-readable opening time description
   */
  getNextOpeningTime: async (restaurantId) => {
    try {
      const restaurant = await Restaurant.findById(restaurantId).lean();
      if (!restaurant) return "Restaurant not found";

      const now = moment();
      const daysOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayIndex = daysOrder.indexOf(now.format('dddd').toLowerCase());

      let openingHoursArray = Array.isArray(restaurant.openingHours)
        ? restaurant.openingHours
        : Object.entries(restaurant.openingHours).map(([day, hours]) => ({ day, ...hours }));

      openingHoursArray = openingHoursArray.sort(
        (a, b) => daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day)
      );

      for (let i = 0; i < 7; i++) {
        const dayIndex = (currentDayIndex + i) % 7;
        const dayName = daysOrder[dayIndex];
        const dayHours = openingHoursArray.find(oh => oh.day.toLowerCase() === dayName);

        if (dayHours && !dayHours.isClosed) {
          const openTime = moment().add(i, 'days')
            .set({
              hour: Number(dayHours.openingTime.split(':')[0]),
              minute: Number(dayHours.openingTime.split(':')[1]),
              second: 0
            });

          if (i === 0 && now.isAfter(openTime)) continue;

          return `Opens ${i === 0 ? 'today' : i === 1 ? 'tomorrow' : `on ${dayName}`} at ${dayHours.openingTime}`;
        }
      }

      return "No upcoming opening times found";

    } catch (error) {
      console.error('❌ Error in getNextOpeningTime:', error);
      return "Error determining next opening time";
    }
  },

  /**
   * Standardized status response
   */
  _statusResponse: (isAvailable, reason = null, nextOpeningTime = null) => {
    return {
      isAvailable,
      reason,
      nextOpeningTime
    };
  }
};

module.exports = restaurantService;
