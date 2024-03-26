const express = require('express');
const router = express.Router();
const { postQuestion, getQuestionsForUser } = require('../controllers/questionController');

router.post('/', postQuestion);
router.get('/:userEmail', getQuestionsForUser);

module.exports = router;
