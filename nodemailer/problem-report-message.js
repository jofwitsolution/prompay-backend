const fs = require("fs");
const path = require("path");
// const nodemailer = require('nodemailer');
const sgMail = require("@sendgrid/mail");

const filePath = path.join(
  __dirname,
  "../views",
  "problem-report-message.html"
);
let htmlFile = fs.readFileSync(filePath, "utf-8");

// const host = process.env.SMTP_HOST;
// const port = process.env.SMTP_PORT;
// const service = process.env.SMTP_SERVICE;
// const user = process.env.SMTP_MAIL;
// const pass = process.env.SMTP_PASSWORD;

const sendProblemToSupport = async ({
  firstName,
  lastName,
  email,
  phone,
  location,
  joined,
  area,
  details,
}) => {
  // Replace placeholders with values from the request body
  const html = htmlFile
    .replace(/{{firstName}}/g, firstName)
    .replace(/{{lastName}}/g, lastName)
    .replace(/{{email}}/g, email)
    .replace(/{{phone}}/g, phone)
    .replace(/{{location}}/g, location)
    .replace(/{{joined}}/g, joined)
    .replace(/{{area}}/g, area)
    .replace(/{{details}}/g, details);

  return new Promise(async (resolve, reject) => {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: "theprompay@gmail.com",
      from: {
        email: process.env.SENDGRID_FROM_MAIL,
        name: "Prompay",
      },
      subject: area,
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

module.exports.sendProblemToSupport = sendProblemToSupport;
