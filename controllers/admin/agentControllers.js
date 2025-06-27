const Agent = require("../../models/agentModel");

exports.getAllAgents = async (req, res) => {
  try {
    const agents = await Agent.find().select(
      "fullName phoneNumber agentStatus.status agentStatus.availabilityStatus"
    );

    const formattedAgents = agents.map((agent) => {
      let derivedStatus = 'Inactive';

     
        if (agent.agentStatus.status === 'AVAILABLE') {
          derivedStatus = 'Free';
        } else if (
          [
            'ORDER_ASSIGNED',
            'ORDER_ACCEPTED',
            'ARRIVED_AT_RESTAURANT',
            'PICKED_UP',
            'ON_THE_WAY',
            'AT_CUSTOMER_LOCATION'
          ].includes(agent.agentStatus.status)
        ) {
          derivedStatus = 'Busy';
        }
      

      return {
        id: agent._id,
        name: agent.fullName,
        phone: agent.phoneNumber,
        status: derivedStatus, // Free / Busy / Inactive
        currentStatus: agent.agentStatus.status,
      };
    });

    res.status(200).json({
      messageType: 'success',
      data: formattedAgents,
    });

  } catch (error) {
    console.error('Error fetching agent list:', error);
    res.status(500).json({
      messageType: 'failure',
      message: 'Failed to fetch agents',
    });
  }
};
