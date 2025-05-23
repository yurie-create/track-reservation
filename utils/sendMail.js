const nodemailer = require('nodemailer');
require('dotenv').config(); // ← .env を読み込む

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  // .env から読み込む
    pass: process.env.EMAIL_PASS   // .env から読み込む（名前を修正した場合）
  }
});

async function sendMail(to, subject, text) {
  const mailOptions = {
    from: process.env.EMAIL_USER, // ← 自動で送信元にも使う
    to,
    subject,
    text
  };

  return transporter.sendMail(mailOptions);
}

module.exports = sendMail;

