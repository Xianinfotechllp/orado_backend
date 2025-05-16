const express = require('express')
const router = express.Router()
const { registerAgent,agentAcceptsOrder,agentRejectsOrder, agentUpdatesOrderStatus, uploadDocuments
} = require("../controllers/agentController")
const { upload } = require('../middlewares/multer');


router.post("/register",registerAgent)

// upload documents
router.post(
  '/:agentId/upload-documents',
  upload.fields([
    { name: 'license', maxCount: 1 },
    { name: 'insurance', maxCount: 1 }
  ]),
  uploadDocuments
);

// delivery routes
router.post('/:agentId/orders/accept',agentAcceptsOrder)
router.post("/:agentId/orders/reject",agentRejectsOrder)
router.put("/agents/:agentId/orders/:orderId/status",agentUpdatesOrderStatus)

    


module.exports = router;