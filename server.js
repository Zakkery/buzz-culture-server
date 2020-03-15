const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require("path");

const role = require('./auth/role');
const errorMessages = require('./error-messages');
const emailSender = require('./emails/email-sender');
const tokenTypes = require('./auth/token-types');

const adminRoutes = require('./routes/admin-routes');
const autorizedRoutes = require('./routes/authorized-routes');
const cron = require('node-cron');

const port = process.env.PORT || 3000;

const UserModel = require('./models/users');
const TokenModel = require('./models/tokens');
const bodyParser = require('body-parser');

const saltRounds = 10;

const app = express();

app.set('view engine', 'hbs');

app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

var mongoDB = process.env.MONGODB_URI;
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });

//Get the default connection
var db = mongoose.connection;
//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

UserModel.find({ role: role.Admin}, function (err, docs) {
  if (docs.length == 0) {
    console.log("No admin record found - creating a default one!");
    let hash = bcrypt.hashSync("123", saltRounds);
    var small = new UserModel(
      {
        name: 'Administrator',
        password: hash,
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

app.get('/confirm-registration', async function(req, res) {
  let tokenText = req.query.token;
  // verify a token from the DB
  try {
    let tokenRecord = await TokenModel.findOne({'tokenHash': TokenModel.getHash(tokenText)});
    // No token found or expired
    if (tokenRecord === null || tokenRecord.expires_on < Date.now()) {
      return res.render('something-failed');
    }
    // Token exists and not expired
    let decoded = await TokenModel.unpackToken(tokenText);
    if (decoded.type != tokenTypes.Registration && decoded.type != tokenTypes.PasswordChange) {
      return res.render('something-failed');
    }
    return res.render('confirm-registration', {"tokenText": tokenText});
  } catch (err) {
    return res.render('something-failed');
  }
});

app.post('/reset-password', async function(req, res) {
  if (Object.keys(req.body).length === 0 ||
    !req.body.hasOwnProperty("email") ||
    req.body.email === ""
  ) {
      //body is empty or doesn't have email
      return res.status(400).send(errorMessages.NeedEmail);
  }

  let userEmail = req.body.email;

  try {
    // check if user exists
    let userRecord = await UserModel.findOne({'email':userEmail});
    if (userRecord === null) {
      return res.status(200).send(errorMessages.ResetEmailSent);
    }
    // if exists - create a token and save it
    let tokenData = {
      id: userRecord._id,
      type: tokenTypes.PasswordChange
    };
    let expiresIn = 48 * 60 * 60; //48 hours
    let tokenText = await TokenModel.signToken(tokenData, expiresIn);
    let newToken = await TokenModel.createToken(tokenText, expiresIn);

    let templateData = {
      "name": userRecord.name,
      "registrationLink": req.protocol + "://" + req.headers.host + "/confirm-registration?token=" + tokenText
    };

    //Now we need to send an email
    await emailSender.sendEmail('reset-password', userRecord.email, templateData);
    return res.status(200).send(errorMessages.ResetEmailSent);
  } catch (err) {
    return res.status(200).send(errorMessages.ResetEmailSent);
  }
});

app.post('/finish-reset-password', async function(req, res) {
  let tokenText = req.body.token;
  let password = req.body.password;
  try {
    // verify a token from the DB
    let tokenRecord = await TokenModel.findOne({'tokenHash': TokenModel.getHash(tokenText)});
    // No token found or expired
    if (tokenRecord === null || tokenRecord.expires_on < Date.now()) {
      return res.render('something-failed');
    }
    // Token exists and not expired
    let decoded = await TokenModel.unpackToken(tokenText);
    if (decoded.type != tokenTypes.Registration && decoded.type != tokenTypes.PasswordChange) {
      return res.render('something-failed');
    }
    // hash password
    let hash = bcrypt.hashSync(password, saltRounds);
    await UserModel.findByIdAndUpdate(decoded.id, {"confirmed": true, "password": hash});
    // we updated user - delete a token now
    await TokenModel.findByIdAndDelete(tokenRecord._id);
    return res.render('registration-success');
  } catch (err) {
    return res.render('something-failed');
  }
});

app.post('/login', async function(req, res) {
  if (Object.keys(req.body).length === 0 ||
    !req.body.hasOwnProperty("email") ||
    !req.body.hasOwnProperty("password") ||
    req.body.email === "" ||
    req.body.password === ""
  ) {
      //body is empty or doesn't have email or password
      return res.status(400).send(errorMessages.NeedEmailAndPassword);
  }
  let email = req.body.email;
  let password = req.body.password;

  try {
    //Check if user exists
    userRecord = await UserModel.findOne({'email': email});
    if (userRecord === null) {
      return res.status(400).send(errorMessages.CannotAuthenticate);
    }
    // Check that passwords match
    let match = await bcrypt.compare(password, userRecord.password);
    if (!match) {
      return res.status(400).send(errorMessages.CannotAuthenticate);
    }

    // Create a token
    let tokenData = {
      id: userRecord._id,
      type: tokenTypes.Login
    };

    let expiresIn = 7 * 24 * 60 * 60; //7 days

    // Save token data
    let tokenText = await TokenModel.signToken(tokenData, expiresIn);
    let newToken = await TokenModel.createToken(tokenText, expiresIn);
    // Send token as a response
    res.status(200).send({'auth': {'token': tokenText, 'role': userRecord.role}});
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
});

// From here on everything else requires autorization and role management
app.use('/admin', adminRoutes);

app.use('/', autorizedRoutes);

app.get('*', function(req, res) {
  res.render('something-failed');
});

// Every 2 minutes check if there are some expired token out there
cron.schedule('*/2 * * * *', async function() {
  await TokenModel.deleteMany({expires_on: {$lt: Date.now()}});
});

app.listen(port, function() {
    console.log(`Server is listening on port ${port}!`)
});
