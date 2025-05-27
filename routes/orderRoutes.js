const express = require('express');
const router = express.Router();

const {
  createOrder,
  getAllOrders,
  getOrderById,
  getOrdersByCustomer,
  getOrdersByAgent,
  updateOrderStatus,
  cancelOrder,
  reviewOrder,
  updateDeliveryMode,
  assignAgent,
  updateScheduledTime,
  updateInstructions,
  applyDiscount,
  getScheduledOrders,
  getCustomerScheduledOrders,
  rescheduleOrder,
  merchantAcceptOrder,
  merchantRejectOrder,
  getOrdersByMerchant,
  getOrderPriceSummary,
  placeOrder
 
  
} = require('../controllers/orderController');
const { upload } = require('../middlewares/multer');
const { protect, checkRole, checkRestaurantPermission } = require('../middlewares/authMiddleware');

// orders
router.post('/create', createOrder); // Create new order
router.get('/', getAllOrders); // Admin - get all orders
router.get('/:orderId', getOrderById); // Get specific order

// customer and agent orders
router.get('/customer/:customerId', getOrdersByCustomer);
router.get('/customer/:customerId/status', getOrdersByCustomer);
router.get('/agent/:agentId', getOrdersByAgent);

// updates and actions on orders
router.put('/:orderId/status', updateOrderStatus);
router.post('/:orderId/cancel', cancelOrder);
router.post(
  '/:orderId/review',
  upload.fields([
    { name: 'customerImages', maxCount: 3 },
    { name: 'restaurantImages', maxCount: 2 },
  ]),
  reviewOrder
);
router.put('/:orderId/delivery-mode', updateDeliveryMode);
router.put('/:orderId/agent', assignAgent);
router.put('/:orderId/scheduled-time', updateScheduledTime);
router.put('/:orderId/instructions', updateInstructions);
router.post('/:orderId/apply-discount', applyDiscount);


//-ordershedules-//
router.get('/admin/scheduled-orders', getScheduledOrders);
router.get('/customer/:customerId/scheduled-orders', getCustomerScheduledOrders); 
// router.put('/reschedule/:orderId', rescheduleOrder);

//merchants actins

router.put('/:orderId/merchant-accept', protect, checkRole('merchant'), checkRestaurantPermission('canAcceptOrder', true), merchantAcceptOrder);
router.put('/:orderId/merchant-reject', protect, checkRole('merchant'), checkRestaurantPermission('canRejectOrder', true), merchantRejectOrder)
// router.get('/restaurant/:restaurantId', protect, checkRole('merchant'), getOrdersByMerchant);
router.get('/restaurant/:restaurantId', getOrdersByMerchant);




//bill summary 
router.post("/order/pricesummary",getOrderPriceSummary)


//place order 
router.post("/order/place-order",placeOrder)

module.exports = router;
