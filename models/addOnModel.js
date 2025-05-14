const mongoose = require('mongoose');

const AutoOnOffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    default: ''
  }
}, { timestamps: true });

const AutoOnOff = mongoose.model('AddOn', AutoOnOffSchema);

module.exports = AutoOnOff;
