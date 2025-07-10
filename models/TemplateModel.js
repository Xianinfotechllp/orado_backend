const mongoose = require("mongoose");

// Field Schema inside a template
const FieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // text, number, date, etc.
  permissions: {
    agent: { type: Number, default: 0 },    // 0 = Read, 1 = Read & Write, 2 = Hidden
    customer: { type: Number, default: 0 }
  },
  mandatory: { type: Boolean, default: false },
  defaultValue: { type: mongoose.Schema.Types.Mixed },
  columns: [
    {
      name: { type: String },
      type: { type: String },
      actionable: { type: Boolean, default: false }
    }
  ]
});

// Surge Rule Schema (if not already defined)
const SurgeRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  multiplier: { type: Number, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const SurgeRule = mongoose.model("SurgeRule", SurgeRuleSchema);

// Range-based pricing schema
const RangePricingSchema = new mongoose.Schema({
  fromDistance: { type: Number, required: true, min: 0 }, // Starting distance in km
  toDistance: { type: Number }, // Null means no upper limit (default range)
  baseFare: { type: Number, required: true, min: 0 },
  durationFare: { type: Number, required: true, min: 0 }, // per minute
  distanceFare: { type: Number, required: true, min: 0 }, // per km
  waitingFare: { type: Number, required: true, min: 0 }, // per minute
  baseDuration: { type: Number, required: true, min: 0 }, // minutes included in base
  baseDistance: { type: Number, required: true, min: 0 }, // km included in base
  baseWaitingTime: { type: Number, required: true, min: 0 }, // minutes included in base
  surgeEnabled: { type: Boolean, default: false },
  surgeRule: { type: mongoose.Schema.Types.ObjectId, ref: "SurgeRule" }
}, { _id: false }); // No need for separate IDs for ranges


// Pricing Rule Schema
const PricingRuleSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ["agent_earning", "task_pricing"], 
    required: true 
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  pricingMode: { 
    type: String, 
    enum: ["simple", "range_based"], 
    default: "simple",
    required: true
  },

  // Simple pricing configuration
  simplePricing: {
    baseFare: { type: Number, default: 0, min: 0 },
    durationFare: { type: Number, default: 0, min: 0 },
    distanceFare: { type: Number, default: 0, min: 0 },
    waitingFare: { type: Number, default: 0, min: 0 },
    surgeEnabled: { type: Boolean, default: false },
    surgeRule: { type: mongoose.Schema.Types.ObjectId, ref: "SurgeRule" },
    baseDuration: { type: Number, default: 0, min: 0 },
    baseDistance: { type: Number, default: 0, min: 0 },
    baseWaitingTime: { type: Number, default: 0, min: 0 }
  },

  // Range-based pricing configuration
  ranges: {
    type: [RangePricingSchema],
    validate: {
      validator: function(ranges) {
        if (this.pricingMode === 'range_based' && (!ranges || ranges.length === 0)) {
          return false;
        }
        // Check for default range (where toDistance is null)
        if (this.pricingMode === 'range_based' && !ranges.some(r => r.toDistance === null)) {
          return false;
        }
        return true;
      },
      message: props => {
        if (!props.value || props.value.length === 0) {
          return 'Range-based pricing requires at least one range';
        }
        return 'Range-based pricing requires a default range (with no upper limit)';
      }
    }
  },

  // Other fields remain the same...
}, { _id: false });

// Main Template Schema
const TemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    fields: [FieldSchema],
    pricingRules: [PricingRuleSchema],
    notifications: {
      popupFields: [{ type: String }]
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // or "Merchant"
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = {
  Template: mongoose.model("Template", TemplateSchema),
  SurgeRule
};
