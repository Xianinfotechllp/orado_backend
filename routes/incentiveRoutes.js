const express = require('express');
const router = express.Router();
const incentivePlanController = require('../controllers/incentivePlanController');

// Create a new incentive plan
router.post('/', incentivePlanController.createIncentivePlan);
router.get("/",incentivePlanController.getIncentivePlans)
router.patch("/:planId/toggle",incentivePlanController.toggleActiveStatus)
// router.get('/', incentivePlanController.getAllIncentivePlans);
// router.delete('/:id', incentivePlanController.deleteIncentivePlan);
// router.patch('/:id/toggle-status', incentivePlanController.toggleIncentivePlanStatus)
// // Get all incentive plans
// router.get('/', incentiveController.getAllIncentivePlans);

// // Get a specific plan by ID
// router.get('/:id', incentiveController.getIncentivePlanById);

// // Update a plan
// router.put('/:id', incentiveController.updateIncentivePlan);

// // Delete a plan
// router.delete('/:id', incentiveController.deleteIncentivePlan);

// // Export using camelCase

module.exports = router;
