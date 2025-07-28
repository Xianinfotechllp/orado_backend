const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const AgentSelfieSchema = new mongoose.Schema({
  // Reference to the agent who took the selfie
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },

  // URL of the uploaded selfie image
  imageUrl: {
    type: String,
    required: true
  },

  // Timestamp when the selfie was taken (defaults to now)
  takenAt: {
    type: Date,
    default: Date.now
  },

  // Optional device info (e.g., Android / iOS / browser details)
  deviceInfo: {
    type: String
  },

  // Optional location (latitude, longitude) where selfie was taken
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  }
});
AgentSelfieSchema.plugin(mongoosePaginate);
// Create a 2dsphere index for geo queries on selfie location
AgentSelfieSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('AgentSelfie', AgentSelfieSchema);
