const mongoose = require("mongoose");
const categoriesSchema = mongoose.Schema({
  name: String,
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
  },
  active: {type:Boolean,default:true},
  autoOnOff: Boolean,
  description: String,
  images: [String],
});

module.exports = mongoose.model("Category", categoriesSchema);
