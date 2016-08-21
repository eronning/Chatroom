var socket;
var oldNickname = '';
var nickname = '';
var date = new Date();
var type = {
  MESSAGE: 1,
  JOINED: 2,
  LEFT: 3,
  NICKNAME_CHANGE: 4
};

// fired when the page has loaded
window.addEventListener('load', function(){

    var messageForm = document.getElementById('messageForm');  
    messageForm.addEventListener('submit', sendMessage, false);

    // get the nickname
    $('#nicknameModal').modal('show');
    // save the value of the nickname
    $('#saveNickname').on('click', function(evt) {
        nickname = $('#nicknameText').val();
        if (nickname != "") {
          $('#nicknameModal').modal('hide');
          socket = io.connect();  
          // handle incoming messages
          socket.on('message', function(nickname, message, time){
              // display a newly-arrived message            
              addToContainer(type.MESSAGE, nickname, message, time);
          });

          // handle room membership changes
          socket.on('membershipChanged', function(members){
              // display the new member list
              $('#memberList').empty();
              var list = document.getElementById('memberList');
              // iterate through all the members
              for (i in members) {
                // create an element for the member
                var li = document.createElement('li');
                li.innerHTML = members[i];
                // add the member to the list
                list.appendChild(li);
              }
          });

          // a member is added to the chatroom
          socket.on('memberAdded', function(nickname, time){
              addToContainer(type.JOINED, nickname, '', time);
          });

          // a member is added to the chatroom
          socket.on('memberLeft', function(nickname, time){
              addToContainer(type.LEFT, nickname, '', time);
          });

          socket.on('changedNickname', function(messages, newNickname, oldNickname){
              fillContainer(messages.rows);
              // add a info update about the nickname change
              addToContainer(type.NICKNAME_CHANGE, newNickname, oldNickname, date.getTime());
          });

          // join the room
          socket.emit('join', meta('roomName'), nickname, function(messages){
              fillContainer(messages.rows);
          });
        }
    });

    $('#changeNickname').unbind().click(function() {
      $('#changeNicknameModal').modal('show');
      $('#saveChangedNickname').unbind().click(function() {
        var newNickname = $('#changeNicknameText').val();
        if (newNickname != "") {
          oldNickname = nickname;
          // broadcast to the server that the nickname for this user has changed
          socket.emit('nickname', meta('roomName'), newNickname, oldNickname, function(){});
          // update the global reference for the nickname
          nickname = newNickname;
          // change has been made
          $('#changeNicknameModal').modal('hide');
        }
      });
    });


}, false);

function fillContainer(data) {
  // clear container
  $("#container").empty();
  // add all of the data to the container
  for (i in data) {
    var entry = data[i];
    addToContainer(type.MESSAGE, entry.nickname, entry.body, entry.time);
  }
}

// declare the meta function
function meta(name) {
    var tag = document.querySelector('meta[name=' + name + ']');
    if (tag != null)
        return tag.content;
    return '';
}

function addToContainer(dataType, nickname, message, time) {
    // add appropriate message to the container
    var info;
    switch (dataType) {
      case type.MESSAGE:
        info = toMessage(nickname, message, time);
        break;
      case type.JOINED:
        info = toNotification(dataType, nickname, time);
        break;
      case type.LEFT:
        info = toNotification(dataType, nickname, time);
        break;
      case type.NICKNAME_CHANGE:
        info = toChangeInfo(nickname, message, time);
        break;
    }
    var p = document.createElement("p");
    p.innerHTML = info;

    var container = document.getElementById("container");
    container.insertBefore(p, container.firstChild);
}

// send a message
function sendMessage(e) {
  // prevent the page from redirecting
  e.preventDefault();
  if (nickname != '') {
      var messageText = document.getElementById('messageField');
      // get the message
      var message = messageText.value;
      //get the current time
      var time = date.getTime();
      // send a message to the server
      socket.emit('message', meta('roomName'), nickname, message, time);
      // clear the text field
      messageText.value = "";
      
    } else {
      $('#nicknameModal').modal('show');
    }
}

// generates a notification based on a person joining or leaving the room
function toNotification(dataType, nickname, time) {
    var info;
    switch (dataType) {
      case type.JOINED:
        info = 'joined';
        break;
      case type.LEFT:
        info = 'left';
        break;
    }
    return toBold(nickname) + " " + info + " the room " + toTimeString(time);
}

// generates a info update about a nickname change
function toChangeInfo(newNickname, oldNickname, time) {
  return toBold(oldNickname) + " has changed their nickname to " + toBold(newNickname) + toTimeString(time);
}
// puts a message in a formatted string
function toMessage(nickname, message, time) {
    return toBold(nickname) + " -> " + message + toTimeString(time);
}
function toBold(string) {
  return "<strong>" + string + "</strong>";
}

function toTimeString(time) {
  return " <span style='float:right'>" + timeToString(time) + "</span>";
}
// converts time to human readable format
function timeToString(time) {
  var date = new Date(time);
  return date.toLocaleTimeString();
}