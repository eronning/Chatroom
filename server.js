//node modules you'll need
var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var anyDB = require('any-db');
var path = require('path');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);


var cons = require('consolidate');
var viewPath = __dirname + '/views/html/';
// setup html engine
app.engine('html', cons.swig)
app.set('views', viewPath);
app.set('view engine', 'html');
// allow for parsing post requests
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'views')));

//global variables
var port = 8080;
var room_map = [];
var conn = anyDB.createConnection('sqlite3://chatroom.db');
var date = new Date();

//listen at localhost 8080!
server.listen(port);
console.log("Started server on port: " + port);

// schema for the table to add which adds if the table doesn't already exist
var messagesSchema = "CREATE TABLE IF NOT EXISTS messages ("
		+ "id INTEGER PRIMARY KEY AUTOINCREMENT, "
		+ "room TEXT, "
		+ "nickname TEXT, "
		+ "body TEXT, "
		+ "time INTEGER);";

// creates the table in the db
conn.query(messagesSchema)
	.on('end', function(e){
});
// get all of the rooms that are active
var sql_query = 'SELECT DISTINCT room FROM messages;';
conn.query(sql_query, function (err, res) {
	var rooms = res.rows;
	for (r in rooms) {
		room_map[rooms[r].room] = true;
	}
}); 

var namespace = '/';

io.sockets.on('connection', function(socket){
    // clients emit this when they join new rooms
    socket.on('join', function(roomName, nickname, callback){
        socket.join(roomName); // this is a socket.io method
        socket.nickname = nickname; // yay JavaScript! see below
        socket.roomname = roomName;
        // all the room members for this room
        var roomMembers = getRoomMembers(roomName);
        io.sockets.in(roomName).emit('membershipChanged', roomMembers);
        // get a list of messages currently in the room, then send it back
        var sql_query = 'SELECT * FROM messages WHERE room=$1 ORDER BY time ASC';
	    conn.query(sql_query, [roomName], function (err, res) {
	    	callback(res);
		});
        // show that a member has been added to the room
		io.sockets.in(roomName).emit('memberAdded', socket.nickname, date.getTime());  
    });

    // this gets emitted if a user changes their nickname
    socket.on('nickname', function(roomName, newNickname, oldNickname){
        var sql_query = 'UPDATE messages SET nickname = $1 WHERE room=$2 AND nickname=$3;';
        conn.query(sql_query, [newNickname, roomName, socket.nickname], function (err, res) {
            socket.nickname = newNickname;
            // update the room members list
            var roomMembers = getRoomMembers(roomName);
            io.sockets.in(roomName).emit('membershipChanged', roomMembers);
            // refresh the messages list
            var sql_query = 'SELECT * FROM messages WHERE room=$1 ORDER BY time ASC';
            conn.query(sql_query, [roomName], function (err, res) {
                io.sockets.in(roomName).emit('changedNickname', res, newNickname, oldNickname);
            });
        });
    });

    // the client emits this when they want to send a message
    socket.on('message', function(roomName, nickname, message, time){
        // insert the message into the database
		var sql_query = 'INSERT INTO messages (room, nickname, body, time) VALUES ($1, $2, $3, $4);';
		conn.query(sql_query, [roomName, nickname, message, time])
			.on('end', function() {
		});
        // broadcast the message to all connected parties
		io.sockets.in(roomName).emit('message', nickname, message, time);
    });

    // the client disconnected/closed their browser window
    socket.on('disconnect', function(){
        var roomName = socket.roomname;
        var roomMembers = getRoomMembers(roomName);
        if (roomMembers.length > 0) {
            // the room is not empty -> update the list
            io.sockets.in(roomName).emit('membershipChanged', roomMembers);
            // show that the member has left the room
            io.sockets.in(roomName).emit('memberLeft', socket.nickname, date.getTime()); 
        } else {
            // the room is empty -> remove the room
            var sql_query = 'DELETE FROM messages WHERE room = $1;';
            conn.query(sql_query, [roomName])
                .on('end', function() {
            });
        } 
    });

});

// gets the nicknames of all of the connected parties in a room
function getRoomMembers(roomName) {
    var connected = io.sockets.in(roomName).connected;
    var connectedList = [];
    for (i in connected) {
        var nickname = connected[i].nickname;
        if (nickname !== undefined) {
            connectedList.push(nickname);
        }
    }
    return connectedList;
}


//just render the index! 
app.get('/', function(request, response) {
    // render the home page
	response.render('index.html');
});

app.get('/room/:roomName', function(request, response){
	response.render(viewPath + 'room.html', {roomName: request.params.roomName});
});

app.get('/:roomName/messages.json', function(request, response){
    // fetch all of the messages for this room
    var sql_query = 'SELECT * FROM messages WHERE room=$1 ORDER BY time ASC';
    conn.query(sql_query, [request.params.roomName], function (err, res) {
    	response.json(res);
	});    
});

app.post('/:roomName/messages', function(request, response){
    // post everything to the database, then...
    var nickName = request.body.nickname;
    var message = request.body.message;
    var roomName = request.params.roomName;
	var time = date.getTime();
	var sql_query = 'INSERT INTO messages (room, nickname, body, time) VALUES ($1, $2, $3, $4);';
	conn.query(sql_query, [roomName, nickName, message, time])
	    .on('end', function() {
    });
    response.redirect('/room/' + request.params.roomName);
});

// build a new room
app.post('/new/room', function(request, response) {
	var identifier = generateUniqueRoomIdentifier();
    response.send(identifier);
});

// generate a random identifier
function generateRoomIdentifier() {
    // make a list of legal characters
    // we're intentionally excluding 0, O, I, and 1 for readability
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var result = '';
	for (var i = 0; i < 6; i++)
		result += chars.charAt(Math.floor(Math.random() * chars.length));    
    return result;
}
// make sure that the room name is unique
function generateUniqueRoomIdentifier() {
	var id = generateRoomIdentifier();
	while (room_map[id] != undefined) {
		id = generateRoomIdentifier();
	}
	room_map[id] = true;
	return id;
}