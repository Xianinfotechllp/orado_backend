const multer = require('multer');
const fs = require('fs');
const path = require('path');

const tempDir = path.join(__dirname, '..', 'public', 'temp'); // Adjust as per your project structure

// Ensure directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Add timestamp to original filename to avoid overwriting
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '_'); // replace spaces with underscores
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ storage });

module.exports = { upload };
