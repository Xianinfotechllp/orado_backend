const mongoose = require('mongoose');

const UserTagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const CountryCodeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 2
  },
  dialCode: {
    type: String,
    required: true,
    trim: true
  }
});

const PreferencesSchema = new mongoose.Schema({
  // Basic settings
  countryCode: CountryCodeSchema,
  currency: {
    type: String,
    required: true,
    default: 'USD ($)',
    enum: ['USD ($)', 'EUR (€)', 'GBP (£)']
  },
  currencyFormat: {
    type: String,
    required: true,
    default: 'Default',
    enum: ['Default', 'Symbol First', 'Symbol Last']
  },
  timezone: {
    type: String,
    required: true,
    default: '(UTC+05:00) Ashgabat, Tashkent'
  },
  timeFormat: {
    type: String,
    required: true,
    default: '12Hrs Format',
    enum: ['12Hrs Format', '24Hrs Format']
  },
  dateFormat: {
    type: String,
    required: true,
    default: 'MMMM dd yyyy',
    enum: ['MMMM dd yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy']
  },
  distanceUnit: {
    type: String,
    required: true,
    default: 'KM',
    enum: ['KM', 'Miles']
  },

  // Toggle features
  onlineOfflineTax: { type: Boolean, default: false },
  productShare: { type: Boolean, default: false },
  deliveryAddressConfirmation: { type: Boolean, default: false },
  aerialDistance: { type: Boolean, default: false },
  favoriteRestaurants: { type: Boolean, default: false },
  autoRefund: { type: Boolean, default: false },
  pickupNotifications: { type: Boolean, default: false },
  orderReadyStatus: { type: Boolean, default: false },
  showCommission: { type: Boolean, default: false },
  showProductTags: { type: Boolean, default: false },
  enableHolidayHours: { type: Boolean, default: false },
  virtualMeetTimings: { type: Boolean, default: false },
  customerRating: { type: Boolean, default: false },
  hideCustomerDetails: { type: Boolean, default: false },
  showCustomerProfile: { type: Boolean, default: false },
  showCurrencyToRestaurants: { type: Boolean, default: false },
  showGeofence: { type: Boolean, default: false },
  showGeofenceVirtualMeet: { type: Boolean, default: false },
  servingRadius: { type: Boolean, default: false },
  showAcceptReject: { type: Boolean, default: false },
  showAnalytics: { type: Boolean, default: false },
  customerSeeSameTags: { type: Boolean, default: false },

  // User tags
  userTags: [UserTagSchema],

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
PreferencesSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get or create single preferences document
PreferencesSchema.statics.getPreferences = async function() {
  let preferences = await this.findOne();
  if (!preferences) {
    preferences = await this.create({});
  }
  return preferences;
};

module.exports = mongoose.model('Preferences', PreferencesSchema);