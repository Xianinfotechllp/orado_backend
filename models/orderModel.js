const mongoose = require('mongoose');
const orderSchema = mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    restaurantId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
    orderItems:[{
        productId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: Number,
        price: Number,
        name:String,
    }]
,
    orderTime: { type: Date, default: Date.now },
    deliveryTime: Date,
    orderStatus: {
        type: String,
        default: 'pending',
        enum: ['pending', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled']
      },

      totalAmount: Number,
      deliveryCharge: Number,
      tipAmount: Number,
      paymentMethod: { type: String, enum: ['cash', 'online', 'wallet'] },
      paymentStatus: {type: String, enum: ['pending', 'completed', 'failed']},
      customerReview: String,
      restaurantReview: String,
      cancellationReason: String,  // Store reason for cancellation
      debtCancellation: Boolean, //flag for cancellation due to debt
      deliveryMode: {type: String, enum: ['contact', 'no_contact', 'do_not_disturb']},
      location: { type: 'Point', coordinates: [Number, Number] }, // Delivery location
      surgeCharge: Number,
      orderPreparationDelay: Boolean, // Flag for order delay
      scheduledTime: Date, // For scheduled orders
      instructions: String, // Special instructions
      discountAmount: Number, //applied discount
      couponCode: String        
    })

    module.exports = mongoose.model("Order",orderSchema)