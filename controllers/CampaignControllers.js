const Campaign = require("../models/CampaignModel");

/**
 * @desc   Create a new campaign
 * @route  POST /api/campaigns
 * @access Private (Admin)
 */
exports.createCampaign = async (req, res) => {
  try {
    const {
      name,
      description,
      channelType,
      messageTitle,
      messageBody,
      segment,
      campaignType,
      scheduledTime,
      recurringInterval,
    } = req.body;

    // Basic validation — scheduledTime required for 'later', recurringInterval for 'recurring'
    if (campaignType === 'later' && !scheduledTime) {
      return res.status(400).json({ message: "scheduledTime is required for 'later' campaigns." });
    }

    if (campaignType === 'recurring' && !recurringInterval) {
      return res.status(400).json({ message: "recurringInterval is required for 'recurring' campaigns." });
    }

    // Create campaign
    const newCampaign = await Campaign.create({
      name,
      description,
      channelType,
      messageTitle,
      messageBody,
      segment,
      campaignType,
      scheduledTime,
      recurringInterval,
      createdBy: req.user._id, // assuming you're using JWT-based auth middleware setting req.user
    });

    res.status(201).json({
      message: "Campaign created successfully.",
      campaign: newCampaign,
    });

  } catch (error) {
    console.error("Create Campaign Error:", error);
    res.status(500).json({ message: "Failed to create campaign.", error: error.message });
  }
};
