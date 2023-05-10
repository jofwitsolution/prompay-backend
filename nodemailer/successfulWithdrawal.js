const fs = require("fs");
const path = require("path");
// const nodemailer = require('nodemailer');
const sgMail = require("@sendgrid/mail");

const filePath = path.join(
  __dirname,
  "../views",
  "successful-withdrawal-message.html"
);
let htmlFile = fs.readFileSync(filePath, "utf-8");

// const host = process.env.SMTP_HOST;
// const port = process.env.SMTP_PORT;
// const service = process.env.SMTP_SERVICE;
// const user = process.env.SMTP_MAIL;
// const pass = process.env.SMTP_PASSWORD;

const sendSuccessfulWithdrawalMessage = async ({
  lastName,
  email,
  amount,
  wallet,
  transactionId,
  withdrawalId,
}) => {
  // Replace placeholders with values from the request body
  html = htmlFile
    .replace(/{{lastName}}/g, lastName)
    .replace(/{{amount}}/g, amount)
    .replace(/{{wallet}}/g, wallet)
    .replace(/{{transactionId}}/g, transactionId)
    .replace(/{{withdrawalId}}/g, withdrawalId);

  return new Promise(async (resolve, reject) => {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_MAIL,
        name: "Prompay Wallet Manager",
      },
      subject: "Withdrawal from Prompay",
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

module.exports.sendSuccessfulWithdrawalMessage =
  sendSuccessfulWithdrawalMessage;
