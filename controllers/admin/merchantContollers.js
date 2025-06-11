const User = require("../../models/userModel")
exports.getAllMerchants = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filtering
    const filter = { userType: 'merchant' };
    
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } }
      ];
    }

   

 

    // Sorting
    const sort = {};
    if (req.query.sortBy) {
      const parts = req.query.sortBy.split(':');
      sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    // Get merchants with pagination
    const merchants = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('_id name email phone userType');

    // Count total merchants for pagination
    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      count: merchants.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: merchants
    });

  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};