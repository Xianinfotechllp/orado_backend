const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  items: [
    {
      ItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
        required: true
      },
      quantity: {
        type: Number,
        default: 1
      },
      selectedOptions: [
        {
          optionName: {
            type: String
          },
          choiceName: {
            type: String
          },
          choicePrice: {
            type: Number,
            default: 0
          }
        }
      ],
      specialInstructions: {
        type: String
      },
      priceAtTimeOfAddition: {
        type: Number,
       
      }
    }
  ],
  promoCode: {
    type: String
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  estimatedDeliveryTime: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Cart', CartSchema);
