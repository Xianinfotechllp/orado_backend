const AgentEarningSetting = require('../../models/AgentEarningSettingModel');

// Add or replace delivery fee setting
exports.addAgentEarnigsSetting = async (req, res) => {
  try {
    const { mode, merchantId, cityId, baseFee, baseKm, perKmFeeBeyondBase, peakHourBonus, rainBonus } = req.body;

    // Validate required fields based on mode
    if (mode === 'merchant' && !merchantId) {
      return res.status(400).json({ error: "Merchant ID is required for merchant-specific settings." });
    }
    if (mode === 'city' && !cityId) {
      return res.status(400).json({ error: "City ID is required for city-specific settings." });
    }

    // For global mode: Replace existing setting (if any)
    if (mode === 'global') {
      const updatedSetting = await AgentEarningSetting.findOneAndUpdate(
        { mode: 'global' }, // Find global setting
        {
          $set: {
            baseFee: baseFee || 20,
            baseKm: baseKm || 2,
            perKmFeeBeyondBase: perKmFeeBeyondBase || 10,
            peakHourBonus: peakHourBonus || 20,
            rainBonus: rainBonus || 15,
          }
        },
        { 
          upsert: true, // Create if doesn't exist
          new: true    // Return updated document
        }
      );

      return res.status(200).json({
        success: true,
        message: "Global delivery fee setting updated/replaced successfully!",
        data: updatedSetting,
      });
    }

    // For merchant/city mode: Prevent duplicates
    let existingSetting;
    if (mode === 'merchant') {
      existingSetting = await AgentEarningSetting.findOne({ mode, merchantId });
    } else if (mode === 'city') {
      existingSetting = await AgentEarningSetting.findOne({ mode, cityId });
    }

    if (existingSetting) {
      return res.status(400).json({ 
        error: "A setting already exists for this scope. Use an update endpoint instead." 
      });
    }

    // Create new setting (merchant/city)
    const newSetting = new AgentEarningSetting({
      mode,
      merchantId: mode === 'merchant' ? merchantId : undefined,
      cityId: mode === 'city' ? cityId : undefined,
      baseFee: baseFee || 20,
      baseKm: baseKm || 2,
      perKmFeeBeyondBase: perKmFeeBeyondBase || 10,
      peakHourBonus: peakHourBonus || 20,
      rainBonus: rainBonus || 15,
    });

    await newSetting.save();

    res.status(201).json({
      success: true,
      message: "Delivery fee setting created successfully!",
      data: newSetting,
    });

  } catch (error) {
    console.error("Error adding delivery fee setting:", error);
    res.status(500).json({ error: "Failed to add delivery fee setting." });
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