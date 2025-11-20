// middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Constants defined here
const IMG_UPLOAD_DIR = path.join(__dirname, "../uploads/coverpages");
const MAX_IMG_SIZE = 100 * 1024 * 1024; // 100MB

// Ensure the upload directory exists
if (!fs.existsSync(IMG_UPLOAD_DIR)) {
    fs.mkdirSync(IMG_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log(file)
        cb(null, IMG_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(
            null,
            file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
        );
    },
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image") || file.mimetype === "application/pdf") {
        cb(null, true);
    } else {
        cb(new Error("Only image and PDF files are allowed!"), false);
    }
};

const limits = {
    fileSize: MAX_IMG_SIZE,
};

const upload = multer({
    storage,
    fileFilter,
    limits,
});

module.exports = upload;
