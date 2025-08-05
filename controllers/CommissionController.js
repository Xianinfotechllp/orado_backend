// controllers/merchantCommissionController.js
const Order = require("../models/orderModel")
const MerchantCommissionSetting = require("../models/merchantCommissionSettingModel");
const mongoose = require('mongoose');
exports.createOrUpdateCommissionSetting = async (req, res) => {
  try {
    const {
      restaurantId,
      storeType,
      commissionType,
      commissionValue,
      commissionBase = "subtotal",
      isDefault = false,
    } = req.body;

    // === Validate Required Fields ===
    if (!commissionType || commissionValue == null) {
      return res.status(400).json({
        success: false,
        message: "commissionType and commissionValue are required.",
      });
    }

    // === Determine Scope ===
    let filter = {};

    if (isDefault) {
      // Global default setting
      filter = { isDefault: true, restaurantId: null };
    } else if (restaurantId) {
      // Restaurant-specific setting (with or without storeType)
      filter = { restaurantId };
      if (storeType) filter.storeType = storeType;
    } else {
      return res.status(400).json({
        success: false,
        message: "Either isDefault or restaurantId must be provided.",
      });
    }

    // === Check Existing Entry ===
    const existingSetting = await MerchantCommissionSetting.findOne(filter);

    if (existingSetting) {
      // Update existing
      existingSetting.commissionType = commissionType;
      existingSetting.commissionValue = commissionValue;
      existingSetting.commissionBase = commissionBase;
      existingSetting.isDefault = isDefault;

      await existingSetting.save();

      return res.status(200).json({
        success: true,
        message: isDefault
          ? "Default commission updated successfully."
          : "Commission setting updated successfully.",
        data: existingSetting,
      });
    } else {
      // Create new
      const newSetting = await MerchantCommissionSetting.create({
        restaurantId: isDefault ? null : restaurantId,
        storeType: storeType || null,
        commissionType,
        commissionValue,
        commissionBase,
        isDefault,
      });

      return res.status(201).json({
        success: true,
        message: isDefault
          ? "Default commission created successfully."
          : "Commission setting created successfully.",
        data: newSetting,
      });
    }
  } catch (err) {
    console.error("Error in createOrUpdateCommissionSetting:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};



exports.getCommissionSettings = async (req, res) => {
  try {
    const { restaurantId, storeType, isDefault } = req.query;

    // Build dynamic filter
    const filter = {};

    if (isDefault === "true") {
      filter.isDefault = true;
      filter.restaurantId = null;
    }

    if (restaurantId) {
      filter.restaurantId = restaurantId;
    }

    if (storeType) {
      filter.storeType = storeType;
    }

    const settings = await MerchantCommissionSetting.find(filter).populate("restaurantId", "name storeType");

    return res.status(200).json({
      success: true,
      message: "Commission settings fetched successfully.",
      data: settings,
    });
  } catch (err) {
    console.error("Error in getCommissionSettings:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};



exports.deleteCommissionSetting = async (req, res) => {
  try {
    const { settingId } = req.params;

    const deletedSetting = await MerchantCommissionSetting.findByIdAndDelete(settingId);

    if (!deletedSetting) {
      return res.status(404).json({
        success: false,
        message: "Commission setting not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Commission setting deleted successfully.",
      data: deletedSetting,
    });
  } catch (err) {
    console.error("Error in deleteCommissionSetting:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};




exports.getCommissionSummary = async (req, res) => {
  try {
    const { period = 'daily', startDate, endDate } = req.query;

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // default 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    // Set group format
    let dateFormat;
    switch (period) {
      case 'monthly':
        dateFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        break;
      case 'weekly':
        dateFormat = { $isoWeek: "$createdAt" };
        break;
      default:
        dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    }

    const summary = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'delivered' // or completed etc
        }
      },
      {
        $lookup: {
          from: 'merchantcommissionsettings',
          let: { restId: "$restaurantId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$restaurantId", "$$restId"] } } },
            { $sort: { isDefault: -1 } }, // prefer merchant-specific over default
            { $limit: 1 }
          ],
          as: 'commissionSetting'
        }
      },
      { $unwind: "$commissionSetting" },
      {
        $addFields: {
          commissionAmount: {
            $cond: [
              { $eq: ["$commissionSetting.commissionType", "percentage"] },
              { $multiply: [
                  "$totalAmount",
                  { $divide: ["$commissionSetting.commissionValue", 100] }
                ]
              },
              "$commissionSetting.commissionValue"
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            date: dateFormat,
            restaurantId: "$restaurantId"
          },
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          totalCommission: { $sum: "$commissionAmount" }
        }
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id.restaurantId',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      {
        $unwind: "$restaurant"
      },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          restaurantName: "$restaurant.name",
          totalOrders: 1,
          totalAmount: 1,
          totalCommission: 1
        }
      },
      { $sort: { date: -1 } }
    ]);

    res.json({ success: true, data: summary });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

