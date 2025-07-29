
const incentiveRule= require("../models/IncentiveRuleModel");
exports.createIncentiveRule = async (req, res) => {
  try {
    const {
      title,
      type,
      description,
      condition,
      incentiveAmount,
      rewardType,
      startDate,
      endDate,
      createdBy // pass admin ID from auth
    } = req.body;

    // Validation (basic)
    if (!title || !type || !condition || !incentiveAmount) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const newRule = new incentiveRule({
      title,
      type,
      description,
      condition,
      incentiveAmount,
      rewardType,
      startDate,
      endDate,
      createdBy
    });

    const savedRule = await newRule.save();
    res.status(201).json(savedRule);
  } catch (err) {
    console.error("Incentive creation error:", err);
    res.status(500).json({ message: "Server error while creating incentive rule." });
  }
};