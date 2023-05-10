const fs = require("fs");
const path = require("path");
// const nodemailer = require("nodemailer");
// const { google } = require("googleapis");
const sgMail = require("@sendgrid/mail");

const filePath = path.join(__dirname, "../views", "verification-message.html");
let htmlFile = fs.readFileSync(filePath, "utf-8");

// const host = process.env.SMTP_HOST;
// const port = process.env.SMTP_PORT;
// const service = process.env.SMTP_SERVICE;
// const user = process.env.SMTP_MAIL;
// const pass = process.env.SMTP_PASSWORD;

const sendCode = async ({
  firstName,
  lastName,
  email,
  verificationCode,
  verificationCodeExpiration,
}) => {
  // Replace placeholders with values from the request body
  const html = htmlFile
    .replace(/{{firstName}}/g, firstName)
    .replace(/{{lastName}}/g, lastName)
    .replace(/{{email}}/g, email)
    .replace(/{{verificationCode}}/g, verificationCode)
    .replace(/{{verificationCodeExpiration}}/g, verificationCodeExpiration);

  return new Promise(async (resolve, reject) => {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_MAIL,
        name: "Prompay",
      }, // Use the email address or domain you verified above
      subject: "Verification code",
      html,
    };

    sgMail.send(msg).then(
      (response) => {
        // console.log(response, "SendGrid response");
        resolve(true);
      },
      (error) => {
        console.error(error, "SendGrid");

        if (error.response) {
          console.error(error.response.body);
          reject(false);
        }
      }
    );
  });
};

module.exports.sendCode = sendCode;
