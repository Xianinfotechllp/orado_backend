
const {Notification} = require('../../models/notificationModel')

exports.sendNotification = async (req, res) => {
  try {
    const { userId, sendToAll, title, body, type } = req.body;
    console.log(req.body)
    // Basic validation
    if (!title || !body || !type) {
      return res.status(400).json({ message: "Title, body, and type are required." });
    }

    // If it's a personal notification, userId must be provided
    if (!sendToAll && !userId) {
      return res.status(400).json({ message: "userId is required when sendToAll is false." });
    }

    // Create the notification
    const notification = new Notification({
      userId: sendToAll ? null : userId,
      sendToAll,
      title,
      body,
      type,
      sentAt: new Date()
    });

    await notification.save();

    res.status(201).json({
      message: sendToAll ? "Broadcast notification sent successfully." : "Notification sent to user.",
      notification
    });

  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ message: "Failed to send notification.", error: error.message });
  }
};