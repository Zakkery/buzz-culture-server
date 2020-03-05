//Require Mongoose and bcrypt
var mongoose = require('mongoose');
var md5 = require('md5');
var jwt = require('jsonwebtoken');

const secret = process.env.SECRET;

//Create a Schema
var Schema = mongoose.Schema;

var TokenModelSchema = new Schema({
  tokenHash              : {
    type: String,
    required: true
  },
  expires_on             : {
    type : Date
  }
});

TokenModelSchema.static('signToken', function(tokenData, expiresIn) {
  let tokenText = jwt.sign(tokenData, secret, {
    expiresIn: expiresIn //48 hours
  });
  return tokenText;
});

TokenModelSchema.static('unpackToken', function(tokenText) {
  return jwt.verify(tokenText, secret);
})

TokenModelSchema.static('getHash', function(tokenText) {
  return md5(tokenText);
});

// Default token creation method
TokenModelSchema.static('createToken', function(tokenText, expiresIn) {
  let expirationDate = new Date();
  expirationDate.setSeconds(expirationDate.getSeconds() + expiresIn);

  let newToken = new this({
        tokenHash: md5(tokenText),
        expires_on: expirationDate
  });

  return newToken.save();
});

module.exports = mongoose.model('Token', TokenModelSchema);
