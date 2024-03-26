// src/api/v1/services/answerService.js

const Answer = require('../models/Answer');
const Question = require('../models/Question');

const postAnswer = async (questionId, content) => {
  try {
    // 验证对应的问题是否存在
    const questionExists = await Question.findById(questionId);
    if (!questionExists) {
      throw new Error('Question not found');
    }
  
    const answer = new Answer({ question: questionId, content });
    await answer.save();
    return answer;
  } catch (error) {
    // 错误处理可以根据你的应用需求定制
    throw new Error(error.message || 'Failed to post answer');
  }
};

const getAnswersForQuestion = async (questionId) => {
  try {
    const answers = await Answer.find({ question: questionId }).populate('question');
    return answers;
  } catch (error) {
    throw new Error(error.message || 'Failed to get answers for question');
  }
};

module.exports = {
  postAnswer,
  getAnswersForQuestion,
};
