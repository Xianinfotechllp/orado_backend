


const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const { protect, isAdmin,checkPermission } = require("../middlewares/authMiddleware");

// // User routes
router.post("/create", protect, ticketController.createTicket);
router.get("/my", protect, ticketController.getMyTickets);
router.post("/:ticketId/message", protect, ticketController.addMessage);

// Admin routes
router.get("/admin/getall", protect, ticketController.getAllTickets);
router.patch("/admin/ticket/:ticketId/status", protect,checkPermission("disputes.manage"), ticketController.updateTicketStatus);



module.exports = router;





