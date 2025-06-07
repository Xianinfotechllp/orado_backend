const User = require("../../models/userModel")
exports.getUserStats = async (req, res) => {
    try {
        // Get total users where userType is 'customer'
        const totalUsers = await User.countDocuments({ userType: 'customer' });
        
        // Calculate weekly growth - you should replace these with actual queries
        // For example, count users created in the last week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const lastWeekCount = await User.countDocuments({ 
            userType: 'customer',
            createdAt: { $lt: oneWeekAgo }
        });
        
        const currentWeekCount = totalUsers; // current count includes all up to now
        const growth = currentWeekCount - lastWeekCount;
        const growthPercentage = lastWeekCount > 0 
            ? (growth / lastWeekCount) * 100 
            : 100; // handle division by zero if there were no users last week

        // Format the response
        const stats = {
            totalUsers: totalUsers.toLocaleString(), // Formats number with commas
            growthPercentage: growthPercentage.toFixed(1), // One decimal place
            trend: growth >= 0 ? '↑' : '↓'
        };

        res.json({
            success: true,
            message: 'User statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user statistics'
        });
    }
};