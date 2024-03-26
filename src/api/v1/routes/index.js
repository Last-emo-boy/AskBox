const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const questionRoutes = require('./questionRoutes');
const answerRoutes = require('./answerRoutes'); // 新增引入

// 使用中间件来装载路由，为每组路由定义基础路径
router.use('/auth', authRoutes);
router.use('/questions', questionRoutes);
router.use('/answers', answerRoutes); // 新增路由

module.exports = router;
