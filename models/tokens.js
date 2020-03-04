//Require Mongoose and bcrypt
var mongoose = require('mongoose');
var md5 = require('md5');

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

// Default token creation method
TokenModelSchema.static('createToken', function(jwtText, expirationDate) {
  var newToken = new this({
        tokenHash: md5(jwtText),
        expires_on: expirationDate
  });
  return newToken;
});

module.exports = mongoose.model('Token', TokenModelSchema);
