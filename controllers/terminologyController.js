const Terminology =  require("../models/terminologyModel")

// Create or Update Terminology
exports.createOrUpdateTerminology = async (req, res) => {
  try {
    const { language, terms } = req.body;
    // const adminId = req.user._id; // assuming req.user from token middleware

    if (!language || !terms || typeof terms !== "object") {
      return res.status(400).json({ message: "Language and terms are required." });
    }

    const terminology = await Terminology.findOneAndUpdate(
      { language },
      { $set: { terms} },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      message: "Terminology saved successfully.",
      data: terminology,
    });
  } catch (error) {
    console.error("Terminology save error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


exports.getTerminologyByLanguage = async (req, res) => {
  try {
    const { language } = req.params;
    const terminology = await Terminology.findOne({ language });

    if (!terminology) {
      return res.status(404).json({ message: "Terminology not found." });
    }

    res.status(200).json(terminology);
  } catch (error) {
    console.error("Fetch terminology error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


exports.getTerminologyByLanguage = async (req, res) => {
  try {
    const { language } = req.params;
    const terminology = await Terminology.findOne({ language });

    if (!terminology) {
      return res.status(404).json({ message: "Terminology not found." });
    }

    res.status(200).json(terminology);
  } catch (error) {
    console.error("Fetch terminology error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
exports.listAllLanguages = async (req, res) => {
  try {
    const languages = await Terminology.find().select("language -_id");
    res.status(200).json(languages.map(l => l.language));
  } catch (error) {
    console.error("List languages error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
exports.deleteTerminology = async (req, res) => {
  try {
    const { language } = req.params;
    const result = await Terminology.findOneAndDelete({ language });

    if (!result) {
      return res.status(404).json({ message: "Terminology not found." });
    }

    res.status(200).json({ message: "Terminology deleted successfully." });
  } catch (error) {
    console.error("Delete terminology error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
exports.updateSingleTerm = async (req, res) => {
  try {
    const { language, key } = req.params;
    const { value } = req.body;
    // const adminId = req.user._id;

    if (!value) {
      return res.status(400).json({ message: "Value is required." });
    }

    const terminology = await Terminology.findOneAndUpdate(
      { language },
      { $set: { [`terms.${key}`]: value,  } },
      { new: true }
    );

    if (!terminology) {
      return res.status(404).json({ message: "Terminology not found." });
    }

    res.status(200).json({ message: "Term updated.", data: terminology });
  } catch (error) {
    console.error("Update term error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
exports.getSingleTerm = async (req, res) => {
  try {
    const { language, key } = req.params;
    const terminology = await Terminology.findOne({ language });

    if (!terminology) {
      return res.status(404).json({ message: "Terminology not found." });
    }

    const value = terminology.terms.get(key);
    if (!value) {
      return res.status(404).json({ message: `Term '${key}' not found.` });
    }

    res.status(200).json({ key, value });
  } catch (error) {
    console.error("Fetch term error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
