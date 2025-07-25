// utils/notifyAgent.js
const formatOrder = require('./formatOrder'); // your utility

const notifyAgent = async (agentId, order, io) => {
  const formatted = formatOrder(order, agentId);

  io.to(agentId.toString()).emit("agent:new-order", {
    type: "new-order",
    data: formatted,
  });
};

module.exports = notifyAgent;
