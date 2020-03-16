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
router.get('/mentor', async function(req, res) {
  if (req.userRecord.role !== role.Student) {
    return res.status(200).send({data: ""});
  }
  try {
    return res.status(200).send({data: await req.userRecord.assigned_mentor});
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
});

// get student information
router.get('/account', async function(req, res) {
  try {
    let studentRecord = req.userRecord;
    return res.status(200).send({data: studentRecord});
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
});

// update student information - only name allowed
router.put('/account', async function(req, res) {
  if (Object.keys(req.body).length === 0) {
    return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }

  if (
    (!req.body.hasOwnProperty("name") || req.body.name === "")) {
        return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }

  try {
    let studentRecord = req.userRecord;

    if (req.body.hasOwnProperty("name") && req.body.name !== "") {
      studentRecord.name = req.body.name;
    }

    let updatedStudentRecord = await studentRecord.save();
    return res.status(200).send({data: updatedStudentRecord});
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
});


module.exports = router;
