const { registerUser, loginUser } = require('../services/authService');

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await registerUser(email, password);
    // 注册成功后，我们可以选择发送JWT或只是成功消息
    res.status(201).send({ message: 'User registered successfully', userId: user._id });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await loginUser(email, password);
    res.status(200).send({ message: 'User logged in successfully', token, userId: user._id });
  } catch (error) {
    res.status(500).send(error.message);
  }
};
