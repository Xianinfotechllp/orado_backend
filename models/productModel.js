    // models/FoodItem.js

    const mongoose = require('mongoose');

    const product = new mongoose.Schema({
      name: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        trim: true
      },
      price: {
        type: Number,
        required: true
      },
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
      },
      restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
      },
      images: {
        type: [String],
        default: []
      },
      active: {
        type: Boolean,
        default: true
      },
      
    preparationTime: {
      type: Number, // in minutes
      default: 10,  // default 10 mins
    },


    availability: {
      type: String,
      enum: ['always', 'time-based','time-range', 'out-of-stock'],
      default: 'always'
    },
    availableAfterTime: {
      type: String, // e.g. '17:00'
      default: null
    },



availableFromTime: {
  type: String, // e.g., '10:00'
  default: null,
},
availableToTime: {
  type: String, // e.g., '11:00'
  default: null,
},

    
      foodType: {
        type: String,
        enum: ['veg', 'non-veg'],
        required: true
      },
      addOns: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AddOn'
      }],
      specialOffer: {
        discount: {
          type: Number,
          default: 0
        },
        startDate: Date,
        endDate: Date
      },
      rating: { 
        type: Number,
        default: 0
      },
    attributes: [
      {
        name: { type: String, required: true }, // e.g. "Apple 1kg" or "500g"
        quantity: { type: Number, required: true }, // e.g. 1, 0.5, 500
        unit: { 
          type: String, 
          enum: ['kg', 'g', 'ltr', 'ml', 'piece'], 
          required: true 
        }, // type of unit
        price: { type: Number, required: true },
        stock: { type: Number, default: 0 }, // stock per variant
        reorderLevel: { type: Number, default: 0 }, // alert level per variant
        calories: Number,
        isAvailable: { type: Boolean, default: true },
        description: { type: String, default: null }
      }
    ],

      unit: {
        type: String,
        default: 'piece'
      },
    minimumOrderQuantity: {
      type: Number,
      default: 1
    },
    maximumOrderQuantity: {
      type: Number,
      default: 100
    },
    costPrice: {
      type: Number,
      default: 0
    },

      enableInventory: {
      type: Boolean,
      default: false, // Disabled by default
    },

    archived: {
  type: Boolean,
  default: false
},
archivedAt: {
  type: Date,
  default: null
},
      stock: {
        type: Number,
        default: 0
      },
      reorderLevel: {
        type: Number,
        default: 0
      },
      revenueShare: {
      type: {
        type: String,
        enum: ['percentage', 'fixed'],

        default: 'percentage'
      },
      value: {
        type: Number,
    
        default: 10 // default 10% if percentage type
      } 
    }
    }, {
      timestamps: true
    });

    module.exports = mongoose.model('Product', product);
