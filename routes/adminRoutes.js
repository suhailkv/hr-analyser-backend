const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const sectionController = require("../controllers/admin/sectionController");
const questionController = require("../controllers/admin/questionController");
const optionController = require("../controllers/admin/optionController");
const scoreController = require("../controllers/user/scoreController");
const jwt = require("jsonwebtoken");

const coverpageController = require("../controllers/gen/coverpageController"); // For uploads
const prevCoverpageController = require("../controllers/gen/prev_coverpageController"); // For listing images

const upload = require("../middleware/upload"); // Multer middleware

// Public admin auth endpoints
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);

// Middleware to protect admin routes
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "missing authorization header" });
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "invalid token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.adminId = payload.id;
    req.adminEmail = payload.email;
    next();
  } catch (err) {
    return res.status(401).json({ message: "invalid token" });
  }
};

// Sections
router.post("/sections", requireAdmin, sectionController.create);
router.get("/sections", sectionController.list);
router.get("/sections/:id", requireAdmin, sectionController.getOne);
router.put("/sections/:id", requireAdmin, sectionController.update);
router.delete("/sections/:id", requireAdmin, sectionController.remove);

// Questions
router.post("/questions", requireAdmin, questionController.create);
router.post(
  "/questions/bulk",
  requireAdmin,
  questionController.bulkCreateQuestions
);
router.get("/questions", requireAdmin, questionController.list);
router.get("/questions/:id", requireAdmin, questionController.getOne);
router.put("/questions/:id", requireAdmin, questionController.update);
router.delete("/questions/:id", requireAdmin, questionController.remove);

// Options
router.post("/options", requireAdmin, optionController.create);
router.get("/options", requireAdmin, optionController.list);
router.get("/options/:id", requireAdmin, optionController.getOne);
router.put("/options/:id", requireAdmin, optionController.update);
router.delete("/options/:id", requireAdmin, optionController.remove);

// admin submissions
router.get("/submissions", requireAdmin, scoreController.getAllSubmissions);
router.post("/enquire/:uuid",requireAdmin, sectionController.markAsEnquired);
// Cover page - List existing uploaded images
router.get(
  '/report/:session_uuid/cover-images',
  requireAdmin,
  prevCoverpageController.listCoverImages
);

// Cover page - Upload cover images
router.post(
  "/report/:session_uuid/cover-images",
  requireAdmin,
  upload.fields([
    { name: "frontImage", maxCount: 1 },
    { name: "backImage", maxCount: 1 },
  ]),
  coverpageController.uploadCoverImages
);

module.exports = router;
