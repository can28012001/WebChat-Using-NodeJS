const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const formatMessage = require("./utils/messages");
const redis = require("redis");
const {create} = require('express-handlebars');
const bcrypt = require('bcrypt');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const encoder = bodyParser.urlencoded({
  extended: true
});
const { createClient } = redis;
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./utils/users");

const connection = mysql.createConnection({
  host:'localhost',
  user:'root',
  password:'',
  database:'web_chat',
  port:'4306'
})

// Connection DB
connection.connect(function(err){
  if(err) throw err
  else console.log('connection to the DB was successful')
})

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const hbs = create({
  extname: '.hbs',
});


app.use(express.urlencoded({
  extended: true
 }));
 app.use(express.json());

// Set static folder
app.use(express.static(path.join(__dirname, "public/")));
// app.use(express.static(path.join(__dirname, "views/")));

app.engine('hbs', hbs.engine)
app.set('view engine', 'hbs')
app.set('views', path.join(__dirname,'views'))

app.get('/', (req, res) => {
  res.render('login')
})

app.post('/',encoder, (req, res) => {
  var email=req.body.email;
  var password=req.body.password;
  connection.query("select * from users where email = ? and password = ?",[email,password] ,function(error, results,fields){
    if(results.length > 0) {
      res.redirect('/username')
    }
    else {
      res.redirect('/')
    }
    res.end()
  })
});


app.get('/register', (req, res) => {
  res.render('register')
})

app.post("/register", async (req, res) => {

  try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10)
          let name= req.body.name;
          let email= req.body.email;
          let pass= req.body.password;
          let user_info ={name: name, password:pass, email:email};  
      var sql ='INSERT INTO users SET ?';
      connection.query(sql, user_info, function (err, result) {
      if (err) throw err;
      console.log("inserted!");
 });
      res.redirect("/")
      
  } catch (e) {
      console.log(e);
      res.redirect("/register")
  }
})

app.get('/username', (req, res) => {
  res.render('username')
})

app.get('/chat', (req, res) => {
  res.render('chat')
})

const botName = "ChatCord Bot";


// Run when client connects
io.on("connection", (socket) => {
  console.log(io.of("/").adapter);
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Welcome current user
    socket.emit("message", formatMessage(botName, "Welcome to ChatCord!"));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  // Listen for chatMessage
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});



const PORT = 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));