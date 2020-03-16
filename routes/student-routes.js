const express = require('express');
const emailSender = require('../emails/email-sender');
const errorMessages = require('../error-messages');
const role = require('../auth/role');
const tokenTypes = require('../auth/token-types');
const mongoose = require('mongoose');

const authStudent = require('../auth/auth-middleware')([role.Student, role.Mentor]);

var router = express.Router();

// for all paths on this route require admin authenication
router.use(authStudent);

// get students mentor
router.get('/mentor', async function(req, res, next) {
  try {
    if (req.userRecord.role !== role.Student) {
      return res.status(200).send({'success': true, 'data': null});
    }
    return res.status(200).send({'success': true, 'data': await req.userRecord.assigned_mentor});
  } catch (err) {
    next(err);
  }
});

// get student information
router.get('/account', async function(req, res, next) {
  try {
    let studentRecord = req.userRecord;
    return res.status(200).send({'uccess': true, 'data': studentRecord});
  } catch (err) {
    next(err);
  }
});

// update student information - only name allowed
router.put('/account', async function(req, res, next) {
  try {
    if (Object.keys(req.body).length === 0) {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    if (
      (!req.body.hasOwnProperty("name") || req.body.name === "")) {
          throw {message: errorMessages.NecessaryInfoMissing};
    }

    let studentRecord = req.userRecord;

    if (req.body.hasOwnProperty("name") && req.body.name !== "") {
      studentRecord.name = req.body.name;
    }

    let updatedStudentRecord = await studentRecord.save();
    return res.status(200).send({'success':true, data: updatedStudentRecord});
  } catch (err) {
    next(err);
  }
});

// get all sessions
router.get('/sessions', async function(req, res, next) {});

module.exports = router;
