const CancellationReason = require('../../models/cancellation/CancellationReasonModel');
const CancellationSetting = require('../../models/cancellation/CancellationSettingModel');

// Add a cancellation reason
exports.addReason = async (req, res) => {
  try {
    const { text, type } = req.body;

    if (!text || !type) {
      return res.status(400).json({ message: 'Reason text and type are required.' });
    }

    const cleanText = text.trim();
    if (cleanText.length === 0 || cleanText.length > 100) {
      return res.status(400).json({ message: 'Reason text must be between 1 and 100 characters.' });
    }

    if (!['custom', 'pre-defined'].includes(type)) {
      return res.status(400).json({ message: 'Invalid reason type.' });
    }

    // Fetch settings or fallback defaults
    let settings = await CancellationSetting.findOne();
    if (!settings) {
      settings = await CancellationSetting.create({});
    }

    if (type === 'custom' && !settings.allowCustomReasons) {
      return res.status(403).json({ message: 'Custom reasons are disabled.' });
    }

    if (type === 'pre-defined' && !settings.allowPredefinedReasons) {
      return res.status(403).json({ message: 'Pre-defined reasons are disabled.' });
    }

    // Prevent duplicate pre-defined reasons
    if (type === 'pre-defined') {
      const existing = await CancellationReason.findOne({ text: cleanText, type });
      if (existing) {
        return res.status(400).json({ message: 'Pre-defined reason already exists.' });
      }
    }

    const reason = await CancellationReason.create({ text: cleanText, type });
    res.status(201).json({ message: 'Reason added successfully.', reason });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add reason.', error: err.message });
  }
};
