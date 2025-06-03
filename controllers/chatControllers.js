const Chat = require('../models/chatModel');
const User = require('../models/userModel');

// Helper function to find or create chat
const findOrCreateChat = async (participants) => {
  const chat = await Chat.findOne({
    participants: {
      $all: participants.map(p => ({
        $elemMatch: { id: p.id, modelType: p.modelType }
      }))
    },
    $where: `this.participants.length === ${participants.length}`
  });

  if (chat) return chat;

  return await Chat.create({ participants });
};

// ====================== ADMIN-RESTAURANT CHAT ====================== //
exports.getAdminRestaurantChats = async (req, res) => {
  try {
    const adminId = req.user._id;
    const chats = await Chat.find({
      participants: {
        $elemMatch: { id: adminId, modelType: 'admin' }
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
          { $elemMatch: { id: adminId, modelType: 'admin' } },
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
            { id: adminId, modelType: 'admin' },
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

exports.sendAdminToRestaurantMessage = async (req, res) => {
  try {
    const adminId = req.user._id;
    const restaurantId = req.params.restaurantId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { id: adminId, modelType: 'admin' },
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
    const adminId = req.params.adminId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { id: restaurantId, modelType: 'restaurant' },
      { id: adminId, modelType: 'admin' }
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
    req.io.to(`admin_${adminId}`).emit('newMessage', {
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
      'participants.modelType': 'customer'
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
          { $elemMatch: { id: userId, modelType: 'customer' } }
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
            { id: userId, modelType: 'customer' }
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
      { id: userId, modelType: 'customer' }
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
      { id: userId, modelType: 'customer' },
      { id: agentId, modelType: 'agent' }
    ]);

    const newMessage = {
      sender: userId,
      senderModel: 'customer',
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
        $elemMatch: { id: adminId, modelType: 'admin' }
      },
      'participants.modelType': 'customer'
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
          { $elemMatch: { id: adminId, modelType: 'admin' } },
          { $elemMatch: { id: userId, modelType: 'customer' } }
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
            { id: adminId, modelType: 'admin' },
            { id: userId, modelType: 'customer' }
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

exports.sendAdminToCustomerMessage = async (req, res) => {
  try {
    const adminId = req.user._id;
    const userId = req.params.userId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { id: adminId, modelType: 'admin' },
      { id: userId, modelType: 'customer' }
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

exports.sendCustomerToAdminMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const adminId = req.params.adminId;
    const { content, attachments = [] } = req.body;

    const chat = await findOrCreateChat([
      { id: userId, modelType: 'customer' },
      { id: adminId, modelType: 'admin' }
    ]);

    const newMessage = {
      sender: userId,
      senderModel: 'customer',
      content,
      attachments,
      readBy: [userId]
    };

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    // Emit socket event to admin
    req.io.to(`admin_${adminId}`).emit('newMessage', {
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
        $elemMatch: { id: adminId, modelType: 'admin' }
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
          { $elemMatch: { id: adminId, modelType: 'admin' } },
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
            { id: adminId, modelType: 'admin' },
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
      { id: adminId, modelType: 'admin' },
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
    const adminId = req.params.adminId;
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
    req.io.to(`admin_${adminId}`).emit('newMessage', {
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
    const userId = req.user._id;
    const userModel = req.user.userType === 'admin' ? 'admin' : 
                     req.user.userType === 'agent' ? 'agent' : 'customer';

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    // Mark all unread messages as read
    chat.messages.forEach(message => {
      if (!message.readBy.includes(userId)) {
        message.readBy.push(userId);
      }
    });

    await chat.save();

    // Notify other participant
    const otherParticipant = chat.participants.find(
      p => !p.id.equals(userId) || p.modelType !== userModel
    );

    if (otherParticipant) {
      req.io.to(`${otherParticipant.modelType}_${otherParticipant.id}`).emit('messagesRead', {
        chatId, 
        readerId: userId
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};