const express = require('express')
const { createChat, getChats } = require('../controllers/chatControllers')
const { protect, checkRole } = require('../middlewares/authMiddleware')
const router = express.Router()
router.post("/send", protect, checkRole('agent', 'customer'), createChat)
router.post("/getchat", protect, checkRole('agent', 'customer'), getChats)



module.exports = router