//Require Mongoose
var mongoose = require('mongoose');

//Create a Schema
var Schema = mongoose.Schema;

var MessageModelSchema = new Schema({
  from                 : {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  body                  : {
    type: String,
    required: true
  },
  sent_at               : {
    type : Date,
    default: Date.now
  }
});

var SessionModelSchema = new Schema({
  student               : {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  mentor                : {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  topic                 : {
    type: String,
    required: true
  },
  starts_at             : {
    type: Date,
    required: true
  },
  ends_at               : {
    type: Date,
    required: false
  },
  messages              : [MessageModelSchema],
  approved              : {
    type: Boolean,
    required: true,
    default: false
  }
});

module.exports = mongoose.model('Session', SessionModelSchema);
