const express = require("express");
const router = express.Router();
const schedule = require('node-schedule');
const {
  adminLogin, getPendingAgentRequests, approveAgentApplication, getPendingRestaurantApprovals,
  updateRestaurantApprovalStatus, logoutAdmin, logoutAll, getPendingChangeRequests, getPermissions,
  updatePermissions, reviewChangeRequest, createAdmin, deleteAdmin, updateAdminPermissions,
  getAllAdmins, getAllAgentPermissionRequests, handleAgentPermissionRequest, getAllAccessLogs,
  getMyLogs,  updatePermissionsRestuarants, getRestaurantsWithPermissions,
  updateRestaurant, getRestaurantCategory, createCategory, getCategoryProducts, createProduct,updateProduct,
  updateCategory,
  deleteCategory,
getApprovedRestaurants ,
saveFcmToken,




   getAdminProfileById, updateAdminProfile, updateAdminPassword, getOrdersByCustomerAdmin
   ,sendPushNotification
  
} = require("../controllers/adminController");
const {refundToWallet, getAllRefundTransactions} = require('../controllers/walletController')
const {getAllMerchants} = require("../controllers/admin/merchantContollers")
const {createSurgeArea, getSurgeAreas ,  toggleSurgeAreaStatus,deleteSurgeArea } = require("../controllers/admin/surgeController")
const {terminateAgent, giveWarning, getAllLeaveRequests, processLeave, approveApplication, rejectApplication,
  getAgentSelfies,getAgentSelfieHistory,getSelfieDetails,
  getAgentCODSummary
} = require("../controllers/admin/agentControllers")
const notificationService = require("../services/notificationService");
const { importMenuFromExcel,setRestaurantCommission, getAllRestaurantsDropdown, getAllRestaurants, getAllRestaurantsForMap ,getRestaurantById, getProductsByRestaurant} = require("../controllers/admin/restaurantController");
const { getUserStats } = require("../controllers/admin/userController");

const { getRestaurantStats  } = require("../controllers/admin/restaurantController");

const {getActiveOrdersStats,getSimpleRectOrderStats, getAdminOrders, getAllOrderLocationsForMap, getAgentOrderDispatchStatuses, getOrderDetails,updateOrderStatus, getOrderLocationsByPeriod} = require("../controllers/admin/orderController")
const { protect, checkRole, checkPermission } = require('../middlewares/authMiddleware');
const { upload } = require("../middlewares/multer");
const {createRestaurant} = require("../controllers/admin/restaurantController")

const {createOffer,getAllOffers,getRestaurantsWithOffersAggregated} = require("../controllers/offerController");
const { addTax, getAllTaxes, deleteTax, editTax, toggleTaxStatus,updateDeliveryFeeSettings, getDeliveryFeeSettings} = require("../controllers/admin/taxAndFeeSettingController");
const {sendNotification} = require('../controllers/admin/notificationControllers');
const { getAllCustomers, getSingleCustomerDetails, getOrdersByCustomerForAdmin } = require("../controllers/admin/customerControllers");
const { getAllAgents, manualAssignAgent ,sendNotificationToAgent,getAllList, reviewAgentSelfie} = require("../controllers/admin/agentControllers");
const { updateAllocationSettings, getAllocationSettings, updateAutoAllocationStatus, toggleAutoAllocationStatus } = require("../controllers/allowcationController");
const { createRole, getAllRoles, getRoleById, updateRole, deleteRole } = require("../controllers/admin/roleControllers");
const { createManager, getAllManagers, getManagerById, updateManager, deleteManager } = require("../controllers/admin/managerController");
// Authentication routes
router.post("/login", adminLogin);
router.post("/logout", protect, checkRole('admin', 'superAdmin'), logoutAdmin);
router.post("/logout-all", protect, checkRole('admin', 'superAdmin'), logoutAll);

router.post("/creat-restaurant",upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'fssaiDoc', maxCount: 1 },
    { name: 'gstDoc', maxCount: 1 },
    { name: 'aadharDoc', maxCount: 1 }
  ]),createRestaurant)

// Admin management routes (superAdmin only)
router.post("/create-admin", protect, checkRole('superAdmin'), createAdmin);
router.delete("/delete-admin/:adminId", protect, checkRole('superAdmin'), deleteAdmin);
router.put("/update-admin/:adminId", protect, checkRole('superAdmin'), updateAdminPermissions);
router.get("/admins", protect, checkRole('superAdmin'), getAllAdmins);

// Agent management routes
router.get("/agent-requests", protect, checkPermission('agents.manage'), getPendingAgentRequests);
router.post("/agent-application/:userId/approve", protect, checkPermission('agents.manage'), approveAgentApplication);
router.get('/agent-permissions/requests', protect, checkPermission('agents.manage'), getAllAgentPermissionRequests);
router.post('/agent-permissions/review', protect, checkPermission('agents.manage'), handleAgentPermissionRequest);

// Restaurant management routes
router.get("/restaurant-requests", protect, checkPermission('merchants.manage'), getPendingRestaurantApprovals);
router.post("/restaurant-application/:restaurantId/update", protect, checkPermission('merchants.manage'), updateRestaurantApprovalStatus);
router.get("/restaurant/:restaurantId", protect, checkRole('admin', 'superAdmin'), getRestaurantById);
router.put("/edit/restaurant/:restaurantId",upload.array("images",5), protect, checkRole('admin', 'superAdmin'), updateRestaurant);




// Restaurant permissions
router.get('/permissions/:restaurantId', protect, checkPermission('merchants.manage'), getPermissions);
router.put('/permissions/:restaurantId', protect, checkPermission('merchants.manage'), updatePermissions);
router.put("/restuarants/permissions", protect, checkPermission('merchants.manage'), updatePermissionsRestuarants);
router.get("/getrestuarants/permissions", protect, checkPermission('merchants.manage'), getRestaurantsWithPermissions);

// Restaurant change requests
router.get('/change-requests/pending', protect, checkPermission('merchants.manage'), getPendingChangeRequests);
router.post('/change-requests/:requestId/review', protect, checkPermission('merchants.manage'), reviewChangeRequest);

// Restaurant menu/category management
router.get("/restaurant/:restaurantId/category", protect, getRestaurantCategory);
router.post("/restaurant/:restaurantId/category", protect, upload.array('images', 5), createCategory);
router.put("/restaurant/:restaurantId/category/:categoryId", protect, upload.array('images', 5), updateCategory)
router.delete("/restaurant/:restaurantId/category/:categoryId", protect, upload.array('images', 5), deleteCategory)


router.get('/products/by-restaurant/:restaurantId', getProductsByRestaurant);

router.get("/restaurant/:restaurantId/category/:categoryId", protect, getCategoryProducts);
router.post("/restaurant/:restaurantId/product", protect, upload.array('images', 5), createProduct);

router.put("/restaurant/:restaurantId/product/:productId",protect, upload.array('images', 5), updateProduct)
router.post("/restaurant/menu/import-excel",  protect,upload.single("file"), importMenuFromExcel);

// Access logs
router.get("/access-logs", protect, checkRole('superAdmin'), getAllAccessLogs);
router.get("/access-logs/me", protect, checkRole('admin', 'superAdmin'), getMyLogs);

// Stats routes
router.get("/user/user-stats", getUserStats);
router.get("/restaurant/stats/restaurant-stats", getRestaurantStats);
router.get("/order/order-stats", getActiveOrdersStats);
router.get("/order/order-stats/recent",getSimpleRectOrderStats)


// Set restaurant commission (admin only)
router.patch("/restaurant/:restaurantId/commission", setRestaurantCommission); 

router.get("/restaurant/approved/list",getApprovedRestaurants)


// Admin Profile
router.get('/profile', protect, getAdminProfileById);
router.put('/profile', protect, updateAdminProfile);
router.put('/profile/password', protect, updateAdminPassword);

// Refund for a order 
router.post("/wallet/refund", protect, refundToWallet)
router.get("/refund/transactions", protect, getAllRefundTransactions)
// getOrderByCustomer
router.get("/customer-orders/:userId", protect, getOrdersByCustomerAdmin)

router.get("/merchant/getallmerchants",getAllMerchants)



router.post("/offer",createOffer)
router.get("/offer",getAllOffers)

router.get("/restaurants/offer-list",getRestaurantsWithOffersAggregated)

//surge
router.post("/surge/add",createSurgeArea)
router.get("/surge-list",getSurgeAreas)
router.patch("/surge-areas/:surgeAreaId/toggle-status", toggleSurgeAreaStatus);
router.delete("/surge-areas/:surgeAreaId",deleteSurgeArea)

//delivery fee
router.put("/settings/delivery-fee",updateDeliveryFeeSettings)
router.get("/settings/delivery-fee",getDeliveryFeeSettings)


//tax and feees 
router.post("/taxes",addTax)
router.get("/taxes",getAllTaxes)
router.delete("/taxes/:taxId",deleteTax)
router.patch("/taxes/:taxId",editTax)
router.patch("/taxes/:taxId/toggle",toggleTaxStatus)


//send broadcast notification

router.post('/notifications',sendNotification)




//get all order by admin
router.get("/order-list",getAdminOrders)
router.get("/order-details/:orderId",getOrderDetails)

router.get("/customer-list",getAllCustomers)
router.get("/customer/:customerId/details",getSingleCustomerDetails)

//get a cutsomer order details 
router.get("/orders/by-customer",getOrdersByCustomerForAdmin)


//rest list for drop down 

router.get("/restaurants/dropdown-list",getAllRestaurantsDropdown)

//get restuat list for table in admin 
router.get("/restaurants/table-list",getAllRestaurants)
router.get('/restaurants/details/:id',getRestaurantById)
//get restuat lsit forn map 

router.get("/restaurants/location-map",getAllRestaurantsForMap)

//get all delieveryed lcoaiont for map
router.get("/orders/location-map",getAllOrderLocationsForMap)
router.patch("/orders/:orderId/status",updateOrderStatus)


router.get("/order/dispatch-status",getAgentOrderDispatchStatuses)


router.get("/agent/list",getAllList)
router.post("/agent/send-notification",sendNotificationToAgent)
// alowcation controller for agent 
router.post("/agent/manual-assign",manualAssignAgent)



router.put("/allocation-settings", updateAllocationSettings);

router.get("/allocation-settings",getAllocationSettings)
router.patch('/allocation-settings/toggle-auto-allocation', toggleAutoAllocationStatus);



//role curd 
router.post("/role",createRole)
router.get("/role",getAllRoles)
router.get("/role/:roleId",getRoleById)
router.put("/role/:roleId",updateRole)
router.delete("/role/:roleId",deleteRole)

//maneer routes

router.post("/manager",createManager)
router.get("/manager",getAllManagers)
router.get("/manager/:managerId",getManagerById)
router.put("/manager/:managerId",updateManager)
router.delete("/manager/:managerId",deleteManager)


// give warning to agent
router.post("/agent/:agentId/give-warning", protect, checkRole('admin'), giveWarning);
router.post("/agent/:agentId/terminate", protect, checkRole('admin'), terminateAgent);



///agenr approve

router.patch('/agent/:agentId/approve', protect, approveApplication);
router.patch('/agent/:agentId/reject',protect, rejectApplication);

router.get("/agent/getAll",getAllAgents)
  ///ager selie


router.get('/agent/selfies', getAgentSelfies);
router.get('/agent/selfies/:id', getSelfieDetails);
router.get('/agent/:agentId/selfies', getAgentSelfieHistory);
router.patch('/agent/selfie/:id/review', protect, reviewAgentSelfie);



//push notificton to user agetn restu
router.post('/send-push-notification', upload.single("image"),sendPushNotification)





const admin = require('../config/firebaseAdmin');
const { addAgentEarnigsSetting, getAgentEarningsSettings } = require("../controllers/admin/agentEarnigsettings");
// const fcmToken ='fuSZmmKPQq66p53WOmBE0n:APA91bFLxmPN6DYQudlk81dmo45EF-jbux16F_E9bHsTQFEnPeq_BXyUZMSeCQCTzCdzxo2XxST_wTXEYrVHnvvBpxAn2dmWqa2NgykT1LSXqw6EGwuDVAA';
router.get('/send-test-notification', async (req, res) => {
  



  const fcmToken = req.query.token



  await notificationService.sendNotificationToAdmins({title:"hello",body:"mew order from amal"})
  // console.log('Sending notification to', fcmToken);
  const message = {
    token: fcmToken,
    notification: {
      title: '🛵 New Order from McDonalds',
      body: '  New Order from McDonalds 3 items - ₹250. Tap to view details',
    },
    webpush: {
      fcmOptions: {
        link: 'https://your-app.com/order-details', // Replace with your frontend URL
      },
    },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      orderId: 'ORD12345',
    },
  };

  try {
    // const response = await admin.messaging().send(message);
    console.log('✅ Notification sent:');
    res.json({ success: true, message: 'Notification sent'  });
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



router.post("/test-not", async (req, res) => {
  try {
    const { userId, testScenario } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    let notificationPayload;
    
    // Define different test scenarios
    switch(testScenario) {
      case 'order_placed':
        notificationPayload = {
          title: 'Test Order Placed',
          body: 'Your test order has been placed successfully',
          orderId: 'test_order_123',
          data: {
            orderStatus: 'placed',
            testData: 'This is a test order placement notification'
          }
        };
        break;
        
      case 'order_status_update':
        notificationPayload = {
          title: 'Test Order Update',
          body: 'Your test order status has been updated',
          orderId: 'test_order_123',
          data: {
            orderStatus: 'preparing',
            testData: 'This is a test order status update'
          }
        };
        break;
        
      case 'delivery_assignment':
        notificationPayload = {
          title: 'Test Delivery Agent',
          body: 'John D. has been assigned to deliver your order',
          orderId: 'test_order_123',
          data: {
            orderStatus: 'agent_assigned',
            agentName: 'John D.',
            agentContact: '+1234567890'
          }
        };
        break;
        
      default:
        notificationPayload = {
          title: 'Test Notification',
          body: 'This is a test notification from the server',
          orderId: 'test_order_123',
          data: {
            testData: 'Default test notification payload'
          }
        };
    }

    // Call your notification service
    const result = await notificationService.sendOrderNotification({
      userId: userId,
      ...notificationPayload
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Test notification sent successfully',
        details: {
          devices: result.response.successCount,
          scenario: testScenario || 'default',
          payload: notificationPayload
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to send test notification',
        error: result.error
      });
    }

  } catch (error) {
    console.error('Test notification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during notification test',
      error: error.message
    });
  }
})



router.post("/save-fcm-token", protect, checkRole('admin'),saveFcmToken)



// Agent leave management
router.get('/agent/leaves',getAllLeaveRequests);
router.post('/agent/:agentId/leaves/:leaveId/decision', protect, checkRole('admin'), processLeave);



//agent earnigs settings
router.post('/agent-earnings/settings',addAgentEarnigsSetting)
router.get('/agent-earnings/settings',getAgentEarningsSettings)
//cod llimt of agetns
router.get("/agent-cod-summray",getAgentCODSummary)



// improve code for show lociont in map
router.get("/orders/locations",getOrderLocationsByPeriod)
module.exports = router;

