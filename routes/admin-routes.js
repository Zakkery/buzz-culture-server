const express = require('express');
const emailSender = require('../emails/email-sender');
const errorMessages = require('../error-messages');
const role = require('../auth/role');
const tokenTypes = require('../auth/token-types');
const mongoose = require('mongoose');

const authAdmin = require('../auth/auth-middleware')([role.Admin]);

const UserModel = require('../models/users');
const TokenModel = require('../models/tokens');
const ModuleModel = require('../models/modules');
const SessionModel = require('../models/sessions');

var router = express.Router();

// for all paths on this route require admin authenication
router.use(authAdmin);

// get students or mentors (depending on type)
router.get('/students/:type', async function(req, res, next) {
  try {
    let studentType = req.params.type;
    let allowedRoles = [role.Student, role.Mentor];

    if (studentType === "" || !allowedRoles.includes(studentType)) {
      throw {message: errorMessages.NecessaryInfoMissing}
    }
    let studentRecords = await UserModel
      .find({role: studentType})
      .select("-password");
    return res.status(200).send({'success': true, 'data': studentRecords});
  } catch (err) {
    next(err);
  }
})

// get student or mentors by id
router.get('/student/:id', async function(req, res, next) {
  try {
    let studentId = req.params.id;

    if (studentId === "") {
      throw {message: errorMessages.NecessaryInfoMissing};
    }
    let studentRecord = await UserModel
      .findById(studentId)
      .select("-password")
      .populate({path: "assigned_mentor", select:"-password"});
    if (studentRecord === null) {
      throw {message: errorMessages.RecordDoesntExist};
    }
    return res.status(200).send({'success': true, 'data': studentRecord});
  } catch (err) {
    next(err);
  }
});

// update student information - only name and assigned mentor allowed
router.put('/student/:id', async function(req, res, next) {
  try {
    let studentId = req.params.id;

    if (studentId === "") {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    if (Object.keys(req.body).length === 0 || studentId === "") {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    if (
      (!req.body.hasOwnProperty("name") || req.body.name === "") &&
      (!req.body.hasOwnProperty("assigned_mentor") || req.body.assigned_mentor === "")) {
          throw {message: errorMessages.NecessaryInfoMissing};
    }

    let studentRecord = await UserModel
      .findById(studentId)
      .select("-password");
    if (studentRecord === null) {
      throw {message: errorMessages.RecordDoesntExist};
    }

    if (studentRecord.role == role.Student) {
      if (req.body.hasOwnProperty("assigned_mentor") && req.body.assigned_mentor !== "") {
        // check mentor exists
        if (req.body.assigned_mentor === "no_mentor") {
          studentRecord.assigned_mentor = undefined;
        } else {
          studentRecord.assigned_mentor = req.body.assigned_mentor;
        }
      }
    }

    if (req.body.hasOwnProperty("name") && req.body.name !== "") {
      studentRecord.name = req.body.name;
    }

    let updatedStudentRecord = studentRecord.save();
    return res.status(200).send({'success': true, 'data': studentRecord});
  } catch (err) {
    next(err);
  }
})

// invite a new student
router.post('/students', async function(req, res, next) {
  try {
    let allowedRoles = [role.Student, role.Mentor];
    if (Object.keys(req.body).length === 0 ||
      !req.body.hasOwnProperty("email") ||
      !req.body.hasOwnProperty("name") ||
      !req.body.hasOwnProperty("role") ||
      !req.body.hasOwnProperty("assigned_mentor") ||
      req.body.email === "" ||
      req.body.name === "" ||
      req.body.role === "" ||
      req.body.assigned_mentor === "" ||
      !allowedRoles.includes(req.body.role)
    ) {
        //body is empty or doesn't have email
        throw {message: errorMessages.NeedEmailAndName};
    }

    let inviteeEmail = req.body.email;
    let inviteeName = req.body.name;
    let inviteeRole = req.body.role;
    let inviteeMentor = req.body.assigned_mentor;

    //Check if user already exists
    let userRecord = await UserModel.findOne({'email': inviteeEmail});
    //user exists
    if (userRecord !== null) {
      throw {message: errorMessages.UserAlreadyExists};
    }

    if (inviteeMentor === "no_mentor") {
      inviteeMentor = undefined;
    }

    // create new student record
    let newStudentUser = await UserModel.createByInvite(inviteeEmail, inviteeName, inviteeRole, inviteeMentor);

    // create a token for registration
    let tokenData = {
      id: newStudentUser._id,
      type: tokenTypes.Registration
    };

    let expiresIn = 2 * 24 * 60 * 60; //48 hours
    let tokenText = await TokenModel.signToken(tokenData, expiresIn);
    let newToken = await TokenModel.createToken(tokenText, expiresIn);

    // send email
    let templateData = {
      "name": inviteeName,
      "registrationLink": req.protocol+"://"+req.headers.host + "/confirm-registration?token=" + tokenText
    };

    await emailSender.sendEmail('registration', inviteeEmail, templateData);
    return res.status(200).send({'success': true, 'data': {'message': errorMessages.StudentWasEmailed}});
  } catch (err) {
    next(err);
  }
});

// delete a student
router.delete('/student/:id', async function(req, res, next) {
  try {
    let studentId = req.params.id;

    if (studentId === "") {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    // check that the record exists
    let studentRecord = await UserModel.findByIdAndDelete(studentId);
    if (studentRecord == null) {
      throw {message: errorMessages.RecordDoesntExist};
    }
    // delete all student sessions
    let sessionRecords = await SessionModel.deleteMany(
      {
        '$or': [
          {'student': studentId},
          {'mentor': studentId}
      ]});

    return res.status(200).send({'success': true, 'data': {'message': errorMessages.RecordDeleted}});
  } catch (err) {
    next(err);
  }
});

// create a module
router.post('/modules', async function(req, res, next) {
  try {
    if (Object.keys(req.body).length === 0 ||
      !req.body.hasOwnProperty("full_name") ||
      !req.body.hasOwnProperty("short_name") ||
      !req.body.hasOwnProperty("description") ||
      req.body.full_name === "" ||
      req.body.short_name === ""  ||
      req.body.description === ""
    ) {
        throw {message: errorMessages.NecessaryInfoMissing};
    }
    // check that there is no other module with the same short name
    let moduleRecord = await ModuleModel.findOne(
      {
        '$or': [
          {'short_name': req.body.short_name},
          {'full_name': req.body.full_name}
      ]});
    if (moduleRecord !== null) {
      throw {message: errorMessages.ModuleAlreadyExists};
    }
    // create one
    let newModule = new ModuleModel({
          short_name: req.body.short_name,
          full_name: req.body.full_name,
          description: req.body.description
    });
    let newModuleRecord = await newModule.save();
    return res.status(200).send({'success':true, 'data':newModuleRecord});
  } catch (err) {
    next(err);
  }
});

// update a module
router.put('/module/:id', async function(req, res, next) {
  try {
    let moduleId = req.params.id;
    let atLeastOne = ["full_name", "short_name", "description"];

    if (Object.keys(req.body).length === 0 || moduleId === "") {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    let onePresent = false;
    atLeastOne.forEach(function(prop) {
      if (req.body.hasOwnProperty(prop) && req.body[prop] !== "") {
        onePresent = true;
      }
    });

    if (!onePresent) {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    // check that the record exists
    let moduleRecord = await ModuleModel.findById(moduleId);
    if (moduleRecord === null) {
      throw {message: errorMessages.RecordDoesntExist};
    }
    atLeastOne.forEach(function(prop) {
      if (req.body.hasOwnProperty(prop) && req.body[prop] !== "") {
        moduleRecord[prop] = req.body[prop];
      }
    });
    let updatedModuleRecord = await moduleRecord.save();
    return res.status(200).send({'success': true, 'data':updatedModuleRecord});
  } catch (err) {
    next(err);
  }
});

// delete a module
router.delete('/module/:id', async function(req, res, next) {
  try {
    let moduleId = req.params.id;

    if (moduleId === "") {
      throw {message: errorMessages.NecessaryInfoMissing};
    }

    // check that the record exists
    let moduleRecord = await ModuleModel.findByIdAndDelete(moduleId);

    if (moduleRecord == null) {
      throw {message: errorMessages.RecordDoesntExist};
    }
    // delete module from student records todo
    await UserModel.update({},
      {$pull: {watched_modules: mongoose.Types.ObjectId(moduleId)}},
      {multi: true}
    );

    return res.status(200).send({'success':true, 'data': {'message': errorMessages.RecordDeleted}});
  } catch (err) {
    next(err)
  }
});

module.exports = router;
