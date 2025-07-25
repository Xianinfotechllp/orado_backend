const nodemailer = require("nodemailer");

exports.sendEmail = async (to, subject, message) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // true for 465, false for other ports
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

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: %s", info.messageId); // optional log
    return info;

  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
