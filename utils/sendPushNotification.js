const firebaseAdmin = require("../config/firebaseAdmin")
const DeviceToken = require("../models/deviceTokenModel")
const {Notification, NotificationPreference} = require('../models/notificationModel');

async function sendPushNotification(userId, title, body, type) {
  try {
    // Validate preferences before sending
    const pref = await NotificationPreference.findOne({ userId });
    if (!pref || !pref[type]) {
      console.log(`Notification type '${type}' disabled for user ${userId}`);
      return false;
    }

    const deviceToken = await DeviceToken.findOne({ userId });
    if (!deviceToken?.token) {
      console.log(`No device token for user ${userId}`);
      return false;
    }

    const message = {
      notification: { title, body },
      token: deviceToken.token,
    };

    const response = await firebaseAdmin.messaging().send(message);
    console.log('Notification sent:', response);

    // Save notification with type
    await Notification.create({ userId, title, body, type });

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}



module.exports = { sendPushNotification };