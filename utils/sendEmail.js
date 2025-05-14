const nodemailer = require('nodemailer');

exports.sendEmail = async (to, subject, message) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Orado" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: message,
  };

  await transporter.sendMail(mailOptions);
};
