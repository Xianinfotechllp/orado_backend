
const Restaurant = require('../models/restaurantModel');
const Category = require('../models/categoryModel')
const mongoose = require('mongoose');
const { uploadOnCloudinary } = require('../utils/cloudinary');

exports.createCategory = async (req, res) => {
  try {
    const {restaurantId} = req.params
    const { name, active = true, autoOnOff = false, description = ''} = req.body;

    if (!name?.trim() || !restaurantId) {
      return res.status(400).json({ message: 'Category name and restaurantId are required' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // ✅ Check if category with same name exists for the restaurant
    const existingCategory = await Category.findOne({ name: name.trim(), restaurantId });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists for this restaurant' });
    }


     let images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        
        const uploadResult = await uploadOnCloudinary(file.path, 'category_images');
        if (uploadResult) {
          images.push(uploadResult.secure_url);
        }
      }
    }
    console.log(images)

    const category = new Category({
      name: name.trim(),
      restaurantId,
      active,
      autoOnOff,
      description,
      images:images
    });

    await category.save();

    res.status(201).json({
      message: 'Category created successfully',
      data:category
    });

  } catch (error) {
    console.error('Error creating category:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
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
    
      const {restaurantId} = req.body;
      const {categoryId} = req.params

     
     if (!restaurantId) {
    return res.status(400).json({ message: "restaurantId is required" });
  }
    // Validate restaurantId format
      if (!mongoose.Types.ObjectId.isValid(restaurantId) || !mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ message: 'Invalid restaurantId or categoryId' });
      }
    // Check if restaurant exists
  const restaurant = await Restaurant.findOne({_id: restaurantId} );
   if (!restaurant) {
    return res.status(404).json({ message: 'Restaurant not found.' });
  }

   const categoriesExist = await Category.findOne({_id:categoryId});
     if(!categoriesExist)
     {
      return res.status(404).json({ message: 'Category not found.' });
     }

         await Category.deleteOne({ _id: categoryId });

             res.status(200).json({ message: 'Category deleted successfully.' });
  } catch (error) {
      console.error(error); // Log the error for debugging
    res.status(500).json({ message: 'Server error.' });
  }
}





