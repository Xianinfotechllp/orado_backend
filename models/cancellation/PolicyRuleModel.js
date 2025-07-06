const mongoose = require('mongoose');

const policyRuleSchema = new mongoose.Schema({
  fixedCharge: {
    type: Number,
    min: 0,
    required: true
  },
  percentCharge: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  threshold: {
    type: String, // like '5 minutes', '10 minutes', etc.
    required: true
  }
});

module.exports = policyRuleSchema; // embedded schema
