const role = require('../auth/role');
const authSocketStudent = require('../auth/auth-socket')([role.Student, role.Mentor]);
const SessionModel = require('../models/sessions');
const errorMessages = require('../error-messages');

function setUpSocketChat(server) {
  var io = require('socket.io')(server);

  io.use(authSocketStudent);
  io.on('connection', function (socket) {
    // start a chat with mentor/student - joins user to the room
    socket.on('start_chat', async function (chatStartData) {
      // check that we got all data we need
      try {
        if (
          !chatStartData.hasOwnProperty("sessionId") ||
          chatStartData.sessionId === ""
        ) {
          throw {message:errorMessages.NecessaryInfoMissing};
        }
        let sessionId = chatStartData.sessionId;
        let sessionRecord = await SessionModel
          .findOne({$or: [{'student': socket.userRecord._id}, {'mentor': socket.userRecord._id}], _id: sessionId})
          .populate("student", "name")
          .populate("mentor", "name");
        if (sessionRecord === null) {
          throw {message:errorMessages.RecordDoesntExist};
        }
        // session exists and they are a valid participant - join them to the room
        socket.join(sessionId);
        socket.emit('start_chat', {
          'success': true,
          'data': sessionId
        });
        socket.sessionRoom = sessionId;
      } catch (err) {
        socket.emit('start_chat', {
          'message': "Cannot join session. Please restart the app",
          'success': false
        });
      }
    });

    // end a chat - on exit from chat room
    socket.on('exit_chat', async function() {
      socket.leave(socket.sessionRoom);
      socket.sessionRoom = null;
      socket.emit('exit_chat', {
        'success': true,
        'data': {}
      });
    });

    // send a message to the room
    socket.on('message', async function (chatMessageData) {
      try {
        if (socket.sessionRoom == null) {
          throw {message:"Cannot join session. Please restart the app"};
        }
        // get the message - check that all data is present
        if (
          !chatMessageData.hasOwnProperty("text") ||
          chatMessageData.text === ""
        ) {
          throw {message:"Could not send message - please try again"};
        }
        let textBody = chatMessageData.text;

        let sessionRecord = await SessionModel
          .findOne({$or: [{'student': socket.userRecord._id}, {'mentor': socket.userRecord._id}], _id: socket.sessionRoom})
          .populate("student", "name")
          .populate("mentor", "name");
        if (sessionRecord === null) {
          throw {message:errorMessages.RecordDoesntExist};
        }
        // save new message to the session object
        sessionRecord.messages.push({
          from: socket.userRecord._id,
          body: textBody
        });

        sessionRecord = await sessionRecord.save();
        // emit to everyone in the room
        io.to(socket.sessionRoom).emit('message', {
          'success': true,
          'data': sessionRecord.messages[sessionRecord.messages.length - 1]
        });
      } catch (err) {
        socket.emit('message', {
          'message': err.message,
          'success': false
        });
      }
    });

    socket.on('finalize_chat', async function (chatMessageData) {
      try {
        if (socket.sessionRoom == null) {
          throw {message:"Cannot join session. Please restart the app"};
        }
        // mark the chat as completed - set end_date to now
        let sessionRecord = await SessionModel
          .findOne({$or: [{'student': socket.userRecord._id}, {'mentor': socket.userRecord._id}], _id: socket.sessionRoom})
          .populate("student", "name")
          .populate("mentor", "name");
        if (sessionRecord === null) {
          throw {message:errorMessages.RecordDoesntExist};
        }
        sessionRecord.ends_at = new Date();
        await sessionRecord.save();
        // exit the room
        io.to(socket.sessionRoom).emit('exit_chat', {
          'success': true,
          'data': {}
        });
        socket.leave(socket.sessionRoom);
        socket.sessionRoom = null;
      } catch (err) {
        socket.emit('exit_chat', {
          'message': err.message,
          'success': false
        });
      }
    });

  });
}

module.exports = setUpSocketChat;
