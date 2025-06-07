const Restaurant = require("../../models/restaurantModel");
const xlsx = require('xlsx')
exports.getRestaurantStats = async (req, res) => {
    try {
        // Get total approved restaurants
        const totalRestaurants = await Restaurant.countDocuments({ approvalStatus: "approved" });

        // Calculate weekly growth
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const lastWeekCount = await Restaurant.countDocuments({ 
            approvalStatus: "approved",
            createdAt: { $lt: oneWeekAgo }
        });
        
        const currentWeekCount = totalRestaurants;
        const growth = currentWeekCount - lastWeekCount;
        const growthPercentage = lastWeekCount > 0 
            ? (growth / lastWeekCount) * 100 
            : currentWeekCount > 0 ? 100 : 0;

        // Format the response
        const stats = {
            totalRestaurants: totalRestaurants.toLocaleString(),
            growthPercentage: growthPercentage.toFixed(1) + '%',
            trend: growth >= 0 ? '↑' : '↓'
        };

        res.json({
            success: true,
            message: 'Restaurant statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        console.error('Error fetching restaurant stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve restaurant statistics'
        });
    }
};

exports.importMenuFromExcel = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // Read Excel File
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Assuming restaurantId is passed via query or body
    const { restaurantId } = req.body;
    if (!restaurantId) return res.status(400).json({ message: "restaurantId is required" });
    console.log(sheetData)

    // const menuItems = sheetData.map((item) => ({
    //   restaurantId: restaurantId,
    //   category: item.category || "",
    //   itemName: item.itemName,
    //   price: item.price,
    //   description: item.description || "",
    //   imageUrl: item.imageUrl || "",
    //   active: true
    // }));

    // // Insert to MongoDB
    // await Menu.insertMany(menuItems);

    // res.status(200).json({ message: "Menu items imported successfully", data: menuItems });
    res.status(200)
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to import menu", error: err.message });
  }
};

