const Ticket = require('../../../../models/ticketModel');
const mongoose = require('mongoose');
// User creates a ticket
exports.createTicket = async (req, res) => {
  try {
    const { subject, priority, message } = req.body;

    if (!subject || !priority || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const validPriorities = ["low", "medium", "high"];
    if (!validPriorities.includes(priority.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority"
      });
    }

    const ticket = new Ticket({
      user: req.user._id,
      subject,
      priority: priority.toLowerCase(),
      message,
      replies: []
    });

    await ticket.save();

    res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: ticket
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to create ticket",
      error: err.message
    });
  }
};


// Add message to ticket (user/admin)
exports.addMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const sender = req.user.userType?.toLowerCase() === "admin" ? "admin" : "user";

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    ticket.replies.push({ sender, message });
    if (["Resolved", "Closed"].includes(ticket.status)) {
      ticket.status = "In Progress"; // Re-open if user responds
    }
    await ticket.save();

    res.status(200).json({ message: "Message added", ticket });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// Admin updates ticket status
exports.updateTicketStatus = async (req, res) => {
  try {

    const { ticketId } = req.params;
    const { status } = req.body;
    const validStatuses = ["open", "in_progress", "resolved", "closed"]

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    ticket.status = status;
    await ticket.save();

    res.status(200).json({ message: "Ticket status updated", ticket });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// Admin fetch all tickets
exports.getAllTickets = async (req, res) => {
  try {
  
    
    const tickets = await Ticket.find()
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ tickets });
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Server error" });
  }
};

// User fetch their tickets
// User fetch their tickets
exports.getMyTickets = async (req, res) => {
  try {
    const userId = req.user._id;
    const tickets = await Ticket.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      message: "Tickets fetched successfully",
      data: tickets
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch tickets",
      error: err.message
    });
  }
};




exports.getTicketById = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user._id;

    // Validate ticketId
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    // Find the ticket by ID and make sure it belongs to the current user
    const ticket = await Ticket.findOne({ _id: ticketId, user: userId }).lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Ticket fetched successfully",
      data: ticket
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch ticket",
      error: err.message
    });
  }
};



