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
  placeOrder,
  reorder
  
} = require('../controllers/orderController');
const { upload } = require('../middlewares/multer');
const { protect, checkRole, checkRestaurantPermission } = require('../middlewares/authMiddleware');

// orders
router.post('/create', protect, createOrder); // Create new order
router.get('/', protect, getAllOrders); // Admin - get all orders
router.get('/:orderId', protect, getOrderById); // Get specific order

// customer and agent orders
router.get('/customer/orders', protect, getOrdersByCustomer);
router.get('/customer/:customerId/status', protect, getOrdersByCustomer);
router.get('/agent/:agentId', protect, getOrdersByAgent);

// updates and actions on orders
router.put('/:orderId/status', updateOrderStatus);
router.post('/:orderId/cancel', protect, cancelOrder);
router.post(
  '/:orderId/review',
  upload.fields([
    { name: 'customerImages', maxCount: 3 },
    { name: 'restaurantImages', maxCount: 2 },
  ]), protect,
  reviewOrder
);
router.put('/:orderId/delivery-mode', protect, updateDeliveryMode);
router.put('/:orderId/agent', protect, assignAgent);
router.put('/:orderId/scheduled-time', protect, updateScheduledTime);
router.put('/:orderId/instructions', protect, updateInstructions);
router.post('/:orderId/apply-discount', protect, applyDiscount);


//-ordershedules-//
router.get('/admin/scheduled-orders', protect, getScheduledOrders);
router.get('/customer/:customerId/scheduled-orders', protect, getCustomerScheduledOrders); 
// router.put('/reschedule/:orderId', rescheduleOrder);

//merchants actins

router.put('/:orderId/merchant-accept', protect, checkRole('merchant'), checkRestaurantPermission('canAcceptOrder', true), merchantAcceptOrder);
router.put('/:orderId/merchant-reject', protect, checkRole('merchant'), checkRestaurantPermission('canRejectOrder', true), merchantRejectOrder)
// router.get('/restaurant/:restaurantId', protect, checkRole('merchant'), getOrdersByMerchant);
router.get('/restaurant/:restaurantId', protect, getOrdersByMerchant);




//bill summary 


router.post("/pricesummary", protect, getOrderPriceSummary)


//place order 
router.post("/place-order",  placeOrder)

// Reorder route
router.post('/reorder/:orderId', protect, reorder);







module.exports = router;
