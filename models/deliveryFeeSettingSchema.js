const mongoose = require("mongoose")

const deliveryFeeSettingSchema = new mongoose.Schema({
  city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' }, // optional
  serviceCategory: { type: String, enum: ['food', 'grocery', 'meat'] }, // optional
  feeType: { type: String, enum: ['Fixed', 'Per KM'], required: true },
  baseFee: { type: Number, required: true },
  baseDistanceKm: { type: Number, default: 2 },
  perKmFeeBeyondBase: { type: Number, default: 5 },
  enableSurge: { type: Boolean, default: false },
  surgeFee: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });
module.exports = mongoose.model("DeliveryFeeSetting", deliveryFeeSettingSchema);
