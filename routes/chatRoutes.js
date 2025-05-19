const express = require('express')
const { createChat, getChats } = require('../controllers/chatControllers')
const router = express.Router()
router.post("/send",createChat)
router.post("/getchat",getChats)



module.exports = router