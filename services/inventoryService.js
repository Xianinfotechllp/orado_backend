const Product = require('../models/productModel');
const { sendSms } = require('../utils/sendSms');
const { sendEmail } = require('../utils/sendEmail');

async function reduceStockForOrder(orderItems, io) {
  try {
    const lowStockProducts = [];

    for (const item of orderItems) {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      if (product.enableInventory) {
        // Reduce stock but never go below zero
        product.stock = Math.max(0, product.stock - item.quantity);
        await product.save();

        // Emit stock update to all admins in the room
        io.to('admin_group').emit('stockUpdated', {
          productId: product._id,
          newStock: product.stock
        });

        // Track low-stock items for batch notification
        if (product.stock <= product.reorderLevel) {
          lowStockProducts.push({
            name: product.name,
            stock: product.stock
          });
        }
      }
    }

    // Send one alert for all low-stock products
    if (lowStockProducts.length > 0) {
      const messageBody = lowStockProducts
        .map(p => `• ${p.name}: ${p.stock} left`)
        .join('\n');

      try {
        await sendEmail(
          "amarnadh6565@gmail.com", // Get from DB later
          `Low Stock Alert - ${lowStockProducts.length} Product(s)`,
          `The following products are low on stock:\n${messageBody}`
        );
      } catch (err) {
        console.error("Error sending low stock email:", err.message);
      }

      try {
        await sendSms(
          "+917012602654", // Get from DB later
          `Low Stock Alert:\n${messageBody}`
        );
      } catch (err) {
        console.error("Error sending low stock SMS:", err.message);
      }
    }

  } catch (error) {
    console.error("Error reducing stock:", error.message);
  }
}


module.exports = {
  reduceStockForOrder
};
