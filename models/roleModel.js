const mongoose = require("mongoose");

const ModulePermissionSchema = new mongoose.Schema({
  moduleName: {
    type: String,
    required: true,
    enum: [
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
      "master_brand"
    ],
  },
  create: { type: Boolean, default: false },
  view: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
});

const RoleSchema = new mongoose.Schema(
  {
    roleName: { type: String, required: true, unique: true },
    description: String,
    permissions: [ModulePermissionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", RoleSchema);
    