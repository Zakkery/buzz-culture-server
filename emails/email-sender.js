const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require("path");
const Handlebars = require('handlebars');

const sendgridapi = process.env.SENDGRID_API_KEY;

sgMail.setApiKey(sendgridapi);

const emailTypeMap = {
  'registration': {
    'templateLocation': path.join(__dirname, '/registration-email.hbs'),
    'from': 'no-reply@acculturation-test.com',
    'subject': 'Welcome to the CultureChat',
  },
  'reset-password': {
    'templateLocation': path.join(__dirname, '/reset-password-email.hbs'),
    'from': 'no-reply@acculturation-test.com',
    'subject': 'Reset your CultureChat password',
  }
}

async function sendEmail(emailType, recipientEmail, templateData) {
  // get email file
  let emailInfo = emailTypeMap[emailType];

  let source = fs.readFileSync(emailInfo['templateLocation'], 'utf8');
  //compile the email template
  let template = Handlebars.compile(source);

  let emailHtml = template(templateData);

  const msg = {
    to: recipientEmail,
    from: emailInfo['from'],
    subject: emailInfo['subject'],
    html: emailHtml,
  };

  return sgMail.send(msg);
};

module.exports = {
  sendEmail: sendEmail
};
