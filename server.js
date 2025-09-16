const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const users = new Map(); // username -> socket.id

function broadcastUserList() {
  io.emit('online_users', Array.from(users.keys()));
}

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('register', (username, cb) => {
    if (!username) return cb({ ok: false, error: 'username required' });
    users.set(username, socket.id);
    socket.username = username;
    console.log(`registered ${username} -> ${socket.id}`);
    broadcastUserList();
    cb({ ok: true });
  });

  socket.on('private_message', (payload, cb) => {
    const { to, message } = payload || {};
    if (!socket.username) return cb({ ok: false, error: 'register first' });
    if (!to || !message) return cb({ ok: false, error: 'to and message required' });

    const targetSocketId = users.get(to);
    const from = socket.username;
    const msgObj = { from, to, message, time: Date.now() };

    if (targetSocketId) {
      io.to(targetSocketId).emit('private_message', msgObj);
      socket.emit('private_message', msgObj); // echo
      cb({ ok: true });
    } else {
      cb({ ok: false, error: 'user offline' });
    }
  });

  socket.on('group_message', (payload, cb) => {
    const { message } = payload || {};
    if (!socket.username) return cb({ ok: false, error: 'register first' });
    if (!message) return cb({ ok: false, error: 'message required' });

    const msgObj = { from: socket.username, message, time: Date.now() };
    io.emit('group_message', msgObj);
    cb({ ok: true });
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      console.log(`disconnect ${socket.username}`);
      users.delete(socket.username);
      broadcastUserList();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
