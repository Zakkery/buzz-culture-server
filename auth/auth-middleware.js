const jwt = require('jsonwebtoken');
const TokenModel = require('../models/tokens');
var md5 = require('md5');
var tokenTypes = require('./token-types');
var UserModel = require('../models/users');

function authenticate(role) {
  return async function(req, res, next) {
    try {
      if (!req.headers.authorization) {
        return res.status(401).json({ message: 'Missing Authorization Header' });
      }
      let tokenText = req.headers.authorization;
      // unpack the token
      let decoded = await TokenModel.unpackToken(tokenText);
      // check token exists
      let tokenRecord = await TokenModel.findOne({'tokenHash': md5(tokenText)});
      // No token found or expired
      if (tokenRecord === null || tokenRecord.expires_on < Date.now() || decoded.type != tokenTypes.Login) {
        return res.status(401).json({message: 'Unauthorized'});
      }
      // token exists and is login token
      // check user role
      let userRecord = await UserModel.findById(decoded.id);
      if (userRecord.role !== role) {
        return res.status(401).json({message: 'Unauthorized'});
      }
      next();
    } catch (err) {
      return res.status(401).json({message: 'Unauthorized'});
    }
  }
}

module.exports = authenticate;
