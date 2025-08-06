// jobs/checkAgentResponseTimeout.js
module.exports = (agenda) => {
  agenda.define('checkAgentResponseTimeout', async (job) => {
    const { orderId, agentId } = job.attrs.data;

    const Order = require('../models/orderModel');
    const Agent = require('../models/agentModel');
    const { notifyNextPendingAgent } = require('../services/allocationService'); // Update path
     console.log(`Job data: orderId=${orderId}, agentId=${agentId}`);
    const order = await Order.findById(orderId);
    const agent = await Agent.findById(agentId)
    
    if (!order) return;

    const candidate = order.agentCandidates.find(c => c.agent.toString() === agentId.toString());

    if (!candidate) {
      console.log(`⚠️ Agent ${agentId} not found for order ${orderId}`);
      return;
    }

    // Already responded? Do nothing
    if (candidate.respondedAt) {
      console.log(`✅ Agent ${agentId} already responded to order ${orderId}`);
      return;
    }

    // Mark agent as timed out
    candidate.status = 'timed_out';
    candidate.respondedAt = new Date();

    // Update overall status if needed
    // order.agentAssignmentStatus = 'rejected_due_to_timeout';

    await order.save();

    console.log(`⏱️ Agent ${agent.fullName} did NOT respond in time. Moving to next agent...`);

    // Move to next candidate
    await notifyNextPendingAgent(order);
  });
};
