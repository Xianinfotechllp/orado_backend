const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');

// Admin-only routes (use admin middleware if available)
router.post('/create', faqController.createFAQ);
router.delete('/:id', faqController.deleteFAQ);

// Public routes
router.get('/', faqController.getAllFAQs);

module.exports = router;
