const fs = require("fs");
const path = require("path");

const IMG_UPLOAD_DIR = path.join(__dirname, "../../uploads/coverpages");

const listCoverImages = (req, res) => {
  try {
    const files = fs.readdirSync(IMG_UPLOAD_DIR);

    // Build base URL dynamically or fallback to env var
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

    const frontImages = files
      .filter((filename) => filename.startsWith("frontImage"))
      .map((filename) => ({
        filename,
        url: `${baseUrl}/uploads/coverpages/${filename}`,  // FULL URL
      }));

    const backImages = files
      .filter((filename) => filename.startsWith("backImage"))
      .map((filename) => ({
        filename,
        url: `${baseUrl}/uploads/coverpages/${filename}`,  // FULL URL
      }));

    return res.status(200).json({ frontImages, backImages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "server error", error: err.message });
  }
};

module.exports = { listCoverImages };
//last