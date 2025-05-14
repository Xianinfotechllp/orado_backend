const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['flash', 'discount', 'coupon', 'custom'], required: true },
  target: { type: String, enum: ['all', 'specific_users', 'specific_merchants', 'location'], required: true },
  targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  targetMerchants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' }],
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  imageUrl: { type: String, trim: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' }
  },
  minOrderAmount: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: 0 }
}, { timestamps: true });

OfferSchema.index({ location: '2dsphere' });

const Offer = mongoose.model('Offer', OfferSchema);
module.exports = Offer;
