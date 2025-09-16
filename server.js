const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ======================
// MongoDB Setup
// ======================
mongoose.connect('mongodb://127.0.0.1:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error(err));

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  socketId: { type: String }
});

const MessageSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, default: null }, // null = group message
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// ======================
// Memory store for online users
// ======================
const users = new Map(); // username -> socket.id

async function broadcastUserList() {
  const onlineUsers = Array.from(users.keys());
  io.emit('online_users', onlineUsers);
}

// ======================
// Socket.io Handlers
// ======================
io.on('connection', (socket) => {
  console.log('⚡ socket connected', socket.id);

  // Register user
  socket.on('register', async (username, cb) => {
    if (!username) return cb({ ok: false, error: 'username required' });

    users.set(username, socket.id);
    socket.username = username;

    await User.findOneAndUpdate(
      { username },
      { socketId: socket.id },
      { upsert: true, new: true }
    );

    console.log(`✅ registered ${username} -> ${socket.id}`);
    broadcastUserList();

    cb({ ok: true });
  });

  // 🔹 Fetch history when switching chats
  socket.on('get_history', async ({ withUser }, cb) => {
    let query;
    if (withUser === 'group') {
      query = { to: null };
    } else {
      query = {
        $or: [
          { from: socket.username, to: withUser },
          { from: withUser, to: socket.username }
        ]
      };
    }

    const history = await Message.find(query).sort({ timestamp: 1 }).limit(50);
    cb(history);
  });

  // Private message
  socket.on('private_message', async (payload, cb) => {
    const { to, message } = payload || {};
    if (!socket.username) return cb({ ok: false, error: 'register first' });
    if (!to || !message) return cb({ ok: false, error: 'to and message required' });

    const targetSocketId = users.get(to);
    const from = socket.username;
    const msgObj = { from, to, message, timestamp: new Date() };

    // save to DB
    await new Message(msgObj).save();

    if (targetSocketId) {
      io.to(targetSocketId).emit('private_message', msgObj);
    }

    cb({ ok: true, msg: msgObj }); // sender gets ack
  });

  // Group message
  socket.on('group_message', async (payload, cb) => {
    const { message } = payload || {};
    if (!socket.username) return cb({ ok: false, error: 'register first' });
    if (!message) return cb({ ok: false, error: 'message required' });

    const msgObj = { from: socket.username, to: null, message, timestamp: new Date() };

    // save to DB
    await new Message(msgObj).save();

    io.emit('group_message', msgObj); // broadcast
    cb({ ok: true });
  });

  // Disconnect
  socket.on('disconnect', async () => {
    if (socket.username) {
      console.log(`❌ disconnect ${socket.username}`);
      users.delete(socket.username);

      await User.findOneAndUpdate(
        { username: socket.username },
        { socketId: null }
      );

      broadcastUserList();
    }
  });
});

// ======================
// Start Server
// ======================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
