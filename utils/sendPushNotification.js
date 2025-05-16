const firebaseAdmin = require("../config/firebaseAdmin")
const DeviceToken = require("../models/deviceTokenModel")


async function sendPushNotification(userId, title, body) {
  try {
    const deviceToken = await DeviceToken.findOne({ userId });
    if (!deviceToken || !deviceToken.token) {
      console.log(`No device token found for user ${userId}`);
      return false;
    }

    const message = {
      notification: { title, body },
      token: deviceToken.token,
    };

    const response = await firebaseAdmin.messaging().send(message);
    console.log('Notification sent:', response);
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

module.exports = { sendPushNotification };