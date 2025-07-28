
const Restaurant = require('../models/restaurantModel');
const Category = require('../models/categoryModel')
const mongoose = require('mongoose');
const { uploadOnCloudinary } = require('../utils/cloudinary');
exports.createCategory = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, active = true, autoOnOff = false, description} = req.body;

    // Validate required fields
    if (!restaurantId) {
      return res.status(400).json({ message: 'Restaurant ID is required' });
    }

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    // Validate field types and formats
    if (typeof name !== 'string') {
      return res.status(400).json({ message: 'Category name must be a string' });
    }

    if (typeof active !== 'boolean') {
      return res.status(400).json({ message: 'Active must be a boolean' });
    }

    if (typeof autoOnOff !== 'boolean') {
      return res.status(400).json({ message: 'autoOnOff must be a boolean' });
    }

    

    if (description && typeof description !== 'string') {
      return res.status(400).json({ message: 'Description must be a string' });
    }

   if (!description || description.trim() === "") {
      return res.status(400).json({
        message: "Description is required",
        messageType: "failure"
      });
    }

    // Validate description length if provided
    if (description && description.length > 500) {
      return res.status(400).json({ 
        message: 'Description cannot exceed 500 characters' 
      });
    }

    // Validate restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    const trimmedName = name.trim();

    // Check for duplicate category name (case-insensitive)
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }, 
      restaurantId 
    });
    
    if (existingCategory) {
      return res.status(400).json({ 
        message: 'Category with this name already exists for this restaurant' 
      });
    }

    // Process images if any
    let images = [];

    if (req.files && req.files.length > 0) {
      if (req.files.length > 5) {
        return res.status(400).json({ message: 'Maximum of 5 images allowed per category' });
      }

      // Upload each image to Cloudinary
      for (const file of req.files) {
        // file.path is provided by multer.diskStorage, if you use memoryStorage you may need to handle buffer upload
        const cloudinaryResult = await uploadOnCloudinary(file.path, 'your_folder_name_here');
        if (cloudinaryResult && cloudinaryResult.secure_url) {
          images.push(cloudinaryResult.secure_url); // Store the URL
        } else {
          return res.status(500).json({ message: 'Failed to upload image to Cloudinary' });
        }
      }
    }

    // Create and save the category
    const category = new Category({
      name: name,
      restaurantId,
      active,
      autoOnOff,
      description: description.trim(),
      images
    });

    await category.save();

    res.status(201).json({
      message: 'Category created successfully',
      data: category
    });

  } catch (error) {
    console.error('Error creating category:', error.message);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: error.errors 
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid ID format' 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

exports.getAResturantCategories = async (req, res) => {
  try {
    const { restaurantId } = req.params; 
     console.log(restaurantId)
    // Validate the restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant ID"
      });
    }

    // Find all active categories for the given restaurant
    const categories = await Category.find({
      restaurantId: restaurantId
     
    }) // Excluding the version key

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No categories found for this restaurant",
        data: []
      });
    }

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });

  } catch (error) {
    console.error("Error fetching restaurant categories:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


exports.editResturantCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, active, autoOnOff, description, imageIndexToReplace } = req.body;

    if (!categoryId) {
      return res.status(400).json({ message: 'Category ID is required' });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // ✅ Check for duplicate name
    if (name && name.trim() !== category.name) {
      const existingCategory = await Category.findOne({
        name: name.trim(),
        restaurantId: category.restaurantId,
        _id: { $ne: categoryId }
      });

      if (existingCategory) {
        return res.status(400).json({ message: 'Another category with this name already exists for this restaurant' });
      }

      category.name = name.trim();
    }

    // ✅ Upload and replace specific image if provided
    if (req.file) {
      const uploadResult = await uploadOnCloudinary(req.file.path, 'category_images');
      if (uploadResult) {
        if (typeof imageIndexToReplace !== 'undefined' && category.images[imageIndexToReplace]) {
          category.images[imageIndexToReplace] = uploadResult.secure_url;
        } else {
          category.images.push(uploadResult.secure_url);
        }
      }
    }

    // ✅ Update other fields
    if (typeof active !== 'undefined') category.active = active;
    if (typeof autoOnOff !== 'undefined') category.autoOnOff = autoOnOff;
    if (typeof description !== 'undefined') category.description = description;

    await category.save();

    res.status(200).json({
      message: 'Category updated successfully',
      category
    });

  } catch (error) {
    console.error('Error updating category:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.deleteResturantCategory = async (req, res) => {
  try {
    // Get both restaurantId and categoryId from req.params
    const { restaurantId, categoryId } = req.params;

    // Validate that both IDs are provided
    if (!restaurantId || !categoryId) {
      return res.status(400).json({ message: "restaurantId and categoryId are required" });
    }

    // Validate restaurantId and categoryId format
    if (!mongoose.Types.ObjectId.isValid(restaurantId) || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: 'Invalid restaurantId or categoryId' });
    }

    // Check if restaurant exists
    const restaurant = await Restaurant.findOne({ _id: restaurantId });
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' });
    }

    // Check if category exists
    const categoryExists = await Category.findOne({ _id: categoryId });
    if (!categoryExists) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    // Delete the category
    await Category.deleteOne({ _id: categoryId });

    res.status(200).json({ message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteResturantCategory:', error); // More specific error logging
    res.status(500).json({ message: 'Server error.' });
  }
};



