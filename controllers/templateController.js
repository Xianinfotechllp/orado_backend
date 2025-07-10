
const {Template} = require("../models/TemplateModel");


/**
 * @desc    Create a new template with optional pricing rules, fields, and notifications
 * @route   POST /api/templates
 * @access  Admin / Merchant
 */
exports.createTemplate = async (req, res) => {
  try {
    const {
      name,
      description,
      fields,
      pricingRules,
      notifications,
      createdBy
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ success: false, message: "Template name is required." });
    }

    // Validate pricing rules
    if (pricingRules && pricingRules.length > 0) {
      for (const rule of pricingRules) {
        if (rule.pricingMode === 'range_based' && (!rule.ranges || rule.ranges.length === 0)) {
          return res.status(400).json({
            success: false,
            message: "Range-based pricing requires at least one range."
          });
        }

        // Validate ranges
        if (rule.ranges) {
          const hasDefault = rule.ranges.some(r => r.toDistance === null);
          if (!hasDefault) {
            return res.status(400).json({
              success: false,
              message: "Range-based pricing requires a default range (with no upper limit)."
            });
          }
        }
      }
    }

    // Create template document
    const template = await Template.create({
      name,
      description,
      fields,
      pricingRules,
      notifications,
      createdBy
    });

    return res.status(201).json({
      success: true,
      message: "Template created successfully.",
      template
    });

  } catch (error) {
    console.error("Failed to create template:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};


exports.updateTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const updateData = req.body;

    // Find template
    const template = await Template.findById(templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found." });
    }

    // Update allowed fields
    if (updateData.name !== undefined) template.name = updateData.name;
    if (updateData.description !== undefined) template.description = updateData.description;
    if (updateData.fields !== undefined) template.fields = updateData.fields;
    if (updateData.pricingRules !== undefined) template.pricingRules = updateData.pricingRules;
    if (updateData.notifications !== undefined) template.notifications = updateData.notifications;
    if (updateData.isActive !== undefined) template.isActive = updateData.isActive;

    // Save updated template
    await template.save();

    return res.status(200).json({
      success: true,
      message: "Template updated successfully.",
      template
    });

  } catch (error) {
    console.error("Failed to update template:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};


exports.getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.find().populate("pricingRules.ranges.surgeRule");

    res.status(200).json({
      success: true,
      templates
    });
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};



exports.getTemplateById = async (req, res) => {
  try {
    const { templateId } = req.params;

    const template = await Template.findById(templateId)
      .populate("createdBy")
      .populate("pricingRules.ranges.surgeRule");

    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found." });
    }

    res.status(200).json({
      success: true,
      template
    });
  } catch (error) {
    console.error("Failed to fetch template:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};