const mongoose = require("mongoose");

const ManagerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
  assignedRestaurants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" }],
  assignedBrands: [{ type: mongoose.Schema.Types.ObjectId, ref: "Brand" }],
}, { timestamps: true });

module.exports = mongoose.model("Manager", ManagerSchema);
