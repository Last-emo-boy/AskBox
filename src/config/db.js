const mongoose = require('mongoose');

const dbUri = require('./index').dbUri;

const connectDB = async () => {
  try {
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // 其他mongoose设置...
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1); // 退出进程失败
  }
};

module.exports = connectDB;
