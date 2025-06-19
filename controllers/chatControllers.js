const Chat = require('../models/chatModel');
const User = require('../models/userModel');

// Helper function to find or create chat
const findOrCreateChat = async (participants) => {
  const chat = await Chat.findOne({
    participants: {
      $all: participants.map(p => ({
        $elemMatch: { id: p.id, modelType: p.modelType }
      }))
    }
  });

  // Add manual check for exact length match
  if (chat && chat.participants.length === participants.length) {
    return chat;
  }

  return await Chat.create({ participants });
};


// ====================== ADMIN-RESTAURANT CHAT ====================== //
exports.getAdminRestaurantChats = async (req, res) => {
  try {
    const adminId = req.user._id;
    const chats = await Chat.find({
      participants: {
        $elemMatch: {  modelType: 'admin' }
      },
      'participants.modelType': 'restaurant'
    })
    .populate('participants.id', 'name email')
    .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: chats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAdminRestaurantChat = async (req, res) => {
  try {
    const adminId = req.user._id;
    const restaurantId = req.params.restaurantId;

    const chat = await Chat.findOne({
      participants: {
        $all: [
          { $elemMatch: { modelType: 'admin' } },
          { $elemMatch: { id: restaurantId, modelType: 'restaurant' } }
        ]
      }
    })
    .populate('messages.sender', 'name')
    .populate('participants.id', 'name email');

    if (!chat) {
      return res.status(200).json({
        success: true,
        data: {
          participants: [
            { modelType: 'admin' },
            { id: restaurantId, modelType: 'restaurant' }
          ],
          messages: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getRestaurantAdminChat = async (req, res) => {
  try {
    const restaurantId = req.user._id; // Authenticated restaurant

    // Try to find an existing chat
    let chat = await Chat.findOne({
      participants: {
        $all: [
          { $elemMatch: { id: restaurantId, modelType: 'restaurant' } },
          { $elemMatch: { modelType: 'admin' } }
        ]
      }
    })
    .populate('messages.sender', 'name')
    .populate('participants.id', 'name email phone');

    // If chat doesn't exist, create it
    if (!chat) {
      chat = await findOrCreateChat([
        { id: restaurantId, modelType: 'restaurant' },
        { modelType: 'admin' }
      ]);

      // Re-fetch with populated fields
      chat = await Chat.findById(chat._id)
        .populate('messages.sender', 'name')
        .populate('participants.id', 'name email phone');
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error("getRestaurantAdminChat error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.sendAdminToRestaurantMessage = async (req, res) => {
  try {
    const adminId = req.user._id;
    const restaurantId = req.params.restaurantId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { modelType: 'admin' },
      { id: restaurantId, modelType: 'restaurant' }
    ]);

    const newMessage = {
      sender: adminId,
      senderModel: 'admin',
      content,
      attachments,
      readBy: [adminId]
    };

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    // Emit socket event
    req.io.to(`restaurant_${restaurantId}`).emit('newMessage', {
      chatId: chat._id,
      message: newMessage
    });

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sendRestaurantToAdminMessage = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { id: restaurantId, modelType: 'restaurant' },
      { modelType: 'admin' }
    ]);

    const newMessage = {
      sender: restaurantId,
      senderModel: 'restaurant',
      content,
      attachments,
      readBy: [restaurantId]
    };

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    // Emit socket event
    req.io.to('admin_group').emit('newMessage', {
      chatId: chat._id,
      message: newMessage
    });

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ====================== CUSTOMER-AGENT CHAT ====================== //
exports.getAgentUserChats = async (req, res) => {
  try {
    const agentId = req.user._id;
    const chats = await Chat.find({
      participants: {
        $elemMatch: { id: agentId, modelType: 'agent' }
      },
      'participants.modelType': 'user'
    })
    .populate('participants.id', 'name email phone')
    .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: chats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAgentUserChat = async (req, res) => {
  try {
    const agentId = req.user._id;
    const userId = req.params.userId;

    const chat = await Chat.findOne({
      participants: {
        $all: [
          { $elemMatch: { id: agentId, modelType: 'agent' } },
          { $elemMatch: { id: userId, modelType: 'user' } }
        ]
      }
    })
    .populate('messages.sender', 'name')
    .populate('participants.id', 'name email phone');

    if (!chat) {
      return res.status(200).json({
        success: true,
        data: {
          participants: [
            { id: agentId, modelType: 'agent' },
            { id: userId, modelType: 'user' }
          ],
          messages: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUserAgentChat = async (req, res) => {
  try {
    const userId = req.user._id; // Logged-in customer
    const agentId = req.params.agentId;

    const chat = await Chat.findOne({
      participants: {
        $all: [
          { $elemMatch: { id: userId, modelType: 'user' } },
          { $elemMatch: { id: agentId, modelType: 'agent' } }
        ]
      }
    })
    .populate('messages.sender', 'name')
    .populate('participants.id', 'name email phone');

    if (!chat) {
      return res.status(200).json({
        success: true,
        data: {
          participants: [
            { id: userId, modelType: 'user' },
            { id: agentId, modelType: 'agent' }
          ],
          messages: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.sendAgentToUserMessage = async (req, res) => {
  try {
    const agentId = req.user._id;
    const userId = req.params.userId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { id: agentId, modelType: 'agent' },
      { id: userId, modelType: 'user' }
    ]);

    const newMessage = {
      sender: agentId,
      senderModel: 'agent',
      content,
      attachments,
      readBy: [agentId]
    };

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    // Emit socket event
    req.io.to(`user_${userId}`).emit('newMessage', {
      chatId: chat._id,
      message: newMessage
    });

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
exports.sendUserToAgentMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const agentId = req.params.agentId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { id: userId, modelType: 'user' },
      { id: agentId, modelType: 'agent' }
    ]);

    const newMessage = {
      sender: userId,
      senderModel: 'user',
      content,
      attachments,
      readBy: [userId]
    };

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    // Emit socket event to agent
    req.io.to(`agent_${agentId}`).emit('newMessage', {
      chatId: chat._id,
      message: newMessage
    });

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// ====================== ADMIN-CUSTOMER CHAT ====================== //
exports.getAdminCustomerChats = async (req, res) => {
  try {
    const adminId = req.user._id;
    const chats = await Chat.find({
      participants: {
        $all: [
          { $elemMatch: { modelType: 'admin' } },
          { $elemMatch: { modelType: 'user' } }
        ]
      }
    })
    .populate('participants.id', 'name email phone')
    .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: chats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAdminCustomerChat = async (req, res) => {
  try {
    const adminId = req.user._id;
    const userId = req.params.userId;

    const chat = await Chat.findOne({
      participants: {
        $all: [
          { $elemMatch: { modelType: 'admin' } },
          { $elemMatch: { id: userId, modelType: 'user' } }
        ]
      }
    })
    .populate('messages.sender', 'name')
    .populate('participants.id', 'name email phone');

    if (!chat) {
      return res.status(200).json({
        success: true,
        data: {
          participants: [
            { modelType: 'admin' },
            { id: userId, modelType: 'user' }
          ],
          messages: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getCustomerAdminChat = async (req, res) => {
  try {
    const userId = req.user._id; // Customer
    // const adminId = req.params.adminId; // Admin ID passed via URL

    // Try to find existing chat
    let chat = await Chat.findOne({
      participants: {
        $all: [
          { $elemMatch: { id: userId, modelType: 'user' } },
          { $elemMatch: { modelType: 'admin' } }
        ]
      }
    })
      .populate('messages.sender', 'name')
      .populate('participants.id', 'name email phone');

    // If not found, create new chat
    if (!chat) {
      chat = await findOrCreateChat([
        { id: userId, modelType: 'user' },
        { modelType: 'admin' }
      ]);

      // Populate after creation
      chat = await Chat.findById(chat._id)
        .populate('messages.sender', 'name')
        .populate('participants.id', 'name email phone');
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.sendAdminToCustomerMessage = async (req, res) => {
  try {
    const adminId = req.user._id;
    const userId = req.params.userId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      {  modelType: 'admin' },
      { id: userId, modelType: 'user' }
    ]);

    const newMessage = {
      sender: req.user._id,
      senderModel: 'admin',
      content,
      attachments,
      readBy: [adminId]
    };

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    // Emit socket event
    req.io.to(`user_${userId}`).emit('newMessage', {
      chatId: chat._id,
      message: newMessage
    });
    req.io.to(`admin_${adminId}`).emit('messageSent', {
      chatId: chat._id,
      message: newMessage
    });

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sendCustomerToAdminMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    // const adminId = req.params.adminId;
    const { content, attachments = [] } = req.body;
    console.log("Received body:", req.body);

    const chat = await findOrCreateChat([
      { id: userId, modelType: 'user' },
      { modelType: 'admin' }
    ]);

    const newMessage = chat.messages.create({
      sender: userId,
      senderModel: 'user',
      content,
      attachments,
      readBy: [userId]
    });

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    // Emit socket event to admin
    req.io.to('admin_group').emit('newMessage', {
      chatId: chat._id,
      message: newMessage
    });

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// ====================== ADMIN-AGENT CHAT ====================== //
exports.getAdminAgentChats = async (req, res) => {
  try {
    const adminId = req.user._id;
    const chats = await Chat.find({
      participants: {
        $elemMatch: { modelType: 'admin' }
      },
      'participants.modelType': 'agent'
    })
    .populate('participants.id', 'name email phone')
    .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: chats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAdminAgentChat = async (req, res) => {
  try {
    const adminId = req.user._id;
    const agentId = req.params.agentId;

    const chat = await Chat.findOne({
      participants: {
        $all: [
          { $elemMatch: { modelType: 'admin' } },
          { $elemMatch: { id: agentId, modelType: 'agent' } }
        ]
      }
    })
    .populate('messages.sender', 'name')
    .populate('participants.id', 'name email phone');

    if (!chat) {
      return res.status(200).json({
        success: true,
        data: {
          participants: [
            { modelType: 'admin' },
            { id: agentId, modelType: 'agent' }
          ],
          messages: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sendAdminToAgentMessage = async (req, res) => {
  try {
    const adminId = req.user._id;
    const agentId = req.params.agentId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { modelType: 'admin' },
      { id: agentId, modelType: 'agent' }
    ]);

    const newMessage = {
      sender: adminId,
      senderModel: 'admin',
      content,
      attachments,
      readBy: [adminId]
    };

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    // Emit socket event to agent
    req.io.to(`agent_${agentId}`).emit('newMessage', {
      chatId: chat._id,
      message: newMessage
    });

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sendAgentToAdminMessage = async (req, res) => {
  try {
    const agentId = req.user._id;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { id: agentId, modelType: 'agent' },
      { id: adminId, modelType: 'admin' }
    ]);

    const newMessage = {
      sender: agentId,
      senderModel: 'agent',
      content,
      attachments,
      readBy: [agentId]
    };

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    // Emit socket event to admin
    req.io.to('admin_group').emit('newMessage', {
      chatId: chat._id,
      message: newMessage
    });

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// ====================== RESTAURANT-CUSTOMER CHAT ====================== //

exports.getRestaurantCustomerChats = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const chats = await Chat.find({
      participants: {
        $elemMatch: { id: restaurantId, modelType: 'restaurant' }
      },
      'participants.modelType': 'user'
    })
      .populate('participants.id', 'name email phone')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: chats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// get chat for restruant from customer

exports.getRestaurantCustomerChat = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const userId = req.params.userId;

    const chat = await Chat.findOne({
      participants: {
        $all: [
          { $elemMatch: { id: restaurantId, modelType: 'restaurant' } },
          { $elemMatch: { id: userId, modelType: 'user' } }
        ]
      }
    })
      .populate('messages.sender', 'name')
      .populate('participants.id', 'name email phone');

    if (!chat) {
      return res.status(200).json({
        success: true,
        data: {
          participants: [
            { id: restaurantId, modelType: 'restaurant' },
            { id: userId, modelType: 'user' }
          ],
          messages: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// get chat from customer to restruant

exports.getCustomerRestruantChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const restaurantId = req.params.restaurantId;

    // Try to find existing chat
    let chat = await Chat.findOne({
      participants: {
        $all: [
          { $elemMatch: { id: userId, modelType: 'user' } },
          { $elemMatch: { id: restaurantId, modelType: 'restaurant' } }
        ]
      }
    })
      .populate('messages.sender', 'name')
      .populate('participants.id', 'name email phone');

    // If not found, create a new one
    if (!chat) {
      chat = await findOrCreateChat([
        { id: userId, modelType: 'user' },
        { id: restaurantId, modelType: 'restaurant' }
      ]);

      // Populate after creation
      chat = await Chat.findById(chat._id)
        .populate('messages.sender', 'name')
        .populate('participants.id', 'name email phone');
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.sendRestaurantToCustomerMessage = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const userId = req.params.userId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { id: restaurantId, modelType: 'restaurant' },
      { id: userId, modelType: 'user' }
    ]);

    const newMessage = {
      sender: restaurantId,
      senderModel: 'restaurant',
      content,
      attachments,
      readBy: [restaurantId]
    };

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    req.io.to(`user_${userId}`).emit('newMessage', {
      chatId: chat._id,
      message: newMessage
    });

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sendCustomerToRestaurantMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const restaurantId = req.params.restaurantId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { id: userId, modelType: 'user' },
      { id: restaurantId, modelType: 'restaurant' }
    ]);

    const newMessage = chat.messages.create({
      sender: userId,
      senderModel: 'user',
      content,
      attachments,
      readBy: [userId]
    });

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();


    req.io.to(`restaurant_${restaurantId}`).emit('newMessage', {
      chatId: chat._id,
      message: newMessage
    });

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};




// ====================== COMMON FUNCTIONS ====================== //
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    // Try to find matching participant, fallback if admin with no ID
    const participantEntry = chat.participants.find(p =>
      (p.id && p.id.toString() === userId.toString()) ||
      (!p.id && p.modelType === 'admin' && req.user.userType === 'admin' || 'superAdmin')
    );

    if (!participantEntry) {
      return res.status(403).json({ success: false, error: 'You are not part of this chat' });
    }

    const userModel = participantEntry.modelType || req.user.userType;

    // Mark all unread messages as read
    let modified = false;
    chat.messages.forEach(message => {
      if (!message.readBy.some(id => id.toString() === userId.toString())) {
        message.readBy.push(userId);
        modified = true;
      }
    });

    if (modified) {
      chat.markModified('messages');
      await chat.save();
    }

    const otherParticipant = chat.participants.find(
      p => p.id?.toString() !== userId.toString() && p.modelType !== userModel
    );

    if (otherParticipant && req.io) {
      req.io.to(`${otherParticipant.modelType}_${otherParticipant.id}`).emit('messagesRead', {
        chatId,
        readerId: userId
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("🔥 ERROR in markMessagesAsRead:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

