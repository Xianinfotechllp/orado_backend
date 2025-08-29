const multer = require("multer");

// Use memory storage (buffer in RAM)
const storage = multer.memoryStorage();

// Accept only Excel files (.xlsx or .xls)
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimetype === "application/vnd.ms-excel"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel files are allowed (.xlsx or .xls)!"), false);
  }
};

const excelUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

module.exports = { excelUpload };
