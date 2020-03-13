const express = require('express');
const emailSender = require('../emails/email-sender');
const errorMessages = require('../error-messages');
const role = require('../auth/role');

const authAll = require('../auth/auth-middleware')([role.Admin, role.Student, role.Mentor]);

const ModuleModel = require('../models/modules');

var router = express.Router();

// for all paths on this route require admin authenication
router.use(authAll);

// get modules list
router.get('/modules', async function(req, res) {
  try {
    //Get all existing modules
    let moduleRecords = await ModuleModel.find().select('-short_name -description');
    return res.status(200).send({'data': moduleRecords});
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
});

// get module by id
router.get('/module/:id', async function(req, res) {
  let moduleId = req.params.id;

  if (moduleId === "") {
    return res.status(400).send(errorMessages.NecessaryInfoMissing);
  }

  try {
    let moduleRecord = await ModuleModel
      .findById(moduleId);
    if (moduleRecord === null) {
      return res.status(400).send(errorMessages.RecordDoesntExist);
    }
    return res.status(200).send({data: moduleRecord});
  } catch (err) {
    console.log(err);
    return res.status(400).send(err);
  }
});

module.exports = router;
