const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  permissions: {
    canManageMenu: {
      type: Boolean,
      default: false
    },
    canAcceptOrder: {
      type: Boolean,
      default: false
    },
    canRejectOrder: {
      type: Boolean,
      default: false
    },
    canManageOffers: {
      type: Boolean,
      default: false
    },
    canViewReports: {
      type: Boolean,
      default: false
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Permission', permissionSchema);