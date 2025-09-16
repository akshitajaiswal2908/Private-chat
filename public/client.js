const socket = io();
let myUsername = null;
let currentChat = "group"; // default
let chats = {}; // store messages locally

// Register
function register(username) {
  socket.emit('register', username, (res) => {
    if (res.ok) {
      myUsername = username;
      switchChat("group"); // load group by default
    } else {
      alert(res.error);
    }
  });
}

// Switch chat
function switchChat(user) {
  currentChat = user;
  document.getElementById("chat-header").textContent =
    user === "group" ? "💬 Group Chat" : `💬 Chat with ${user}`;

  socket.emit('get_history', { withUser: user }, (history) => {
    chats[user] = history;
    renderMessages(history);
  });
}

// Send private message
function sendPrivate(to, message) {
  socket.emit('private_message', { to, message }, (res) => {
    if (res.ok) {
      const msg = res.msg; // from server ack
      chats[to] = chats[to] || [];
      chats[to].push(msg);
      if (currentChat === to) renderMessages(chats[to]);
    } else {
      alert(res.error);
    }
  });
}

// Send group message (no duplication)
function sendGroup(message) {
  socket.emit('group_message', { message }, (res) => {
    if (!res.ok) alert(res.error);
  });
}

// Incoming private messages
socket.on('private_message', (msg) => {
  const chatKey = msg.from === myUsername ? msg.to : msg.from;
  chats[chatKey] = chats[chatKey] || [];
  chats[chatKey].push(msg);

  if (currentChat === chatKey) renderMessages(chats[chatKey]);
});

// Incoming group messages
socket.on('group_message', (msg) => {
  chats["group"] = chats["group"] || [];
  chats["group"].push(msg);

  if (currentChat === "group") renderMessages(chats["group"]);
});

// Online users list
socket.on('online_users', (onlineUsers) => {
  const userList = document.getElementById("user-list");
  userList.innerHTML = "";

  // Always keep Group Chat button
  const groupBtn = document.createElement("button");
  groupBtn.textContent = "Group Chat";
  groupBtn.onclick = () => switchChat("group");
  userList.appendChild(groupBtn);

  // Add all live users except me
  onlineUsers.forEach(u => {
    if (u !== myUsername) {
      const btn = document.createElement("button");
      btn.textContent = u;
      btn.onclick = () => switchChat(u);
      userList.appendChild(btn);
    }
  });
});

// Render helper
function renderMessages(msgs) {
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML = "";
  msgs.forEach(m => {
    const div = document.createElement("div");
    div.textContent = `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.from}: ${m.message}`;
    chatBox.appendChild(div);
  });
}
