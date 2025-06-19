exports.sendNotification = async (req, res) => {
  try {
    const { sendToAll, userId, title, body, type } = req.body;

    // Validate notification type
    const allowedTypes = ['orderUpdates', 'promotions', 'walletCredits', 'newFeatures', 'serviceAlerts'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid notification type." });
    }

    // Validate required fields
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required." });
    }

    if (!sendToAll && !userId) {
      return res.status(400).json({ error: "userId is required when sendToAll is false." });
    }

    // If sending to all
    if (sendToAll) {
      const users = await User.find({}, '_id');

      const notifications = users.map((user) => ({
        userId: user._id,
        sendToAll: true,
        title,
        body,
        type
      }));

      await Notification.insertMany(notifications);

      return res.status(200).json({ message: "Notification sent to all users successfully." });
    }

    // If sending to single user
    const notification = new Notification({
      userId,
      sendToAll: false,
      title,
      body,
      type
    });

    await notification.save();

    return res.status(200).json({ message: "Notification sent to user successfully." });

  } catch (err) {
    console.error("Notification sending error", err);
    res.status(500).json({ error: err.message });
  }
};