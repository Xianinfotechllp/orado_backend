const express = require('express')
const chatController = require('../controllers/chatControllers')
const { protect, checkRole } = require('../middlewares/authMiddleware')
const router = express.Router()

// ========== ADMIN-RESTAURANT CHAT ==========
router.get('/admin/restaurants', protect, chatController.getAdminRestaurantChats);
router.get('/admin/restaurants/:restaurantId', protect, chatController.getAdminRestaurantChat);
router.post('/admin/restaurants/:restaurantId/message', protect, chatController.sendAdminToRestaurantMessage);
router.post('/restaurant/admins/:adminId/message', protect, chatController.sendRestaurantToAdminMessage);

// ========== CUSTOMER-AGENT CHAT ==========
router.get('/agent/users', protect, chatController.getAgentUserChats);
router.get('/agent/users/:userId', protect, chatController.getAgentUserChat);
router.post('/agent/users/:userId/message', chatController.sendAgentToUserMessage);
router.post('/user/agents/:agentId/message', chatController.sendUserToAgentMessage);

// ========== ADMIN-CUSTOMER CHAT ==========
router.get('/admin/users', protect, chatController.getAdminCustomerChats);
router.get('/admin/users/:userId', protect, chatController.getAdminCustomerChat);
router.get('/users/admin', protect, chatController.getCustomerAdminChat);
router.post('/admin/users/:userId/message', protect, chatController.sendAdminToCustomerMessage);
router.post('/user/admins/message', protect, chatController.sendCustomerToAdminMessage);

// ========== ADMIN-AGENT CHAT ==========
router.get('/admin/agents', protect, chatController.getAdminAgentChats);
router.get('/admin/agents/:agentId', protect, chatController.getAdminAgentChat);
router.post('/admin/agents/:agentId/message', protect, chatController.sendAdminToAgentMessage);
router.post('/agent/admins/:adminId/message', protect, chatController.sendAgentToAdminMessage);

// ====================== RESTAURANT-CUSTOMER CHAT ====================== //
router.get('/restaurant/chats', protect, chatController.getRestaurantCustomerChats);
router.get('/restaurant/chat/:userId', protect, chatController.getRestaurantCustomerChat);
router.get('/customer/chat/:restaurantId', protect, chatController.getCustomerRestruantChat);
router.post('/restaurant/user/:userId', protect, chatController.sendRestaurantToCustomerMessage);
router.post('/user/restaurant/:restaurantId', protect, chatController.sendCustomerToRestaurantMessage);


// ========== COMMON ==========
router.post('/mark-read/:chatId', chatController.markMessagesAsRead);




module.exports = router