const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: false, // 如果是465端口，则改为true
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM, // 发件人地址
      to: to, // 收件人地址，多个收件人可以使用逗号分隔的字符串或数组
      subject: subject, // 邮件标题
      text: text, // 邮件内容
    });

    console.log("Email sent successfully");
  } catch (error) {
    console.error("Failed to send email", error);
  }
};

module.exports = sendEmail;
