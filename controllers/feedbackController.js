const Feedback = require('../models/feedbackModel');
const Order = require('../models/orderModel');
const Restaurant = require('../models/restaurantModel');
const Agent = require('../models/agentModel');
const ProductReview = require("../models/productReviewModel");
const Product = require("../models/productModel")
const mongoose = require("mongoose")
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



exports.getRestaurantReviews = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return res.status(400).json({ message: 'restaurantId is required' });
    }

    const reviews = await Feedback.find({
      restaurantId,
      targetType: 'restaurant'
    })
    .populate('userId', 'name profileImage')          // reviewer details
    .populate('restaurantId', 'name logo')            // replying restaurant details if needed
    .sort({ createdAt: -1 });

    // Format response to include reply details if exists
    const formattedReviews = reviews.map(review => {
      let replyDetails = null;

      if (review.reply && review.repliedBy === 'restaurant') {
        replyDetails = {
          message: review.reply,
          repliedAt: review.repliedAt,
          repliedBy: review.restaurantId ? {
            name: review.restaurantId.name,
            logo: review.restaurantId.logo
          } : null
        };
      }

      return {
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        images: review.images,
        createdAt: review.createdAt,
        user: review.userId,
        reply: replyDetails
      };
    });

    return res.status(200).json({
      message: 'Restaurant reviews fetched successfully',
      count: formattedReviews.length,
      reviews: formattedReviews
    });

  } catch (error) {
    console.error('Error fetching restaurant reviews:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};





// ✅ Restaurant Reply to Feedback
exports.replyToFeedbackByRestaurant = async (req, res) => {
  try {
    const { feedbackId,restaurantId } = req.params;
    const { reply } = req.body; 

    if (!feedbackId) {
      return res.status(400).json({ message: 'Feedback ID is required' });
    }

    if (!reply) {
      return res.status(400).json({ message: 'Reply message is required' });
    }

    // Find feedback and make sure it belongs to this restaurant
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    if (String(feedback.restaurantId) !== String(restaurantId)) {
      return res.status(403).json({ message: 'You are not authorized to reply to this feedback' });
    }

    // Update feedback reply details
    feedback.reply = reply;
    feedback.repliedBy = 'restaurant';
    feedback.repliedAt = new Date();

    await feedback.save();

    return res.status(200).json({
      message: 'Reply added successfully',
      feedback
    });

  } catch (error) {
    console.error('Error replying to feedback:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};




exports.addProductReview = async (req, res) => {
  try {
    const {productId} = req.params
    const {rating, comment, images } = req.body;
    const userId = req.user._id; // assuming you use auth middleware to set req.user

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: "Invalid product ID",
        messageType: "failure",
      });
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating must be between 1 and 5",
        messageType: "failure",
      });
    }

    const newReview = new ProductReview({
      userId,
      productId,
      rating,
      comment,
      images,
    });

    await newReview.save();

    return res.status(201).json({
      message: "Review submitted successfully",
      messageType: "success",
      data: newReview,
    });

  } catch (error) {
    console.error("Error adding product review:", error);
    return res.status(500).json({
      message: "Server error",
      messageType: "failure",
    });
  }
};



exports.getRestaurantProductReviews = async (req, res) => {
  
  try {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        message: "Invalid restaurant ID",
        messageType: "failure",
      });
    }

    // Fetch all products for the restaurant
    const products = await Product.find({ restaurantId }).select("_id");

    if (products.length === 0) {
      return res.status(404).json({
        message: "No products found for this restaurant",
        messageType: "failure",
      });
    }

    // Extract product IDs
    const productIds = products.map((product) => product._id);

    // Fetch reviews for those products
    const reviews = await ProductReview.find({ productId: { $in: productIds } })
      .populate("userId", "name email phone")
      .populate("productId", "name price images")
      .sort({ createdAt: -1 });

    // Format the response data
    const formattedReviews = reviews.map((review) => ({
      reviewId: review._id,
      user: {
        id: review.userId._id,
        name: review.userId.name,
        email: review.userId.email,
        phone: review.userId.phone,
      },
      product: {
        id: review.productId._id,
        name: review.productId.name,
        price: review.productId.price,
        images: review.productId.images,
      },
      rating: review.rating,
      comment: review.comment,
      images: review.images,
      reply: review.reply,
      repliedBy: review.repliedBy,
      repliedAt: review.repliedAt,
      createdAt: review.createdAt,
    }));

    return res.status(200).json({
      message: "Product reviews fetched successfully",
      messageType: "success",
      data: formattedReviews,
    });

  } catch (error) {
    console.error("Error fetching restaurant product reviews:", error);
    return res.status(500).json({
      message: "Server error",
      messageType: "failure",
    });
  }
};



exports.replyToProductReview = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { reply } = req.body;

    if (!feedbackId ) {
      return res.status(400).json({ message: 'Review ID is required' });
    }
    if (!reply) {
      return res.status(400).json({ message: 'Reply message is required' });
    }

    const review = await ProductReview.findById(feedbackId);
    if (!review) {
      return res.status(404).json({ message: 'Product review not found' });
    }

    review.reply = reply;
    review.repliedBy = 'restaurant';
    review.repliedAt = new Date();

    await review.save();

    return res.status(200).json({ message: 'Product review reply added', review });

  } catch (error) {
    console.error('Error replying to product review:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};


