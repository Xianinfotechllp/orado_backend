const express = require('express')
const chatController = require('../controllers/chatControllers')
const { protect, checkRole } = require('../middlewares/authMiddleware')
const router = express.Router()

// ========== ADMIN-RESTAURANT CHAT ==========
router.get('/admin/restaurants', chatController.getAdminRestaurantChats);
router.get('/admin/restaurants/:restaurantId', chatController.getAdminRestaurantChat);
router.post('/admin/restaurants/:restaurantId/message', chatController.sendAdminToRestaurantMessage);
router.post('/restaurant/admins/:adminId/message', chatController.sendRestaurantToAdminMessage);

// ========== CUSTOMER-AGENT CHAT ==========
router.get('/agent/users', chatController.getAgentUserChats);
router.get('/agent/users/:userId', chatController.getAgentUserChat);
router.post('/agent/users/:userId/message', chatController.sendAgentToUserMessage);
router.post('/user/agents/:agentId/message', chatController.sendUserToAgentMessage);

// ========== ADMIN-CUSTOMER CHAT ==========
router.get('/admin/users', chatController.getAdminCustomerChats);
router.get('/admin/users/:userId', chatController.getAdminCustomerChat);
router.post('/admin/users/:userId/message', chatController.sendAdminToCustomerMessage);
router.post('/user/admins/:adminId/message', chatController.sendCustomerToAdminMessage);

// ========== ADMIN-AGENT CHAT ==========
router.get('/admin/agents', chatController.getAdminAgentChats);
router.get('/admin/agents/:agentId', chatController.getAdminAgentChat);
router.post('/admin/agents/:agentId/message', chatController.sendAdminToAgentMessage);
router.post('/agent/admins/:adminId/message', chatController.sendAgentToAdminMessage);

// ========== COMMON ==========
router.post('/mark-read/:chatId', chatController.markMessagesAsRead);




module.exports = router