// const Tax = require("../../models/taxModel");

// // 📌 Add New Tax
// exports.createTax = async (req, res) => {
//   try {
//     const { 
//       name, 
//       amount, 
//       type, 
//       appliedOn, 
//       taxType, 
//       restaurants, 
//       restaurant,  // 👈 added single restaurant field
//       cities 
//     } = req.body;

//     // Check for duplicate tax (name + appliedOn + taxType)
//     const isDuplicate = await Tax.isDuplicateTax(name, appliedOn, taxType);
//     if (isDuplicate) {
//       return res.status(400).json({
//         success: false,
//         message: "Tax with same name, appliedOn and taxType already exists."
//       });
//     }

//     // Create new tax document
//     const newTax = await Tax.create({
//       name,
//       amount,
//       type,
//       appliedOn,
//       taxType,
//       restaurants,  // optional array for Marketplace taxes
//       restaurant,   // optional single merchant for Merchant tax
//       cities
//     });

//     res.status(201).json({
//       success: true,
//       message: "Tax created successfully",
//       data: newTax
//     });

//   } catch (error) {
//     console.error("Error creating tax:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create tax",
//       error: error.message
//     });
//   }
// };

// // 📌 Get All Taxes (with optional query filters)
// exports.getTaxes = async (req, res) => {
//   try {
//     const { taxType } = req.query;

//     const query = taxType ? { taxType } : {};

//     const taxes = await Tax.find(query)
//       .populate("restaurants", "storeName")
//       .populate("cities", "name")
//       .sort({ createdAt: -1 });

//     res.status(200).json({ success: true, data: taxes });
//   } catch (error) {
//     console.error("Error fetching taxes:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch taxes" });
//   }
// };

// // 📌 Get Single Tax by ID
// exports.getTaxById = async (req, res) => {
//   try {
//     const tax = await Tax.findById(req.params.id)
//       .populate("restaurants", "storeName")
//       .populate("cities", "name");

//     if (!tax) {
//       return res.status(404).json({ success: false, message: "Tax not found" });
//     }

//     res.status(200).json({ success: true, data: tax });
//   } catch (error) {
//     console.error("Error fetching tax:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch tax" });
//   }
// };

// // 📌 Update Tax by ID
// exports.updateTax = async (req, res) => {
//   try {
//     const updatedTax = await Tax.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//       runValidators: true,
//     });

//     if (!updatedTax) {
//       return res.status(404).json({ success: false, message: "Tax not found" });
//     }

//     res.status(200).json({ success: true, message: "Tax updated successfully", data: updatedTax });
//   } catch (error) {
//     console.error("Error updating tax:", error);
//     res.status(500).json({ success: false, message: "Failed to update tax" });
//   }
// };

// // 📌 Delete Tax by ID
// exports.deleteTax = async (req, res) => {
//   try {
//     const deletedTax = await Tax.findByIdAndDelete(req.params.id);

//     if (!deletedTax) {
//       return res.status(404).json({ success: false, message: "Tax not found" });
//     }

//     res.status(200).json({ success: true, message: "Tax deleted successfully" });
//   } catch (error) {
//     console.error("Error deleting tax:", error);
//     res.status(500).json({ success: false, message: "Failed to delete tax" });
//   }
// };



// // 📌 Toggle Tax Status by ID
// exports.toggleTaxStatus = async (req, res) => {
//   try {
//     const tax = await Tax.findById(req.params.id);
//     if (!tax) {
//       return res.status(404).json({ success: false, message: "Tax not found" });
//     }

//     tax.status = !tax.status;
//     await tax.save();

//     res.status(200).json({ success: true, message: `Tax ${tax.status ? "activated" : "deactivated"} successfully`, data: tax });
//   } catch (error) {
//     console.error("Error toggling tax status:", error);
//     res.status(500).json({ success: false, message: "Failed to toggle tax status" });
//   }
// };
