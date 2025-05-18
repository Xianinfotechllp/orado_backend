
const User = require('../models/userModel')
const Chat = require("../models/chatModel")
exports.createChat = async (req, res) => {
  try {
    const { userId, agentId, message } = req.body;

    // Validate required fields
    if (!userId || !agentId || !message) {
      return res.status(400).json({
        message: 'userId, agentId, and message are required.',
        messageType: 'failure'
      });
    }

    // Check if User exists
    const user = await User.findById(userId);
    const agent = await User.findById(agentId);

    if (!user || !agent) {
      return res.status(404).json({
        message: 'User or Agent not found.',
        messageType: 'failure'
      });
    }

    // Create new message
    const newChat = new Chat({
      sender: userId,
      receiver: agentId,
      message
    });

    await newChat.save();

    // Return success response
    return res.status(201).json({
      message: 'Message sent successfully.',
      messageType: 'success',
      data:  newChat
    });

  } catch (error) {
    console.error('Error creating chat:', error);
    return res.status(500).json({
      message: 'Server error.',
      messageType: 'failure'
    });
  }
};



exports.getChats = async (req, res) => {
  try {
    const { userId, agentId } = req.body; // get userId and agentId from query params

    if (!userId || !agentId) {
      return res.status(400).json({
        message: 'userId and agentId are required.',
        messageType: 'failure',
      });
    }

    // Find all messages between user and agent sorted by creation time (oldest first)
    const messages = await Chat.find({
      $or: [
        { sender: userId, receiver: agentId },
        { sender: agentId, receiver: userId },
      ],
    }).sort({ createdAt: 1 });

    return res.status(200).json({
      message: 'Messages fetched successfully.',
      messageType: 'success',
      data: messages,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({
      message: 'Server error.',
      messageType: 'failure',
    });
  }
};