const FAQ = require('../models/faqModel');

// Create FAQ
exports.createFAQ = async (req, res) => {
  try {
    const faq = new FAQ(req.body);
    await faq.save();
    res.status(201).json({ message: "FAQ created", faq });
  } catch (error) {
    res.status(500).json({ message: "Error creating FAQ", error });
  }
};

// Get all active FAQs
exports.getAllFAQs = async (req, res) => {
  try {
    const { audience } = req.query;
    const query = { isActive: true };
    if (audience) query.$or = [{ audience }, { audience: 'all' }];
    const faqs = await FAQ.find(query);
    res.status(200).json({ faqs });
  } catch (error) {
    res.status(500).json({ message: "Error fetching FAQs", error });
  }
};

// Delete FAQ
exports.deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    await FAQ.findByIdAndDelete(id);
    res.status(200).json({ message: "FAQ deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting FAQ", error });
  }
};
