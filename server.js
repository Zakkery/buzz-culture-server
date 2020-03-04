const express = require('express');
var mongoose = require('mongoose');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
var md5 = require('md5');

var path = require("path");
var Handlebars = require('handlebars');
var fs = require('fs');

var role = require('./auth/role');
var errorMessages = require('./error-messages');
var tokenTypes = require('./auth/token-types');

const port = process.env.PORT || 3000;
const secret = process.env.SECRET;
const sendgridapi = process.env.SENDGRID_API_KEY;

var UserModel = require('./models/users');
var TokenModel = require('./models/tokens');
const bodyParser = require('body-parser');

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(sendgridapi);

const app = express();

var mongoDB = process.env.MONGODB_URI;
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });

//Get the default connection
var db = mongoose.connection;
//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

UserModel.find({ role: role.Admin}, function (err, docs) {
  if (docs.length == 0) {
    console.log("No admin record found - creating a default one!");
    var small = new UserModel(
      {
        name: 'Administrator',
        password: "123",
        email: "admin@test.com",
        role: role.Admin,
        confirmed: true
      }
    );

    small.save(function (err) {
      if (err) console.log(err);
    });
  }
});

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

app.use(bodyParser.json());


app.get('/', function (req, res) {
    res.send("This is a test!");
});

app.post('/invite', function(req, res) {
  if (Object.keys(req.body).length === 0 ||
    !req.body.hasOwnProperty("email") ||
    !req.body.hasOwnProperty("name") ||
    req.body.email === "" ||
    req.body.name === ""
  ) {
      //body is empty or doesn't have email
      return res.status(400).send(errorMessages.NeedEmailAndName);
  }

  inviteeEmail = req.body.email;
  inviteeName = req.body.name;

  //Saved a token - now we need to send and email
  var source = fs.readFileSync(path.join(__dirname, '/emails/registration-email.hbs'), 'utf8');
  // Create email generator
  var template = Handlebars.compile(source);

  //Check if user already exists
  UserModel.find({'email': inviteeEmail}, function (err, docs) {
    if (docs.length > 0) {
      // user exists!
      return res.status(400).send(errorMessages.UserAlreadyExists);
    }

    // Create a user record
    var newStudentUser = UserModel.createByInvite(inviteeEmail, inviteeName, role.Student);

    newStudentUser.save(function (err) {
      if (err) {
        console.log(err);
        return res.status(400).send(err);
      }

      // Successfully create a student records - create a token for confirmation and completion of the registration
      var tokenData = {
        id: newStudentUser._id,
        type: tokenTypes.Registration
      };

      var tokenText = jwt.sign(tokenData, secret, {
        expiresIn: 48 * 60 * 60 //48 hours
      });

      var expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 48);
      // Save token data
      var newToken = TokenModel.createToken(tokenText, expirationDate);
      newToken.save(function(err) {
        if (err) {
          console.log(err);
          return res.status(400).send(err);
        }

        var templateData = {
          "name": inviteeName,
          "registrationLink": req.protocol+"://"+req.headers.host + "/confirm-registration?token=" + tokenText
        };

        emailHtml = template(templateData);
        const msg = {
          to: inviteeEmail,
          from: 'no-reply@acculturation-test.com',
          subject: 'Welcome to the CultureChat',
          html: emailHtml,
        };

        sgMail.send(msg);

        return res.status(200).send(errorMessages.StudentWasEmailed);
      });
    });

  });
});

app.get('/confirm-registration', function(req, res) {
  var tokenText = req.query.token;
  // verify a token from the DB
  TokenModel.findOne({'tokenHash': md5(tokenText)}, function(err, tokenRecord) {
    // No token found or expired
    if (tokenRecord === null || tokenRecord.expires_on < Date.now()) {
      return res.status(500).send(errorMessages.ExpiredOrFailedToken);
    }
    // Token exists and not expired
    jwt.verify(tokenText, secret, function(err, decoded) {
      if (err) {
        console.log(err);
        return res.status(400).send(err);
      }
      // token is OK - activate the user
      userId = decoded.id;
      tokenType = decoded.type;
      if (tokenType != tokenTypes.Registration) {
        return res.status(500).send(errorMessages.ExpiredOrFailedToken);
      }
      UserModel.findByIdAndUpdate(userId, {"confirmed": true}, function(err, doc) {
        if (err) {
          console.log(err);
          return res.status(400).send(err);
        }
        // we updated user - delete a token now
        TokenModel.findByIdAndDelete(tokenRecord._id, function(err, doc) {
          if (err) {
            console.log(err);
            return res.status(400).send(err);
          }
          return res.status(200).send(errorMessages.RecordActivated);
        })
      });
    });
  });
});

app.listen(port, function() {
    console.log(`Server is listening on port ${port}!`)
});
