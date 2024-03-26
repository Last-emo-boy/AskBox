// src/api/v1/controllers/answerController.js

const { postAnswer, getAnswersForQuestion } = require('../services/answerService');

exports.postAnswer = async (req, res) => {
  try {
    const { questionId, content } = req.body;
    const answer = await answerService.postAnswer(questionId, content);
    res.status(201).json(answer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAnswersForQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const answers = await answerService.getAnswersForQuestion(questionId);
    res.status(200).json(answers);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
