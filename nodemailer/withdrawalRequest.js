const fs = require("fs");
const path = require("path");
// const nodemailer = require('nodemailer');
const sgMail = require("@sendgrid/mail");

const filePath = path.join(
  __dirname,
  "../views",
  "withdrawal-request-message.html"
);
let htmlFile = fs.readFileSync(filePath, "utf-8");

// const host = process.env.SMTP_HOST;
// const port = process.env.SMTP_PORT;
// const service = process.env.SMTP_SERVICE;
// const user = process.env.SMTP_MAIL;
// const pass = process.env.SMTP_PASSWORD;

const sendWithdrawalRequestMessage = async ({
  firstName,
  lastName,
  amount,
  transactionId,
  withdrawalId,
}) => {
  // Replace placeholders with values from the request body
  html = htmlFile
    .replace(/{{firstName}}/g, firstName)
    .replace(/{{lastName}}/g, lastName)
    .replace(/{{amount}}/g, amount)
    .replace(/{{transactionId}}/g, transactionId)
    .replace(/{{withdrawalId}}/g, withdrawalId);

  return new Promise(async (resolve, reject) => {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: "theprompay@gmail.com",
      from: {
        email: process.env.SENDGRID_FROM_MAIL,
        name: "Prompay Wallet Manager",
      },
      subject: "Withdrawal request",
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

module.exports.sendWithdrawalRequestMessage = sendWithdrawalRequestMessage;
