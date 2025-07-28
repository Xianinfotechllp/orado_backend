const Agent = require("../models/agentModel")
const {sendPushNotification} = require("../utils/sendPushNotification")
const DeviceToken = require("../models/deviceTokenModel");
const admin = require("../config/firebaseAdmin");
exports.notifyAgentsInServiceArea =  async() =>
{

    try {
        
    } catch (error) {
        
    }

}
exports.sendNotificationToAdmins = async ({ title, body, data = {} }) => {
  try {
    // Find all device tokens where userType is admin or superAdmin
    const tokensWithUser = await DeviceToken.find()
      .populate({
        path: "userId",
        match: { userType: { $in: ["admin", "superAdmin"] } },
        select: "userType name",
      })
      .select("token");

    // Filter out tokens where userId was not matched (i.e. not admin/superAdmin)
    const validTokens = tokensWithUser
      .filter((t) => t.userId) // userId is null if match fails
      .map((t) => t.token);

    if (!validTokens.length) {
      console.warn("No FCM tokens found for admin/superAdmin users.");
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data,
      tokens: validTokens,
    };

const response = await admin.messaging().sendEachForMulticast({ 
  tokens: validTokens,
  notification: {
    title,
    body,
  },
  data
});
    console.log(
      `✅ Admin notification sent: ${response.successCount} success, ${response.failureCount} failed`
    );
  } catch (err) {
    console.error("❌ FCM send error (admin):", err);
  }
};


