const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'itemType'  // dynamically refers to 'Restaurant' or 'Food'
  },
  itemType: {
    type: String,
    required: true,
    enum: ['Restaurant', 'Food']  // add other types here as needed
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Favourite', favouriteSchema);
