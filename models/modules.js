//Require Mongoose
var mongoose = require('mongoose');

//Create a Schema
var Schema = mongoose.Schema;

var ModuleModelSchema = new Schema({
  full_name         : {
    type: String,
    required: true
  },
  short_name        : {
    type: String,
    required: true
  },
  description       : {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Module', ModuleModelSchema);
