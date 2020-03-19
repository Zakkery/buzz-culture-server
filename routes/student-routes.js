const express = require('express');
const emailSender = require('../emails/email-sender');
const errorMessages = require('../error-messages');
const role = require('../auth/role');
const tokenTypes = require('../auth/token-types');
const mongoose = require('mongoose');

const authStudent = require('../auth/auth-middleware')([role.Student, role.Mentor]);

const ModuleModel = require('../models/modules');

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

// mark module as read
router.put('/module/read/:id', async function(req, res, next) {
  try {
    let moduleId = req.params.id;

    if (moduleId === "") {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    let moduleRecord = await ModuleModel
      .findById(moduleId);
    if (moduleRecord === null) {
      throw {message: errorMessages.RecordDoesntExist};
    }
    // add module to the list of read modules if not there already
    let toAdd = true;
    for (let i = 0; i < req.userRecord.watched_modules.length; i++) {
      if (req.userRecord.watched_modules[i].toString() == moduleRecord._id.toString()) {
        toAdd = false;
        break;
      }
    }

    if (toAdd) {
      req.userRecord.watched_modules.push(moduleRecord._id);
      req.userRecord.save();
    }

    return res.status(200).send({'success':true, 'data': {'message': errorMessages.ModuleViewed}});
  } catch (err) {
    next(err);
  }
});

// get read modules
router.get('/modules', async function(req, res, next) {
  try {
    return res.status(200).send({'success':true, 'data': req.userRecord.watched_modules});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
