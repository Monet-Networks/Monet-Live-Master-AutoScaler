const Handlebars = require('handlebars');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const sendMail = async (source, email, subject, localOptions, bcc = '') => {
  const viewsPath = path.resolve(path.join(__dirname, '../views'));
  let template = Handlebars.compile(fs.readFileSync(path.join(__dirname, source), 'utf-8'));
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    //secure: false, // true for 465, false for other ports
    service: 'gmail',
    auth: {
      user: 'admin@monetlive.com',
      pass: 'xnfoogozwbfoemgm',
    },
  });
  const options = (locals) => {
    return {
      from: 'admin@monetlive.com',
      to: email,
      bcc: bcc,
      subject: subject,
      //text: content,
      //template: 'index',
      html: template(locals),
      attachments: [
        {
          filename: 'logo.png',
          path: `${viewsPath}/logo.png`,
          cid: 'logo', //same cid value as in the html img src
        },
        {
          filename: 'image.png',
          path: `${viewsPath}/image.png`,
          cid: 'lady', //same cid value as in the html img src
        },
        {
          filename: 'insta.png',
          path: `${viewsPath}/insta.png`,
          cid: 'insta', //same cid value as in the html img src
        },
        {
          filename: 'link.png',
          path: `${viewsPath}/link.png`,
          cid: 'link', //same cid value as in the html img src
        },
        {
          filename: 'tw.jpg',
          path: `${viewsPath}/tw.png`,
          cid: 'tw', //same cid value as in the html img src
        },
        {
          filename: 'facebook.png',
          path: `${viewsPath}/facebook.png`,
          cid: 'facebook', //same cid value as in the html img src
        },
      ],
    };
  };
  const sentMail = await transporter.sendMail(options(localOptions));
  return sentMail;
};

module.exports = sendMail;
