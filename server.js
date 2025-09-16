// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from ./public
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory user -> socketId map
const users = new Map(); // username -> socket.id

function broadcastUserList() {
  const list = Array.from(users.keys());
  io.emit('online_users', list);
}

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('register', (username, cb) => {
    if (!username) return cb && cb({ ok: false, error: 'username required' });
    users.set(username, socket.id);
    socket.username = username;
    console.log(`registered ${username} -> ${socket.id}`);
    broadcastUserList();
    cb && cb({ ok: true });
  });

  // Private message: payload { to: recipientUsername, message }
  socket.on('private_message', (payload, cb) => {
    const { to, message } = payload || {};
    if (!socket.username) return cb && cb({ ok: false, error: 'register first' });
    if (!to || !message) return cb && cb({ ok: false, error: 'to and message required' });

    const targetSocketId = users.get(to);
    const from = socket.username;

    const msgObj = {
      from,
      to,
      message,
      time: Date.now()
    };

    if (targetSocketId) {
      // send to recipient socket
      io.to(targetSocketId).emit('private_message', msgObj);
      // also echo to sender for UI
      socket.emit('private_message', msgObj);
      cb && cb({ ok: true });
    } else {
      cb && cb({ ok: false, error: 'user offline' });
    }
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
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
