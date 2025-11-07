const express = require('express');
const router = express.Router();
const responseController = require('../controllers/user/responseController');
const scoreController = require('../controllers/user/scoreController');
const questionController = require('../controllers/admin/questionController');

// Start session
router.post('/response/start', responseController.startSession);
router.get('/assessment/questions', questionController.listWithSections);
// Submit answers (one endpoint for submission)
router.post('/response/:session_uuid/submit', responseController.submitAnswers);

// Get summary
router.get('/response/:session_uuid/summary', scoreController.getSummary);
router.get('/response/all-submissions', scoreController.getAllSubmissions);
router.put('/response/:session_uuid/edit', scoreController.updateSummaryFromReport);

module.exports = router;
