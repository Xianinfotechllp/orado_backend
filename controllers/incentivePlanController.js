
const IncentivePlan= require("../models/IncentiveRuleModel");

const Joi = require('joi');










// Joi Validation Schema
const incentivePlanSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .max(100)
    .messages({
      'string.empty': 'Plan name is required',
      'string.max': 'Plan name cannot exceed 100 characters'
    }),
  
  description: Joi.string()
    .trim()
    .allow('')
    .max(500)
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  
  period: Joi.string()
    .valid('daily', 'weekly', 'monthly')
    .required()
    .messages({
      'any.only': 'Invalid period type'
    }),
  
  conditions: Joi.array()
    .min(1)
    .items(
      Joi.object({
        conditionType: Joi.string()
          .valid('earnings', 'deliveries')
          .required()
          .messages({
            'any.only': 'Invalid condition type'
          }),
        
        threshold: Joi.number()
          .greater(0)
          .required()
          .messages({
            'number.base': 'Threshold must be a number',
            'number.greater': 'Threshold must be a positive number'
          }),
        
        incentiveAmount: Joi.number()
          .greater(0)
          .required()
          .messages({
            'number.base': 'Incentive amount must be a number',
            'number.greater': 'Incentive amount must be a positive number'
          })
      })
    )
    .required()
    .messages({
      'array.min': 'At least one condition is required'
    }),
  
  validFrom: Joi.date()
    .iso()
    .default(Date.now)
    .messages({
      'date.base': 'Invalid start date format'
    }),
  
validTo: Joi.date()
  .iso()
  .min(Joi.ref('validFrom'))
  .allow(null, '') // Allow both null and empty string
  .optional()
  .messages({
    'date.base': 'End date must be a valid date (YYYY-MM-DD)',
    'date.iso': 'End date must be in ISO format (YYYY-MM-DD)',
    'date.min': 'End date must be after start date'
  })
});



/**
 * @desc    Create a new incentive plan (Admin only)
 * @route   POST /api/admin/incentive-plans
 * @access  Private/Admin
 */
exports.createIncentivePlan = async (req, res) => {
  try {
    // Validate request using Joi
    const { error, value } = incentivePlanSchema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, '')
      }));
      
      return res.status(400).json({ 
        success: false,
        errors: errorMessages 
      });
    }

    const { 
      name, 
      description, 
      period, 
      conditions, 
      validFrom, 
      validTo 
    } = value; // Use the validated value

    // Check for overlapping plans with the same name
    const existingPlan = await IncentivePlan.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      isActive: true 
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: 'An active incentive plan with this name already exists'
      });
    }

    // Create the new incentive plan
    const newPlan = new IncentivePlan({
      name,
      description,
      period,
      conditions,
      validFrom: validFrom || Date.now(),
  validTo: validTo === '' ? null : validTo, // Convert empty string to null
      isActive: true

    });

    await newPlan.save();

    res.status(201).json({
      success: true,
      message: 'Incentive plan created successfully',
      data: newPlan
    });

  } catch (error) {
    console.error('Error creating incentive plan:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating incentive plan',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
exports.getIncentivePlans = async (req, res) => {
  try {
    // Pagination params
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Optional filters
    const filter = {};
    if (req.query.period) filter.period = req.query.period;
    if (req.query.isActive) filter.isActive = req.query.isActive === 'true';

    // Optional search by name
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }

    // Sorting (default: newest first)
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const [plans, total] = await Promise.all([
      IncentivePlan.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      IncentivePlan.countDocuments(filter)
    ]);

    res.json({
      data: plans,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching incentive plans:', err);
    res.status(500).json({ error: 'Server error fetching incentive plans' });
  }
};



exports.toggleActiveStatus = async (req, res) => {
  try {
    const { planId } = req.params;
    
    // Find the plan and toggle its status
    const plan = await IncentivePlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ 
        success: false,
        message: 'Incentive plan not found' 
      });
    }

    // Toggle the isActive status
    plan.isActive = !plan.isActive;
    await plan.save();

    res.status(200).json({
      success: true,
      message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: plan._id,
        name: plan.name,
        isActive: plan.isActive,
        updatedAt: plan.updatedAt
      }
    });

  } catch (error) {
    console.error('Error toggling incentive plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


exports.deleteIncentivePlan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;

    // 1. Verify plan exists
    const plan = await IncentivePlan.findById(id).session(session);
    if (!plan) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Incentive plan not found'
      });
    }

    // 2. Delete all associated agent progress records
    await AgentIncentiveProgress.deleteMany({ planId: id }).session(session);

    // 3. Delete the plan itself
    await IncentivePlan.findByIdAndDelete(id).session(session);

    // 4. Commit the transaction
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Incentive plan and all associated records deleted successfully',
      deletedPlan: {
        id,
        name: plan.name,
        period: plan.period,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error deleting incentive plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete incentive plan',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};