//Require Mongoose
var mongoose = require('mongoose');

//Require roles
var role = require('../auth/role');

//Create a Schema
var Schema = mongoose.Schema;

var UserModelSchema = new Schema({
  name              : {
    type: String,
    required: true
  },
  password          : {
    type: String
  },
  email             : {
    type: String,
    unique: true,
    required: true
  },
  assigned_mentor   : {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  role              : {
    type: String,
    required: true,
    enum: [role.Admin, role.Student, role.Mentor]
  },
  watched_modules   : [
    {
      type: Schema.Types.ObjectId,
      ref: "Module"
    }
  ],
  confirmed         : {
    type: Boolean,
    required: true,
    default: false
  }
});

// Default user invitation create method
UserModelSchema.static('createByInvite', function(email, name, role, mentor_id) {
  var newStudentUser = new this({
        name: name,
        email: email,
        role: role,
        assigned_mentor: mentor_id
  });
  return newStudentUser.save();
});


module.exports = mongoose.model('User', UserModelSchema);
