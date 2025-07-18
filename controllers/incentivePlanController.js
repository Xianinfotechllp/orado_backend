const IncentivePlan = require('../models/incentivePlanModel');
exports.createIncentivePlan = async (req, res) => {
  try {
    const {
      planType,
      targetType,
      condition,
      thresholdAmount,
      incentiveAmount,
      effectiveFrom,
      effectiveTo,
      cities,
      applyToAllCities,
      status,
      createdBy
    } = req.body;

    const incentivePlan = new IncentivePlan({
      planType,
      targetType,
      condition,
      thresholdAmount,
      incentiveAmount,
      effectiveFrom,
      effectiveTo,
      cities,
      applyToAllCities,
      status,
      createdBy
    });

    const savedPlan = await incentivePlan.save();
    res.status(201).json({ success: true, data: savedPlan });
  } catch (error) {
    console.error('Error creating incentive plan:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};



exports.getAllIncentivePlans = async (req, res) => {
  try {
    const plans = await IncentivePlan.find()
      .populate('cities', 'name') // Only fetch city names
      .sort({ createdAt: -1 });   // Optional: sort newest first

    res.status(200).json(plans);
  } catch (error) {
    console.error('Error fetching incentive plans:', error);
    res.status(500).json({ message: 'Failed to fetch incentive plans' });
  }
};



exports.deleteIncentivePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await IncentivePlan.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Incentive plan not found' });
    }

    res.status(200).json({ message: 'Incentive plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting incentive plan:', error);
    res.status(500).json({ message: 'Failed to delete incentive plan' });
  }
};



exports.toggleIncentivePlanStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await IncentivePlan.findById(id);
    if (!plan) {
      return res.status(404).json({ message: 'Incentive plan not found' });
    }

    plan.status = plan.status === 'Active' ? 'Inactive' : 'Active';
    await plan.save();

    res.status(200).json({
      message: `Plan marked as ${plan.status}`,
      status: plan.status
    });
  } catch (error) {
    console.error('Error toggling plan status:', error);
    res.status(500).json({ message: 'Failed to toggle status' });
  }
};