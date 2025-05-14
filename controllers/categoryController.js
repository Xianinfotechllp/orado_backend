
const Restaurant = require('../models/restaurantModel');
const Category = require('../models/categoryModel')
const mongoose = require('mongoose');
exports.createCategory = async (req, res) => {
try {
    const {restaurantId} = req.params
    
    const {name,description} = req.body;
   // Check required fields
  
   if (!restaurantId || !name || !description) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
  return res.status(400).json({ message: 'Invalid restaurant ID.' });
}
  


 // Check if restaurant exists

 const restaurant = await Restaurant.find({_id:restaurantId});
 if (!restaurant) {
    return res.status(404).json({ message: 'Restaurant not found.' });
  }

  if(description.length < 100)
  {
   return res.status(400).json({message:"Description should be at least 100 characters long."})
  }
   const categoriesExist = await Category.findOne({restaurantId: restaurantId, name: name});
   if(categoriesExist)
   {
    return res.status(400).json({message:"Category with the same name already exists for this restaurant."})
   }

  const newCategory = new Category({
    restaurantId,
    name,
    description
  });
  
  await newCategory.save();
  res.status(201).json({ message: 'Category created successfully.', category: newCategory });
} catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
}

}


exports.getAResturantCategories = async (req, res) => {

    try {
        const {restaurantId} = req.params;
    
        // Validate restaurantId presence
    if (!restaurantId) {
        return res.status(400).json({ message: 'restaurantId is required.' });
      }
  
      // Validate restaurantId format
      if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurantId.' });
      }
    
     // Check if restaurant exists
  const restaurant = await Restaurant.findOne({_id: restaurantId} );
  console.log(restaurant,restaurantId)
   if (!restaurant) {
    return res.status(404).json({ message: 'Restaurant not found.' });
  }
   const categories = await Category.find({ restaurantId });
   
   res.status(200).json({
    message: 'Categories fetched successfully.',
    categories
  });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error.' });
    }
}
exports.editResturantCategory = async (req, res) => {

  try {
    
      const {restaurantId,name,description} = req.body;
      const {categoryId} = req.params

       
   
   if (!restaurantId || !name ) {
    return res.status(400).json({ message: 'All fields are required.' });
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

     categoriesExist.name = name;
      // Update description only if provided
     if (description) {
      categoriesExist.description = description.trim();
    }
     await categoriesExist.save();
    res.status(200).json({ message: 'Category updated successfully.', categoriesExist });


      
  } catch (error) {
     console.error(error); // Log error for debugging
    res.status(500).json({ message: 'Server error.' });
  }
}
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





