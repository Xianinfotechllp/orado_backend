const Ticket = require('../models/ticketModel');

// User creates a ticket
exports.createTicket = async (req, res) => {
  try {
    const { subject, priority, message } = req.body;

    // All required fields
    if (!subject || !priority || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Priority must be valid enum
    const validPriorities = ["low", "medium", "high"];
    if (!validPriorities.includes(priority.toLowerCase())) {
      return res.status(400).json({ error: "Invalid priority" });
    }

    const ticket = new Ticket({
      user: req.user._id,  // from authenticated user
      subject,
      priority: priority.toLowerCase(),
      message,
      // status will be default "open"
      replies: []
    });

    await ticket.save();
    res.status(201).json({ message: "Ticket created", ticket });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// Add message to ticket (user/admin)
exports.addMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const sender = req.user.role?.toLowerCase() === "admin" ? "admin" : "user";

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    ticket.messages.push({ sender, message });
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
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { ticketId } = req.params;
    const { status } = req.body;
    const validStatuses = ["Open", "In Progress", "Resolved", "Closed"];

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
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ tickets });
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Server error" });
  }
};

// User fetch their tickets
exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ tickets });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
