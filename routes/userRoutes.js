const express = require('express');
const router = express.Router();
const responseController = require('../controllers/user/responseController');
const scoreController = require('../controllers/user/scoreController');
const questionController = require('../controllers/admin/questionController');
const jwt = require("jsonwebtoken");

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
// Start session
router.post('/response/start', responseController.startSession);
router.get('/assessment/questions', questionController.listWithSections);
// Submit answers (one endpoint for submission)
router.post('/response/:session_uuid/submit', responseController.submitAnswers);

// Get summary
router.get('/response/:session_uuid/summary', scoreController.getSummary);
router.get('/response/all-submissions', requireAdmin,scoreController.getAllSubmissions);
router.put('/response/:session_uuid/edit',requireAdmin, scoreController.updateSummaryFromReport);

module.exports = router;
