// controllers/merchantCommissionController.js
const Order = require("../models/orderModel")
const MerchantCommissionSetting = require("../models/merchantCommissionSettingModel");
const mongoose = require('mongoose');
const RestaurantEarnigs = require("../models/RestaurantEarningModel")
const ExcelJS = require('exceljs');

const Restaurant = require("../models/restaurantModel");
// exports.createOrUpdateCommissionSetting = async (req, res) => {
//   try {
//     const {
//       restaurantId,
//       storeType,
//       commissionType,
//       commissionValue,
//       commissionBase = "subtotal",
//       isDefault = false,
//     } = req.body;

//     // === Validate Required Fields ===
//     if (!commissionType || commissionValue == null) {
//       return res.status(400).json({
//         success: false,
//         message: "commissionType and commissionValue are required.",
//       });
//     }

//     // === Determine Scope ===
//     let filter = {};

//     if (isDefault) {
//       // Global default setting
//       filter = { isDefault: true, restaurantId: null };
//     } else if (restaurantId) {
//       // Restaurant-specific setting (with or without storeType)
//       filter = { restaurantId };
//       if (storeType) filter.storeType = storeType;
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: "Either isDefault or restaurantId must be provided.",
//       });
//     }

//     // === Check Existing Entry ===
//     const existingSetting = await MerchantCommissionSetting.findOne(filter);

//     if (existingSetting) {
//       // Update existing
//       existingSetting.commissionType = commissionType;
//       existingSetting.commissionValue = commissionValue;
//       existingSetting.commissionBase = commissionBase;
//       existingSetting.isDefault = isDefault;

//       await existingSetting.save();

//       return res.status(200).json({
//         success: true,
//         message: isDefault
//           ? "Default commission updated successfully."
//           : "Commission setting updated successfully.",
//         data: existingSetting,
//       });
//     } else {
//       // Create new
//       const newSetting = await MerchantCommissionSetting.create({
//         restaurantId: isDefault ? null : restaurantId,
//         storeType: storeType || null,
//         commissionType,
//         commissionValue,
//         commissionBase,
//         isDefault,
//       });

//       return res.status(201).json({
//         success: true,
//         message: isDefault
//           ? "Default commission created successfully."
//           : "Commission setting created successfully.",
//         data: newSetting,
//       });
//     }
//   } catch (err) {
//     console.error("Error in createOrUpdateCommissionSetting:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error.",
//     });
//   }
// };


exports.createOrUpdateCommissionSetting = async (req, res) => {
  try {
    const {
      restaurantId,
      commissionType,
      commissionValue,
      commissionBase = "subtotal",
      isDefault = false,
    } = req.body;

    // === Validate Required Fields ===
    if (!commissionType) {
      return res.status(400).json({
        success: false,
        message: "commissionType is required.",
      });
    }

    // commissionValue is required only if commissionType is not 'costPrice'
    if (commissionType !== "costPrice" && (commissionValue == null)) {
      return res.status(400).json({
        success: false,
        message: "commissionValue is required for percentage or fixed commission types.",
      });
    }

    let storeType = null;

    // === If not default, restaurantId must be provided ===
    if (!isDefault) {
      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: "restaurantId is required if not default.",
        });
      }

      // Fetch restaurant to get storeType automatically
      const restaurant = await Restaurant.findById(restaurantId).select("storeType");
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: "Restaurant not found.",
        });
      }

      storeType = restaurant.storeType; // ✅ take from DB, not req.body
    }

    // === Determine Scope ===
    let filter = isDefault ? { isDefault: true } : { restaurantId };

    // === Check Existing Entry ===
    const existingSetting = await MerchantCommissionSetting.findOne(filter);

    if (existingSetting) {
      // Update existing
      existingSetting.commissionType = commissionType;
      existingSetting.commissionValue = commissionType === "costPrice" ? null : commissionValue;
      existingSetting.commissionBase = commissionBase;
      existingSetting.storeType = storeType;

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
        storeType: isDefault ? null : storeType,
        commissionType,
        commissionValue: commissionType === "costPrice" ? null : commissionValue,
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




exports.getRestaurantCommissionsAdmin = async (req, res) => {
  try {
    const {
      restaurantId,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};

    // Filter by restaurant if provided
    if (restaurantId && mongoose.Types.ObjectId.isValid(restaurantId)) {
      filter.restaurantId = restaurantId;
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Fetch paginated results with restaurant info
    const commissions = await RestaurantEarnigs.paginate(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: { path: 'restaurantId', select: 'name' }
    });

    // Total summary (for report cards)
    const summaryAggregation = await RestaurantEarnigs.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$commissionAmount' },
          totalEarnings: { $sum: '$restaurantNetEarning' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    const summary = summaryAggregation[0] || {
      totalCommission: 0,
      totalEarnings: 0,
      totalOrders: 0
    };

    return res.status(200).json({
      success: true,
      data: commissions.docs,
      total: commissions.totalDocs,
      pages: commissions.totalPages,
      currentPage: commissions.page,
      summary
    });

  } catch (err) {
    console.error('❌ Error fetching commissions:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching commissions'
    });
  }
};





exports.exportRestaurantCommissionsExcel = async (req, res) => {
  try {
    const { restaurantId, startDate, endDate } = req.query;

    const filter = {};

    // Filter by restaurant
    if (restaurantId && mongoose.Types.ObjectId.isValid(restaurantId)) {
      filter.restaurantId = restaurantId;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Fetch data with restaurant info
    const commissions = await RestaurantEarnigs.find(filter)
      .populate("restaurantId", "name")
      .sort({ createdAt: -1 });

    // Get restaurant name for filename if we have a specific restaurant filter
    let restaurantName = "all";
    if (restaurantId && commissions.length > 0 && commissions[0].restaurantId) {
      restaurantName = commissions[0].restaurantId.name.replace(/\s+/g, '_').toLowerCase();
    }

    // Create workbook & sheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Commissions");

    // Define columns
    worksheet.columns = [
      { header: "Order ID", key: "orderId", width: 30 },
      { header: "Restaurant", key: "restaurant", width: 25 },
      { header: "Cart Total", key: "cartTotal", width: 15 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Payable to Merchant", key: "merchantPayable", width: 20 },
      { header: "Payable to Admin", key: "adminPayable", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Date", key: "date", width: 20 },
    ];

    // Add rows
    commissions.forEach((item) => {
      worksheet.addRow({
        orderId: item._id.toString(),
        restaurant: item.restaurantId?.name || "N/A",
        cartTotal: item.cartTotal,
        totalAmount: item.totalAmount,
        merchantPayable: item.restaurantNetEarning,
        adminPayable: item.commissionAmount,
        status: item.status || "Pending",
        date: item.date ? item.date.toISOString().split("T")[0] : "",
      });
    });

    // Response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=commissions_${restaurantName}.xlsx`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ Error exporting commissions:", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error while exporting commissions",
    });
  }
};