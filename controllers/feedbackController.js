const Feedback = require('../models/feedbackModel');
const Order = require('../models/orderModel');
const Restaurant = require('../models/restaurantModel');
const Agent = require('../models/agentModel');
const { awardPointsToRestaurant, awardDeliveryPoints } = require('../utils/awardPoints');



// 1. Create Feedback
// currently using userid-from body-not using authentication
exports.createFeedback = async (req, res) => {
  try {
    const { orderId, restaurantId, agentId, targetType, rating, comment } = req.body;
    const userId = req.user._id; // Use authenticated user

    if (!['order', 'restaurant', 'agent'].includes(targetType)) {
      return res.status(400).json({ message: 'Invalid targetType' });
    }

    if (!userId || !rating || !targetType) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const feedback = new Feedback({
      userId,
      orderId,
      restaurantId,
      agentId,
      targetType,
      rating,
      comment,
    });

    await feedback.save();

    // Award points for positive feedback (rating >= 4)
    if (targetType === 'restaurant' && rating >= 4 && restaurantId && orderId) {
      try {
        await awardPointsToRestaurant(restaurantId, 5, 'Positive Feedback', orderId);
      } catch (error) {
        console.error('Error awarding points to restaurant:', error);
      }
    }

    // Optionally, award points to agent for positive feedback
    if (targetType === 'agent' && rating >= 4 && agentId && orderId) {
      try {
        await awardDeliveryPoints(agentId, 5, 'Positive Feedback', orderId);
      } catch (error) {
        console.error('Error awarding points to agent:', error);
      }
    }

    return res.status(201).json({ message: 'Feedback submitted', feedback });

  } catch (error) {
    console.error("Feedback Error:", error);
    return res.status(500).json({ message: 'Server error', error });
  }
};

// 2. Get Feedbacks (by target type and ID)
exports.getFeedbacks = async (req, res) => {
  try {
    const { type, id } = req.params; // type: order | restaurant | agent

    const filter = {};
    if (type === 'order') filter.orderId = id;
    else if (type === 'restaurant') filter.restaurantId = id;
    else if (type === 'agent') filter.agentId = id;
    else return res.status(400).json({ message: 'Invalid feedback type' });

    const feedbacks = await Feedback.find(filter).populate('userId', 'name');

    return res.status(200).json(feedbacks);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching feedbacks', error });
  }
};

// 3. Get Average Rating (for restaurant or agent)
exports.getAverageRating = async (req, res) => {
  try {
    const { type, id } = req.params;

    const matchField = type === 'restaurant' ? 'restaurantId' : 'agentId';
    if (!['restaurant', 'agent'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }

    const result = await Feedback.aggregate([
      { $match: { [matchField]: mongoose.Types.ObjectId(id), targetType: type } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          ratingCount: { $sum: 1 }
        }
      }
    ]);

    if (result.length === 0) {
      return res.status(200).json({ averageRating: 0, ratingCount: 0 });
    }

    const { averageRating, ratingCount } = result[0];
    return res.status(200).json({ averageRating, ratingCount });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to get average rating', error });
  }
};

// 4. Update Feedback (optional)
exports.updateFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findOne({ _id: req.params.id, userId: req.user._id });

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found or unauthorized' });
    }

    const { rating, comment } = req.body;
    feedback.rating = rating ?? feedback.rating;
    feedback.comment = comment ?? feedback.comment;

    await feedback.save();

    return res.status(200).json({ message: 'Feedback updated', feedback });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update feedback', error });
  }
};

// 5. Delete Feedback
exports.deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findOne({ _id: req.params.id, userId: req.user._id });

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found or unauthorized' });
    }

    await Feedback.deleteOne({ _id: feedback._id });

    return res.status(200).json({ message: 'Feedback deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete feedback', error });
  }
};

