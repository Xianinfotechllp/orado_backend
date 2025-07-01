    const Role = require("../../models/roleModel");
const mongoose = require("mongoose")
    // Allowed module names (from your schema enum)
    const allowedModules = [
    "orders",
    "restaurants",
    "restaurant_configurations",
    "catalogue",
    "import_export",
    "customers",
    "analytics",
    "wallet",
    "promo_codes",
    "discount",
    "referral",
    "ad_banners",
    "loyalty_points",
    "push_campaigns",
    "seo_for_manager",
    "catalog",
    "checkout",
    "delivery",
    "order_settings_orders",
    "cancellation",
    "commission",
    "taxes_fees_charges",
    "user_settings_customers",
    "user_settings_restaurants",
    "marketplace",
    "preferences",
    "terminology",
    "notifications",
    "tookan",
    "webhooks",
    "master_brand",
    ];

    exports.createRole = async (req, res) => {
    try {
        const { roleName, description, permissions } = req.body;

        if (!roleName || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({
            message: "roleName and permissions (as array) are required.",
        });
        }

        // Check for duplicate role name
        const existingRole = await Role.findOne({ roleName: roleName.trim() });
        if (existingRole) {
        return res.status(400).json({ message: "Role name already exists." });
        }

        // Validate module names and actions
        const invalidModules = permissions.filter(
        (perm) => !allowedModules.includes(perm.moduleName)
        );
        if (invalidModules.length > 0) {
        return res.status(400).json({
            message: "Invalid module(s) found.",
            invalidModules: invalidModules.map((m) => m.moduleName),
        });
        }

        // Optional: sanitize module permissions to only allowed props
        const sanitizedPermissions = permissions.map((perm) => ({
        moduleName: perm.moduleName,
        create: !!perm.create,
        view: !!perm.view,
        edit: !!perm.edit,
        delete: !!perm.delete,
        }));

        const newRole = await Role.create({
        roleName: roleName.trim(),
        description: description?.trim(),
        permissions: sanitizedPermissions,
        });

        return res.status(201).json({
        message: "Role created successfully",
        role: newRole,
        });
    } catch (error) {
        console.error("Error creating role:", error);
        res.status(500).json({ message: "Server error" });
    }
    };



    exports.getAllRoles = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const skip = (page - 1) * limit;

    const totalRoles = await Role.countDocuments();
    const roles = await Role.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      message: "Roles fetched successfully",
      total: totalRoles,
      page,
      limit,
      totalPages: Math.ceil(totalRoles / limit),
      roles,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Server error" });
  }
};




exports.getRoleById = async (req, res) => {
  try {
    const { roleId } = req.params;

    if (!roleId) {
      return res.status(400).json({ message: "Role ID is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ message: "Invalid Role ID format." });
    }

    const role = await Role.findById(roleId);

    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    res.status(200).json({
      message: "Role fetched successfully",
      role,
    });
  } catch (error) {
    console.error("Error fetching role by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};



exports.updateRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { roleName, description, permissions } = req.body;

    if (!roleId) {
      return res.status(400).json({ message: "Role ID is required." });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    // Check for duplicate role name if roleName is being updated
    if (roleName && roleName.trim() !== role.roleName) {
      const existingRole = await Role.findOne({ roleName: roleName.trim() });
      if (existingRole) {
        return res.status(400).json({ message: "Role name already exists." });
      }
      role.roleName = roleName.trim();
    }

    // Update description if provided
    if (description) role.description = description.trim();

    // Validate permissions if provided
    if (permissions && Array.isArray(permissions)) {
      const invalidModules = permissions.filter(
        (perm) => !allowedModules.includes(perm.moduleName)
      );

      if (invalidModules.length > 0) {
        return res.status(400).json({
          message: "Invalid module(s) found in permissions.",
          invalidModules: invalidModules.map((m) => m.moduleName),
        });
      }

      // Sanitize permissions structure
      const sanitizedPermissions = permissions.map((perm) => ({
        moduleName: perm.moduleName,
        create: !!perm.create,
        view: !!perm.view,
        edit: !!perm.edit,
        delete: !!perm.delete,
      }));

      role.permissions = sanitizedPermissions;
    }

    await role.save();

    return res.status(200).json({
      message: "Role updated successfully",
      role,
    });

  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    if (!roleId) {
      return res.status(400).json({ message: "Role ID is required." });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    await role.deleteOne();

    res.status(200).json({
      message: "Role deleted successfully",
    });

  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};