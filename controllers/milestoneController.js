const MilestoneReward = require("../models/MilestoneRewardModel");

// Create a new milestone
exports.createMilestone = async (req, res) => {
  try {
    const { title, description, level, levelImageUrl, conditions, reward } = req.body;

    if (!title || !level || !reward?.name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, level, and reward name are mandatory."
      });
    }

    const milestone = await MilestoneReward.create({
      title,
      description,
      level,
      levelImageUrl,
      conditions,
      reward
    });

    return res.status(201).json({
      success: true,
      message: `Milestone '${title}' (Level ${level}) created successfully!`,
      milestone
    });
  } catch (error) {
    console.error("Error creating milestone:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error: Unable to create milestone. Please try again later.",
      error: error.message
    });
  }
};




exports.updateMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, level, levelImageUrl, conditions, reward } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Milestone ID is required."
      });
    }

    // Find milestone by ID and update
    const milestone = await MilestoneReward.findByIdAndUpdate(
      id,
      {
        ...(title && { title }),
        ...(description && { description }),
        ...(level && { level }),
        ...(levelImageUrl && { levelImageUrl }),
        ...(conditions && { conditions }),
        ...(reward && { reward })
      },
      { new: true, runValidators: true }
    );

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: "Milestone not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: `Milestone '${milestone.title}' (Level ${milestone.level}) updated successfully!`,
      milestone
    });
  } catch (error) {
    console.error("Error updating milestone:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error: Unable to update milestone. Please try again later.",
      error: error.message
    });
  }
};
// Get all milestones
exports.getAllMilestones = async (req, res) => {
  try {
    const milestones = await MilestoneReward.find();

    if (milestones.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No milestones found yet.",
        milestones: []
      });
    }

    res.status(200).json({
      success: true,
      message: `${milestones.length} milestone(s) fetched successfully.`,
      milestones
    });
  } catch (error) {
    console.error("Error fetching milestones:", error);
    res.status(500).json({
      success: false,
      message: "Server Error: Unable to fetch milestones. Please try again later.",
      error: error.message
    });
  }
};


exports.deleteMilestone = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Milestone ID is required."
      });
    }

    const milestone = await MilestoneReward.findByIdAndDelete(id);

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: "Milestone not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: `Milestone '${milestone.title}' (Level ${milestone.level}) deleted successfully!`
    });
  } catch (error) {
    console.error("Error deleting milestone:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error: Unable to delete milestone. Please try again later.",
      error: error.message
    });
  }
};