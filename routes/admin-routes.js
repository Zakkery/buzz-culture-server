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
router.get('/students/:type', async function(req, res) {
  let studentType = req.params.type;
  let allowedRoles = [role.Student, role.Mentor];

  if (studentType === "" || !allowedRoles.includes(studentType)) {
    return res.status(200).send({'error': errorMessages.NecessaryInfoMissing});
  }

  try {
    let studentRecords = await UserModel
      .find({role: studentType})
      .select("-password");
    return res.status(200).send({data: studentRecords});
  } catch (err) {
    console.log(err);
    return res.status(200).send({'error': err});
  }
})

// get student or mentors by id
router.get('/student/:id', async function(req, res) {
  let studentId = req.params.id;

  if (studentId === "") {
    return res.status(200).send({'error': errorMessages.NecessaryInfoMissing});
  }
  try {
    let studentRecord = await UserModel
      .findById(studentId)
      .select("-password")
      .populate({path: "assigned_mentor", select:"-password"});
    if (studentRecord === null) {
      return res.status(200).send({'error': errorMessages.RecordDoesntExist});
    }
    return res.status(200).send({data: studentRecord});
  } catch (err) {
    console.log(err);
    return res.status(200).send({'error': err});
  }
});

// update student information - only name and assigned mentor allowed
router.put('/student/:id', async function(req, res) {
  let studentId = req.params.id;

  if (studentId === "") {
    return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }

  if (Object.keys(req.body).length === 0 || studentId === "") {
    return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }

  if (
    (!req.body.hasOwnProperty("name") || req.body.name === "") &&
    (!req.body.hasOwnProperty("assigned_mentor") || req.body.assigned_mentor === "")) {
        return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }

  try {
    let studentRecord = await UserModel
      .findById(studentId)
      .select("-password");
    if (studentRecord === null) {
      return res.status(400).send(errorMessages.RecordDoesntExist);
    }

    if (studentRecord.role == role.Student) {
      if (req.body.hasOwnProperty("assigned_mentor") && req.body.assigned_mentor !== "") {
        // check mentor exists
        let mentorRecord = await UserModel.findById(req.body.assigned_mentor);
        if (mentorRecord !== null) {
          studentRecord.assigned_mentor = req.body.assigned_mentor;
        }
      }
    }

    if (req.body.hasOwnProperty("name") && req.body.name !== "") {
      studentRecord.name = req.body.name;
    }

    let updatedStudentRecord = studentRecord.save();
    return res.status(200).send({data: studentRecord});
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
})

// invite a new student
router.post('/students', async function(req, res) {
  let allowedRoles = [role.Student, role.Mentor];
  if (Object.keys(req.body).length === 0 ||
    !req.body.hasOwnProperty("email") ||
    !req.body.hasOwnProperty("name") ||
    !req.body.hasOwnProperty("role") ||
    req.body.email === "" ||
    req.body.name === "" ||
    req.body.role === "" ||
    !allowedRoles.includes(req.body.role)
  ) {
      //body is empty or doesn't have email
      return res.status(400).send(errorMessages.NeedEmailAndName);
  }

  let inviteeEmail = req.body.email;
  let inviteeName = req.body.name;
  let inviteeRole = req.body.role;

  try {
    //Check if user already exists
    let userRecord = await UserModel.findOne({'email': inviteeEmail});
    //user exists
    if (userRecord !== null) {
      return res.status(400).send(errorMessages.UserAlreadyExists);
    }
    // create new student record
    let newStudentUser = await UserModel.createByInvite(inviteeEmail, inviteeName, inviteeRole);
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
    return res.status(200).send(errorMessages.StudentWasEmailed);
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
});

// delete a student
router.delete('/student/:id', async function(req, res) {
  let studentId = req.params.id;

  if (studentId === "") {
    return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }

  // find student
  try {
    // check that the record exists
    let studentRecord = await UserModel.findByIdAndDelete(studentId);
    if (studentRecord == null) {
      return res.status(400).send(errorMessages.RecordDoesntExist);
    }
    // delete all student sessions
    let sessionRecords = await SessionModel.deleteMany(
      {
        '$or': [
          {'student': studentId},
          {'mentor': studentId}
      ]});

    return res.status(200).send(errorMessages.RecordDeleted);
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }

});

// create a module
router.post('/modules', async function(req, res) {
  if (Object.keys(req.body).length === 0 ||
    !req.body.hasOwnProperty("full_name") ||
    !req.body.hasOwnProperty("short_name") ||
    !req.body.hasOwnProperty("description") ||
    req.body.full_name === "" ||
    req.body.short_name === ""  ||
    req.body.description === ""
  ) {
      return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }
  try {
    // check that there is no other module with the same short name
    let moduleRecord = await ModuleModel.findOne(
      {
        '$or': [
          {'short_name': req.body.short_name},
          {'full_name': req.body.full_name}
      ]});
    if (moduleRecord !== null) {
      return res.status(400).send(errorMessages.ModuleAlreadyExists);
    }
    // create one
    let newModule = new ModuleModel({
          short_name: req.body.short_name,
          full_name: req.body.full_name,
          description: req.body.description
    });
    let newModuleRecord = await newModule.save();
    return res.status(200).send({'data':newModuleRecord});
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
});

// update a module
router.put('/module/:id', async function(req, res) {
  let moduleId = req.params.id;
  let atLeastOne = ["full_name", "short_name", "description"];

  if (Object.keys(req.body).length === 0 || moduleId === "") {
    return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }

  let onePresent = false;
  atLeastOne.forEach(function(prop) {
    if (req.body.hasOwnProperty(prop) && req.body[prop] !== "") {
      onePresent = true;
    }
  });

  if (!onePresent) {
    return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }

  try {
    // check that the record exists
    let moduleRecord = await ModuleModel.findById(moduleId);
    if (moduleRecord === null) {
      return res.status(400).send(errorMessages.RecordDoesntExist);
    }
    atLeastOne.forEach(function(prop) {
      if (req.body.hasOwnProperty(prop) && req.body[prop] !== "") {
        moduleRecord[prop] = req.body[prop];
      }
    });
    let updatedModuleRecord = await moduleRecord.save();
    return res.status(200).send({'data':updatedModuleRecord});
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
});

// delete a module
router.delete('/module/:id', async function(req, res) {
  let moduleId = req.params.id;

  if (moduleId === "") {
    return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }

  try {
    // check that the record exists
    let moduleRecord = await ModuleModel.findByIdAndDelete(moduleId);

    if (moduleRecord == null) {
      return res.status(400).send(errorMessages.RecordDoesntExist);
    }
    // delete module from student records todo
    await UserModel.update({},
      {$pull: {watched_modules: mongoose.Types.ObjectId(moduleId)}},
      {multi: true}
    );

    return res.status(200).send(errorMessages.RecordDeleted);
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
});

module.exports = router;
