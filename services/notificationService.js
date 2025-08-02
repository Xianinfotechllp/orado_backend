const Agent = require("../models/agentModel")
const {sendPushNotification} = require("../utils/sendPushNotification")
const DeviceToken = require("../models/deviceTokenModel");
const admin = require("../config/firebaseAdmin");
const User = require("../models/userModel");
exports.notifyAgentsInServiceArea =  async() =>
{

    try {
        
    } catch (error) {
        
    }

}
exports.sendNotificationToAdmins = async ({ title, body, data = {} }) => {
  try {
    // Step 1: Get users with userType = admin or superAdmin and at least one device token
    const admins = await User.find({
      userType: { $in: ["admin", "superAdmin"] },
      devices: { $exists: true, $ne: [] }
    }).select("devices name");

    // Step 2: Extract all tokens from active devices
    const validTokens = admins
      .flatMap(user =>
        user.devices
          .filter(device => device.token && device.status === "active")
          .map(device => device.token)
      );

    if (!validTokens.length) {
      console.warn("⚠️ No valid device tokens found for admins.");
      return;
    }

    // Step 3: Send FCM notification
    const response = await admin.messaging().sendEachForMulticast({
      tokens: validTokens,
      notification: { title, body },
      data,
    });

    console.log(
      `✅ Admin notification sent: ${response.successCount} success, ${response.failureCount} failed`
    );
  } catch (err) {
    console.error("❌ FCM send error (admin):", err);
  }
};





exports.sendAdminsNotification = async ({ title, body, data = {}, deepLinkUrl }) => {
  try {
    // Find all admin users with active devices
    const adminUsers = await User.find({
      userType: { $in: ['admin', 'superAdmin'] },
      'devices.status': 'active'
    }).select('devices userType name');

    // Separate notification targets
    const notificationTargets = {
      fcmTokens: [],
      webSubscriptions: []
    };

    adminUsers.forEach(user => {
      user.devices.forEach(device => {
        if (device.status !== 'active') return;

        // Handle web push subscriptions
        if (device.platform === 'web' && device.token) {
          try {
            notificationTargets.webSubscriptions.push({
              subscription: JSON.parse(device.token),
              adminName: user.name
            });
          } catch (e) {
            console.error('Invalid web push subscription:', device.token);
          }
        } 
        // Handle mobile FCM tokens
        else if (['android', 'ios'].includes(device.platform)) {
          if (device.token) {
            notificationTargets.fcmTokens.push(device.token);
          }
          // Fallback to fcmToken if exists (backward compatibility)
          else if (device.fcmToken) {
            notificationTargets.fcmTokens.push(device.fcmToken);
          }
        } 
      });
    });

    // Send FCM notifications
    let fcmResponse = { successCount: 0, failureCount: 0 };
    if (notificationTargets.fcmTokens.length > 0) {
      fcmResponse = await admin.messaging().sendEachForMulticast({
        tokens: notificationTargets.fcmTokens,
        notification: { title, body },
        data: {
          ...data,
          ...(deepLinkUrl && { deepLinkUrl }),
          notificationType: 'admin'
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { 'mutable-content': 1 } } }
      });
    }

    // Send Web Push notifications
    let webPushResults = { successCount: 0, failureCount: 0 };
    if (notificationTargets.webSubscriptions.length > 0) {
      const results = await Promise.allSettled(
        notificationTargets.webSubscriptions.map(({ subscription, adminName }) => {
          const payload = {
            title: `${title} (${adminName})`,
            body,
            icon: '/admin-notification-icon.png',
            data: {
              ...data,
              ...(deepLinkUrl && { url: deepLinkUrl }),
              notificationType: 'admin'
            }
          };
          return webpush.sendNotification(subscription, JSON.stringify(payload));
        })
      );
      webPushResults.successCount = results.filter(r => r.status === 'fulfilled').length;
      webPushResults.failureCount = results.filter(r => r.status === 'rejected').length;
    }
    console.log(`✅ Admin notification sent: ${fcmResponse.successCount} FCM success, ${fcmResponse.failureCount} FCM failed`);

    return {
      totalAdmins: adminUsers.length,
      devicesFound: notificationTargets.fcmTokens.length + notificationTargets.webSubscriptions.length,
      fcmResults: fcmResponse,
      webPushResults
    };

  } catch (err) {
    console.error('Admin notification error:', err);
    throw err;
  }
};





// Notification Service for Orders with consistent parameter style
exports.sendOrderNotification = async ({ 
  userId, 
  title, 
  body, 
  orderId, 
  data = {}, 
  deepLinkUrl,
  sound = 'default',
  androidChannel = 'order_notifications',
  notificationType = 'order_update'
}) => {
  try {
    // 1. Get user's FCM token from database
    const user = await User.findById(userId).select('devices');
    if (!user) {
      console.log('User not found');
      return { success: false, error: 'User not found' };
    }

    console.log('User devices:', user.devices);

    // 2. Find active mobile device tokens
    const fcmTokens = user.devices
      .filter(device => 
        device.status === 'active' && 
        ['android', 'ios'].includes(device.platform) && 
        (device.token || device.fcmToken)
      )
      .map(device => device.token || device.fcmToken);

    console.log('FCM Tokens:', fcmTokens);

    if (fcmTokens.length === 0) {
      console.warn(`No active devices found for user ${userId}`);
      return { success: false, error: 'No active devices' };
    }

    // 3. Prepare notification message
    const message = {
      tokens: fcmTokens,
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data, // Spread any additional data
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        orderId: orderId,
        type: notificationType,
        deepLink: deepLinkUrl || `yourapp://orders/${orderId}`
      },
    };

    // 4. Send notification
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Notification sent to ${response.successCount} device(s)`);

    return {
      success: true,
      response: response
    };

  } catch (error) {
    console.error('❌ Notification failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
