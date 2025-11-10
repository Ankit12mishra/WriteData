// utils/sendEmail.js
const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail", // you can use Outlook, SMTP etc.
      auth: {
        user: process.env.EMAIL_USER, // your email
        pass: process.env.EMAIL_PASS, // app password (not normal password)
      },
    });

    await transporter.sendMail({
      from: `"WriteData" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    // console.log(" Email sent to", to);
  } catch (error) {
    console.error(" Email send error:", error);
  }
};

module.exports = sendEmail;
