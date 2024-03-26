// src/api/v1/services/questionService.js

const Question = require('../models/Question');
const sendEmail = require('./mailService'); // 假设你已经实现了发送邮件的服务

const postQuestion = async (content, userEmail) => {
  const question = new Question({ content, userEmail });
  await question.save();
  // 发送邮件通知用户收到新问题
  await sendEmail(
    userEmail,
    'New Question Received',
    `You have received a new question: "${content}"`
  );
  return question;
};

const getQuestionsForUser = async (userEmail) => {
  return await Question.find({ userEmail });
};

module.exports = {
  postQuestion,
  getQuestionsForUser,
};
