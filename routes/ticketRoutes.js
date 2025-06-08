const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const { protect, checkRole } = require("../middlewares/authMiddleware");

// User routes
router.post("/", protect, checkRole('customer', 'agent'), ticketController.createTicket);
router.get("/my", protect, checkRole('customer', 'agent'), ticketController.getMyTickets);
router.post("/:ticketId/message", checkRole('customer', 'agent'), protect, ticketController.addMessage);

// Admin routes
router.get("/", protect,ticketController.getAllTickets);
router.patch("/:ticketId/status", protect, ticketController.updateTicketStatus);


module.exports = router;