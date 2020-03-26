const express = require('express');
const emailSender = require('../emails/email-sender');
const errorMessages = require('../error-messages');
const role = require('../auth/role');
const tokenTypes = require('../auth/token-types');
const mongoose = require('mongoose');

const authStudent = require('../auth/auth-middleware')([role.Student, role.Mentor]);

const ModuleModel = require('../models/modules');
const SessionModel = require('../models/sessions');
const UserModel = require('../models/users');

var router = express.Router();

// for all paths on this route require admin authenication
router.use(authStudent);

// get students mentor
router.get('/mentor', async function(req, res, next) {
  try {
    if (req.userRecord.role !== role.Student) {
      return res.status(200).send({'success': true, 'data': null});
    }
    let assigned_mentor = await req.userRecord.assigned_mentor;
    if (assigned_mentor == null) {
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
router.get('/sessions', async function(req, res, next) {
  try {
    let studentSessions = await SessionModel
      .find({$or: [{'student': req.userRecord._id}, {'mentor': req.userRecord._id}]})
      .select("-messages")
      .populate("student", "name")
      .populate("mentor", "name");
    return res.status(200).send({'success': true, 'data': studentSessions});
  } catch (err) {
    next(err);
  }
});

// get specific sessions
router.get('/session/:id', async function(req, res, next) {
  try {
    let sessionId = req.params.id;

    if (sessionId === "") {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    let sessionRecord = await SessionModel
      .findById(sessionId)
      .populate("mentor", "name")
      .populate("student", "name");
    if (sessionRecord === null) {
      throw {message: errorMessages.RecordDoesntExist};
    }
    return res.status(200).send({'success':true, 'data': sessionRecord});
  } catch (err) {
    next(err);
  }
});

// schedule a session
router.post('/sessions', async function(req, res, next) {
  try {
    if (Object.keys(req.body).length === 0 ||
      !req.body.hasOwnProperty("mentor") ||
      !req.body.hasOwnProperty("topic") ||
      !req.body.hasOwnProperty("starts_at") ||
      req.body.mentor === "" ||
      req.body.topic === ""  ||
      req.body.starts_at === ""
    ) {
        throw {message: errorMessages.NecessaryInfoMissing};
    }

    // start date should be unix timestamp
    let startDate = new Date(req.body.starts_at * 1000);
    if (startDate < new Date()) {
      throw {message: errorMessages.TimeInPast};
    }

    // check mentor exists
    let mentorRecord = await UserModel.findOne({_id: req.body.mentor, 'role': role.Mentor});
    if (mentorRecord === null) {
        throw {message: errorMessages.NecessaryInfoMissing};
    }
    // create a session
    let newSession = new SessionModel({
          student: req.userRecord._id,
          mentor: mentorRecord._id,
          topic: req.body.topic,
          starts_at: startDate
    });
    let sessionRecord = await newSession.save();

    return res.status(200).send({'success':true, 'data': sessionRecord});
  } catch (err) {
    next(err);
  }
});

// confirm a session
router.put('/session/confirm/:id', async function(req, res, next) {
  try {
    let sessionId = req.params.id;

    if (sessionId === "") {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    if (req.userRecord.role !== role.Mentor) {
      throw {message: 'Unauthorized'};
    }

    let sessionRecord = await SessionModel
      .findById(sessionId);
    if (sessionRecord === null) {
      throw {message: errorMessages.RecordDoesntExist};
    }
    // make sure user is that mentor
    if (sessionRecord['mentor'].toString() !== req.userRecord._id.toString()) {
        throw {message: 'Unauthorized'};
    }
    sessionRecord['approved'] = true;
    sessionRecord = await sessionRecord.save();

    return res.status(200).send({'success':true, 'data': sessionRecord});
  } catch (err) {
    next(err);
  }
});

// delete a session
router.delete('/session/:id', async function(req, res, next) {
  try {
    let sessionId = req.params.id;

    if (sessionId === "") {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    let sessionRecord = await SessionModel.findByIdAndDelete(sessionId);
    if (sessionRecord === null) {
      throw {message: errorMessages.RecordDoesntExist};
    }
    return res.status(200).send({'success':true, 'data': {'message': errorMessages.RecordDeleted}});
  } catch (err) {
    next(err);
  }
});

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
