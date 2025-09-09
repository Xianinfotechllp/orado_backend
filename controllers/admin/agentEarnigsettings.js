const AgentEarningSetting = require('../../models/AgentEarningSettingModel');


exports.addAgentEarnigsSetting = async (req, res) => {
  try {
    const { 
      mode, 
      merchantId, 
      cityId, 
      baseFee, 
      baseKm, 
      perKmFeeBeyondBase, 
      bonuses, // expect bonuses object { peakHour, rain, zone }
      isOverride 
    } = req.body;

    // ✅ Validation
    if (!mode) {
      return res.status(400).json({ error: "Mode is required (global / merchant / city)." });
    }
    if (mode === "merchant" && !merchantId) {
      return res.status(400).json({ error: "Merchant ID is required for merchant-specific settings." });
    }
    if (mode === "city" && !cityId) {
      return res.status(400).json({ error: "City ID is required for city-specific settings." });
    }

    // ✅ Query builder
    let query = { mode };
    if (mode === "merchant") query.merchantId = merchantId;
    if (mode === "city") query.cityId = cityId;
    if (mode === "global") query = { mode: "global" }; // Only one global

    // ✅ Check if already exists
    const existingSetting = await AgentEarningSetting.findOne(query);

    // ✅ Upsert (insert/update)
    const updatedSetting = await AgentEarningSetting.findOneAndUpdate(
      query,
      {
        $set: {
          baseFee: baseFee ?? 20,
          baseKm: baseKm ?? 2,
          perKmFeeBeyondBase: perKmFeeBeyondBase ?? 10,
          bonuses: {
            peakHour: bonuses?.peakHour ?? 0,
            rain: bonuses?.rain ?? 0,
            zone: bonuses?.zone ?? 0,
          },
          isOverride: mode === "global" ? false : (isOverride ?? true),
        }
      },
      { upsert: true, new: true }
    ).populate("cityId", "name _id"); // 👈 populates city name + id

    // ✅ Response
    res.status(200).json({
      success: true,
      message: existingSetting 
        ? "Delivery fee setting updated successfully!"
        : "Delivery fee setting created successfully!",
      data: updatedSetting,
    });

  } catch (error) {
    console.error("❌ Error adding/updating delivery fee setting:", error);
    res.status(500).json({ error: error.message || "Failed to add/update delivery fee setting." });
  }
};







exports.getAgentEarningsSettings = async (req, res) => {
  try {
    const { mode, merchantId, cityId } = req.query;

    // Validate mode if provided
    if (mode && !['global', 'merchant', 'city'].includes(mode)) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid mode parameter. Must be 'global', 'merchant', or 'city'"
      });
    }

    let query = {};
    
    // Build query based on parameters
    if (mode) query.mode = mode;
    if (merchantId) query.merchantId = merchantId;
    if (cityId) query.cityId = cityId;

    // Special case for global - should only return one document
    if (mode === 'global') {
      const globalSettings = await AgentEarningSetting.findOne({ mode: 'global' });
      
      if (!globalSettings) {
        // Return default global settings if none exist in DB
        return res.status(200).json({
          success: true,
          data: new AgentEarningSetting({ mode: 'global' })
        });
      }

      return res.status(200).json({
        success: true,
        data: globalSettings
      });
    }

    // For merchant/city modes or no mode specified
    const settings = await AgentEarningSetting.find(query)
      .populate('merchantId', 'name')
      .populate('cityId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: settings.length,
      data: settings
    });

  } catch (error) {
    console.error('Error fetching agent earnings settings:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};
exports.deleteAgentEarningsSetting = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedSetting = await AgentEarningSetting.findByIdAndDelete(id);

    if (!deletedSetting) {
      return res.status(404).json({
        success: false,
        error: "Earning setting not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Earning setting deleted successfully",
      data: deletedSetting,
    });
  } catch (error) {
    console.error("Error deleting agent earnings setting:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete earning setting",
    });
  }
};





// controllers/admin/agentEarningSettings.js

exports.updateAgentEarningsSetting = async (req, res) => {
  try {
    const { id } = req.params; // setting ID to update
    const {
      baseFee,
      baseKm,
      perKmFeeBeyondBase,
      bonuses,
      isOverride
    } = req.body;

    console.log("🔹 Update request body:", req.body);

    const updatedSetting = await AgentEarningSetting.findByIdAndUpdate(
      id,
      {
        $set: {
          baseFee: baseFee ?? 20,
          baseKm: baseKm ?? 2,
          perKmFeeBeyondBase: perKmFeeBeyondBase ?? 10,
          bonuses: {
            peakHour: bonuses?.peakHour ?? 0,
            rain: bonuses?.rain ?? 0,
            zone: bonuses?.zone ?? 0,
          },
          isOverride: isOverride ?? true
        }
      },
      { new: true }
    ).populate("cityId", "name _id"); // 👈 ensures cityId.name is available in response

    if (!updatedSetting) {
      return res.status(404).json({
        success: false,
        error: "Earning setting not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Earning setting updated successfully",
      data: updatedSetting
    });

  } catch (error) {
    console.error("❌ Error updating agent earnings setting:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Server error"
    });
  }
};


exports.getCityWiseEarningSettings = async (req, res) => {
  try {
    const { cityId } = req.query;

    let query = { mode: 'city' };
    if (cityId) query.cityId = cityId; // optional filter for one city

    const citySettings = await AgentEarningSetting.find(query)
      .populate('cityId', 'name') // populate city name
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: citySettings.length,
      data: citySettings.map((s) => ({
        id: s._id,
        city: s.cityId?.name || null,
        cityId: s.cityId?._id || null,
        baseFee: s.baseFee,
        baseKm: s.baseKm,
        perKmFeeBeyondBase: s.perKmFeeBeyondBase,
        bonuses: s.bonuses,
        isOverride: s.isOverride,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching city-wise agent earnings settings:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching city-wise settings',
    });
  }
}

exports.getAgentEarningsSettings = async (req, res) => {
  try {
    const { mode, merchantId, cityId } = req.query;

    // Validate mode if provided
    if (mode && !['global', 'merchant', 'city'].includes(mode)) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid mode parameter. Must be 'global', 'merchant', or 'city'"
      });
    }

    let query = {};
    if (mode) query.mode = mode;
    if (merchantId) query.merchantId = merchantId;
    if (cityId) query.cityId = cityId;

    // Special case for global - should only return one document
    if (mode === 'global') {
      const globalSettings = await AgentEarningSetting.findOne({ mode: 'global' }).lean();

      if (!globalSettings) {
        // Return a consistent default global config if none exists
        return res.status(200).json({
          success: true,
          data: {
            mode: 'global',
            baseFee: 20,
            baseKm: 2,
            perKmFeeBeyondBase: 10,
            bonuses: { peakHour: 20, rain: 15, zone: 0 },
            isOverride: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: globalSettings
      });
    }

    // For merchant/city modes or no mode specified
    const settings = await AgentEarningSetting.find(query)
      .populate('merchantId', 'name')
      .populate('cityId', 'name')
      .sort({ updatedAt: -1 }) // ✅ use updatedAt since you added timestamps
      .lean();

    res.status(200).json({
      success: true,
      count: settings.length,
      data: settings
    });

  } catch (error) {
    console.error('Error fetching agent earnings settings:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};
