// // controllers/gen/coverpageController.js

// // (If you need to use upload directory constants here, you can add them as well)
// const path = require("path");
// // Not strictly needed in this controller, but here's how you'd do it:
// const IMG_UPLOAD_DIR = path.join(__dirname, "../../uploads/coverpages");

// const response = (status, message, data) => ({
//     status,
//     message,
//     data
// });

// const uploadCoverImages = (req, res) => {
//     let files = req.files;
//     let result = {};

//     if (files && files.frontImage && files.frontImage[0]) {
//         const file = files.frontImage[0];
//         result.frontImage = {
//             filename: file.filename,
//             originalname: file.originalname,
//             mimetype: file.mimetype,
//             size: file.size,
//             url: `/uploads/coverpages/${file.filename}`
//         };
//     }

//     if (files && files.backImage && files.backImage[0]) {
//         const file = files.backImage[0];
//         result.backImage = {
//             filename: file.filename,
//             originalname: file.originalname,
//             mimetype: file.mimetype,
//             size: file.size,
//             url: `/uploads/coverpages/${file.filename}`
//         };
//     }

//     if (!result.frontImage && !result.backImage) {
//         return res.status(400).json(response("error", "No files uploaded", null));
//     }

//     return res.status(200).json(response("success", "Files uploaded", result));
// };

// module.exports = { uploadCoverImages };



const path = require("path");

const response = (status, message, data) => ({
  status,
  message,
  data,
});

const uploadCoverImages = (req, res) => {
  let files = req.files;
  let result = {};

  // Get full base URL dynamically (fallback to env)
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

  if (files && files.frontImage && files.frontImage[0]) {
    const file = files.frontImage[0];
    result.frontImage = {
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `${baseUrl}/uploads/coverpages/${file.filename}`,  // FULL URL for frontend
    };
  }

  if (files && files.backImage && files.backImage[0]) {
    const file = files.backImage[0];
    result.backImage = {
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `${baseUrl}/uploads/coverpages/${file.filename}`,  // FULL URL for frontend
    };
  }

  if (!result.frontImage && !result.backImage) {
    return res.status(400).json(response("error", "No files uploaded", null));
  }

  return res.status(200).json(result);
};

module.exports = { uploadCoverImages };
