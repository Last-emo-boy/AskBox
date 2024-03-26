// src/api/v1/controllers/questionController.js

const { postQuestion, getQuestionsForUser } = require('../services/questionService');

exports.postQuestion = async (req, res) => {
  try {
    const { content, userEmail } = req.body;
    const question = await postQuestion(content, userEmail);
    res.status(201).send({ message: 'Question posted successfully', questionId: question._id });
  } catch (error) {
    res.status(500).send('Server error');
  }
};

exports.getQuestionsForUser = async (req, res) => {
  try {
    const { userEmail } = req.params;
    const questions = await getQuestionsForUser(userEmail);
    res.status(200).send(questions);
  } catch (error) {
    res.status(500).send('Server error');
  }
};
