const express = require('express')
const router = express.Router()
const { registerAgent,agentAcceptsOrder,agentRejectsOrder, agentUpdatesOrderStatus,
} = require("../controllers/agentController")

router.post("/register",registerAgent)


// delivery routes
router.post('/:agentId/orders/accept',agentAcceptsOrder)
router.post("/:agentId/orders/reject",agentRejectsOrder)
router.put("/:agentId/orders/:orderId/status",agentUpdatesOrderStatus)

    


module.exports = router;