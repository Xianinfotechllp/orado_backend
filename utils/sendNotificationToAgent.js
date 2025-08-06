const Agent = require("../models/agentModel");
const Order = require("../models/orderModel")


const AgentNotification = require('../models/AgentNotificationModel');
const admin = require('../config/firebaseAdmin'); 
const sendNotificationToAgent = async ({ agentId, title, body, data = {} }) => {
  const agent = await Agent.findById(agentId);
  if (!agent || !agent.fcmTokens || agent.fcmTokens.length === 0) {
    console.warn(`⚠️ No FCM tokens for agent ${agentId}`);
    return { status: 'no_tokens' };
  }

  const messages = agent.fcmTokens.map(tokenObj => ({
    token: tokenObj.token,
    notification: { title, body },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      ...data,
    },
  }));

  const responses = await Promise.allSettled(
    messages.map(msg => admin.messaging().send(msg))
  );

  await AgentNotification.create({
    agentId,
    title,
    body,
    data,
  });

  return responses;
};


module.exports = sendNotificationToAgent
