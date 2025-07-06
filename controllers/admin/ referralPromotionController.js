const ReferralPromotion = require("../../models/ReferralPromotionModel");
const Joi = require("joi");

/**
 * @desc   Create a new referral promotion
 * @route  POST /api/referral-promotions
 * @access Private (Admin)
 */
exports.createReferralPromotion = async (req, res) => {
  // ✅ Define validation schema using Joi
  const schema = Joi.object({
    language: Joi.string().valid("English", "Spanish", "French").default("English"),
    referralType: Joi.string().valid("percentage", "flat").required(),

    // Referrer fields
    referrerDiscountValue: Joi.number().required(),
    referrerMaxDiscountValue: Joi.number().min(0).default(0),
    referrerDescription: Joi.string().required(),

    // Referee fields
    refereeDiscountValue: Joi.number().required(),
    refereeMaxDiscountValue: Joi.number().min(0).default(0),
    minOrderValue: Joi.number().min(0).default(0),
    refereeDescription: Joi.string().required(),

    // Program options
    status: Joi.boolean().default(true),
    referralCodeOnSignup: Joi.boolean().default(true),
    smartURL: Joi.boolean().default(true),
  });

  try {
    // ✅ Validate req.body
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        status: false,
        message: "Validation Error",
        errors: error.details.map((err) => err.message),
      });
    }

    // ✅ Create new referral promotion
    const newPromotion = await ReferralPromotion.create(value);

    res.status(201).json({
      status: true,
      message: "Referral promotion created successfully",
      data: newPromotion,
    });
  } catch (err) {
    console.error("Error creating referral promotion:", err.message);
    res.status(500).json({
      status: false,
      message: "Server Error",
    });
  }
};








exports.updateReferralPromotion = async (req, res) => {
  const { id } = req.params;

  const schema = Joi.object({
    language: Joi.string().valid("English", "Spanish", "French"),
    referralType: Joi.string().valid("percentage", "flat"),
    referrerDiscountValue: Joi.number(),
    referrerMaxDiscountValue: Joi.number().min(0),
    referrerDescription: Joi.string(),
    refereeDiscountValue: Joi.number(),
    refereeMaxDiscountValue: Joi.number().min(0),
    minOrderValue: Joi.number().min(0),
    refereeDescription: Joi.string(),
    status: Joi.boolean(),
    referralCodeOnSignup: Joi.boolean(),
    smartURL: Joi.boolean(),
  });

  try {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        status: false,
        message: "Validation Error",
        errors: error.details.map((err) => err.message),
      });
    }

    const updatedPromotion = await ReferralPromotion.findByIdAndUpdate(id, value, {
      new: true,
      runValidators: true,
    });

    if (!updatedPromotion) {
      return res.status(404).json({
        status: false,
        message: "Referral promotion not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "Referral promotion updated successfully",
      data: updatedPromotion,
    });
  } catch (err) {
    console.error("Error updating referral promotion:", err.message);
    res.status(500).json({
      status: false,
      message: "Server Error",
    });
  }
};



exports.createOrUpdateReferralPromotion = async (req, res) => {
  try {
    const {
      language,
      referralType,
      referrerDiscountValue,
      referrerMaxDiscountValue,
      referrerDescription,
      refereeDiscountValue,
      refereeMaxDiscountValue,
      minOrderValue,
      refereeDescription,
      status,
      referralCodeOnSignup,
      smartURL
    } = req.body;

    // Basic validation — customize as needed
    if (!referralType || !referrerDiscountValue || !refereeDiscountValue) {
      return res.status(400).json({
        success: false,
        message: "Referral type and discount values are required."
      });
    }

    const promotion = await ReferralPromotion.findOneAndUpdate(
      {},  // singleton: one config for entire platform
      {
        language,
        referralType,
        referrerDiscountValue,
        referrerMaxDiscountValue,
        referrerDescription,
        refereeDiscountValue,
        refereeMaxDiscountValue,
        minOrderValue,
        refereeDescription,
        status,
        referralCodeOnSignup,
        smartURL
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Referral promotion settings saved successfully.",
      data: promotion
    });

  } catch (error) {
    console.error("Error saving referral promotion settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save referral promotion settings."
    });
  }
};




exports.getReferralPromotionSettings = async (req, res) => {
  try {
    const promotion = await ReferralPromotion.findOne({}).lean();

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "No referral promotion settings found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Referral promotion settings fetched successfully.",
      data: promotion,
    });

  } catch (err) {
    console.error("Error fetching referral promotion settings:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch referral promotion settings.",
    });
  }
};