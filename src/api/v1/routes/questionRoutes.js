const express = require('express');
const verifyToken = require('../middlewares/authMiddleware');
const { postQuestion, getQuestionsForUser } = require('../controllers/questionController');

const router = express.Router();

// JWT验证应用于发布问题
router.post('/', verifyToken, postQuestion);
// 公开访问用户的问题列表
router.get('/:userEmail', getQuestionsForUser);

module.exports = router;
