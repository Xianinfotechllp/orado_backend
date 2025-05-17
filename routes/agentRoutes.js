const express = require('express')
const router = express.Router()
const { registerAgent,loginAgent, agentAcceptsOrder,agentRejectsOrder, agentUpdatesOrderStatus, toggleAvailability
} = require("../controllers/agentController")
const { upload } = require('../middlewares/multer');


router.post(
  "/register",
  upload.fields([
    { name: "license", maxCount: 1 },
    { name: "insurance", maxCount: 1 },
    { name: "profilePicture", maxCount: 1 }
  ]),
  registerAgent
);
router.post("/login",loginAgent)

// availability
router.put('/:userId/availability', toggleAvailability);

// delivery routes
router.post('/:agentId/orders/accept',agentAcceptsOrder)
router.post("/:agentId/orders/reject",agentRejectsOrder)
router.put("/:agentId/orders/:orderId/status",agentUpdatesOrderStatus)

    


module.exports = router;
