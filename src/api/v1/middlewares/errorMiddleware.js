// src/api/v1/middlewares/errorMiddleware.js
class ErrorHandler extends Error {
  constructor(statusCode, message) {
    super();
    this.statusCode = statusCode;
    this.message = message;
  }
}

const errorHandler = (err, req, res, next) => {
  const { statusCode = 500, message = 'Something went wrong' } = err;
  
  console.error(err); // 实际项目中，考虑使用更高级的日志解决方案

  // 针对生产环境，可能不希望返回详细错误信息
  const responseMessage = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error'
    : message;

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message: responseMessage
  });
};

module.exports = { errorHandler, ErrorHandler };
