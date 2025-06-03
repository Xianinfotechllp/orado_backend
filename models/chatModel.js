const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    modelType: {
      type: String,
      enum: ['user', 'admin', 'restaurant', 'agent'],
      required: true
    }
  }],
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    senderModel: {
      type: String,
      enum: ['user', 'admin', 'restaurant', 'agent'],
      required: true
    },
    content: {
      type: String,
      trim: true,
      required: true
    },
    attachments: [{
      url: String,
      type: {
        type: String,
        enum: ['image', 'document', 'other']
      }
    }],
    readBy: [{
      type: mongoose.Schema.Types.ObjectId
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add compound index for participants
chatSchema.index({ 'participants.id': 1, 'participants.modelType': 1 });

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;