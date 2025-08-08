module.exports = (agenda) => {
  agenda.define('checkAgentResponseTimeout', async (job) => {
    const { orderId, agentId } = job.attrs.data;

    const Order = require('../models/orderModel');
    const Agent = require('../models/agentModel');
    const { notifyNextPendingAgent } = require('../services/allocationService');

    console.log(`\n=== checkAgentResponseTimeout Job started ===`);
    console.log(`Job data: orderId=${orderId}, agentId=${agentId}`);

    const order = await Order.findById(orderId);
    if (!order) {
      console.log(`⚠️ Order ${orderId} not found`);
      return;
    }

    console.log(`Order found. Agent candidates statuses BEFORE timeout:`);
    order.agentCandidates.forEach((c, i) => {
      console.log(`  [${i}] Agent ${c.agent.toString()} - status: ${c.status}, respondedAt: ${c.respondedAt}, isCurrentCandidate: ${c.isCurrentCandidate}`);
    });

    const agent = await Agent.findById(agentId);
    if (!agent) {
      console.log(`⚠️ Agent ${agentId} not found`);
      // You might want to handle this case (e.g. mark candidate timed out or skip)
    } else {
      console.log(`Agent found: ${agent.fullName}`);
    }

    const candidate = order.agentCandidates.find(
      (c) => c.agent.toString() === agentId.toString()
    );

    if (!candidate) {
      console.log(`⚠️ Agent candidate ${agentId} not found for order ${orderId}`);
      return;
    }

    if (candidate.respondedAt) {
      console.log(`✅ Agent ${agentId} already responded to order ${orderId}, status: ${candidate.status}`);
      return;
    }

    // Mark candidate as timed out
    candidate.status = 'timed_out';
    candidate.respondedAt = new Date();
    candidate.isCurrentCandidate = false; // clear current candidate flag

    await order.save();

    console.log(`\nAfter marking timed_out:`);
    order.agentCandidates.forEach((c, i) => {
      console.log(`  [${i}] Agent ${c.agent.toString()} - status: ${c.status}, respondedAt: ${c.respondedAt}, isCurrentCandidate: ${c.isCurrentCandidate}`);
    });

    console.log(`⏱️ Agent ${agent ? agent.fullName : agentId} did NOT respond in time. Moving to next agent...`);

    // Notify the next candidate in line
    const notifyResult = await notifyNextPendingAgent(order);
    console.log(`notifyNextPendingAgent result:`, notifyResult);

    console.log(`=== checkAgentResponseTimeout Job finished ===\n`);
  });
};
