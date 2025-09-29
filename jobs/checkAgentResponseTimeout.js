module.exports = (agenda) => {
  agenda.define('checkAgentResponseTimeout', async (job) => {
    console.log(`\n⏰ ========== AGENT RESPONSE TIMEOUT CHECK STARTED ==========`);
    const { orderId, agentId } = job.attrs.data;

    const Order = require('../models/orderModel');
    const Agent = require('../models/agentModel');
    const { notifyNextPendingAgent } = require('../services/allocationService');

    console.log(`📋 Job Details:`);
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Agent ID: ${agentId}`);
    console.log(`   Job ID: ${job.attrs._id}`);
    console.log(`   Started at: ${new Date().toISOString()}`);

    const order = await Order.findById(orderId);
    if (!order) {
      console.log(`❌ ORDER NOT FOUND: ${orderId}`);
      return;
    }
    console.log(`✅ Order found: ${order._id}`);
    console.log(`📊 Order assignment status: ${order.agentAssignmentStatus}`);
    console.log(`🎯 Allocation method: ${order.allocationMethod}`);

    console.log(`\n👥 CURRENT CANDIDATE STATUSES:`);
    order.agentCandidates.forEach((c, i) => {
      const statusEmoji = {
        'pending': '⏳', 
        'queued': '📋', 
        'accepted': '✅', 
        'rejected': '❌', 
        'timed_out': '⏰'
      }[c.status] || '❓';
      
      console.log(`   [${i}] ${statusEmoji} Agent ${c.agent.toString()} - ${c.status} (current: ${c.isCurrentCandidate}, responded: ${c.respondedAt})`);
    });

    const agent = await Agent.findById(agentId);
    if (!agent) {
      console.log(`⚠️ AGENT NOT FOUND: ${agentId}`);
    } else {
      console.log(`✅ Agent found: ${agent.fullName} (${agentId})`);
    }

    const candidate = order.agentCandidates.find(
      (c) => c.agent.toString() === agentId.toString()
    );

    if (!candidate) {
      console.log(`❌ CANDIDATE NOT FOUND: Agent ${agentId} not in candidate list`);
      return;
    }

    console.log(`\n🔍 CHECKING CANDIDATE: ${agent?.fullName || agentId}`);
    console.log(`   Current status: ${candidate.status}`);
    console.log(`   Responded at: ${candidate.respondedAt}`);
    console.log(`   Is current candidate: ${candidate.isCurrentCandidate}`);

    if (candidate.respondedAt) {
      console.log(`✅ ALREADY RESPONDED: Agent already responded with status: ${candidate.status}`);
      console.log(`⏰ TIMEOUT CHECK COMPLETED - No action needed`);
      return;
    }

    console.log(`\n⏰ MARKING AS TIMED OUT...`);
    candidate.status = 'timed_out';
    candidate.respondedAt = new Date();
    candidate.isCurrentCandidate = false;

    await order.save();
    console.log(`✅ Candidate marked as timed_out`);

    console.log(`\n🔄 MOVING TO NEXT AGENT...`);
    const notifyResult = await notifyNextPendingAgent(order, agenda);
    console.log(`📊 notifyNextPendingAgent result:`, notifyResult);

    console.log(`\n📋 UPDATED CANDIDATE STATUSES:`);
    const updatedOrder = await Order.findById(orderId);
    updatedOrder.agentCandidates.forEach((c, i) => {
      const statusEmoji = {
        'pending': '⏳', 
        'queued': '📋', 
        'accepted': '✅', 
        'rejected': '❌', 
        'timed_out': '⏰'
      }[c.status] || '❓';
      
      console.log(`   [${i}] ${statusEmoji} Agent ${c.agent.toString()} - ${c.status} (current: ${c.isCurrentCandidate})`);
    });

    console.log(`\n🎉 ========== TIMEOUT CHECK COMPLETED ==========`);
  });
};