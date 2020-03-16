const jwt = require('jsonwebtoken');
const TokenModel = require('../models/tokens');
var md5 = require('md5');
var tokenTypes = require('./token-types');
var UserModel = require('../models/users');

function authenticate(roles) {
  return async function(req, res, next) {
    try {
      if (!req.headers.authorization) {
        throw {message: 'Missing Authorization Header'};
      }
      let tokenText = req.headers.authorization;
      // unpack the token
      let decoded = await TokenModel.unpackToken(tokenText);
      // check token exists
      let tokenRecord = await TokenModel.findOne({'tokenHash': md5(tokenText)});
      // No token found or expired
      if (tokenRecord === null || tokenRecord.expires_on < Date.now() || decoded.type != tokenTypes.Login) {
        throw {message: 'Unauthorized'};
      }
      // token exists and is login token
      // check user role
      let userRecord = await UserModel
        .findById(decoded.id)
        .select("-password")
        .populate("assigned_mentor", "name");
      if (!roles.includes(userRecord.role)) {
        throw {message: 'Unauthorized'};
      }
      req.userRecord = userRecord;
      next();
    } catch (err) {
      next(err);
    }
  }
}

module.exports = authenticate;
