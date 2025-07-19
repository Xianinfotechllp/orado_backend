const PlatformSetting = require('../../models/platformSetting.js');
const Restaurant = require('../../models/restaurantModel.js');
const RestaurantEarning = require('../../models/RestaurantEarningModel.js');
const moment = require('moment');

// Global commission setting for the platform
exports.setGlobalCommission = async (req, res) => {
  try {
    const { type, value } = req.body;

    if (!['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({ message: 'Invalid commission type' });
    }

    let setting = await PlatformSetting.findOne();
    if (!setting) {
      setting = new PlatformSetting();
    }

    setting.commission = { type, value };
    await setting.save();

    res.json({ message: 'Global commission updated', data: setting });
  } catch (err) {
    console.error('Error setting global commission:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// merchant level commission

exports.setMerchantCommission = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { type, value } = req.body;

    if (!['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({ message: 'Invalid commission type' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    restaurant.commission = { type, value };
    await restaurant.save();

    res.json({ message: 'Merchant commission updated', data: restaurant.commission });
  } catch (err) {
    console.error('Error setting merchant commission:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// weekly or monthly commission summary for a restaurant

exports.getCommissionSummary = async (req, res) => {
  try {
    const { period } = req.query; // week or month
    let startDate;

    if (period === 'week') {
      startDate = moment().startOf('week').toDate();
    } else if (period === 'month') {
      startDate = moment().startOf('month').toDate();
    } else {
      return res.status(400).json({ message: 'Invalid period (use week or month)' });
    }

    const earnings = await RestaurantEarning.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$restaurantId',
          totalCommission: { $sum: '$commissionAmount' },
          totalEarnings: { $sum: '$totalOrderAmount' },
          orders: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      { $unwind: '$restaurant' }
    ]);

    res.json({ data: earnings });
  } catch (err) {
    console.error('Error fetching commission summary:', err);
    res.status(500).json({ message: 'Server error' });
  }
};