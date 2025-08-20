
// Frontend main script
const BACKEND_URL = window.BACKEND_URL || 'http://localhost:3000/';
const WS_URL = window.WS_URL || 'ws://localhost:3000';

let socket = null;
let currentUser = '';
let selectedUser = '';
const worldBtn = document.getElementById('worldBtn');

// DOM refs
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const chatBox = document.getElementById('chatBox');
const userList = document.getElementById('userList');
const chatForm = document.getElementById('chatForm');
const searchInput = document.getElementById('searchInput');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const saveProfile = document.getElementById('saveProfile');

function showLogin() { loginModal.style.display = 'flex'; }


async function register(username, password, displayName, avatarUrl, backgroundUrl) {
  const res = await fetch(BACKEND_URL + 'register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName, avatarUrl, backgroundUrl })
  });
  return res.ok;
}

async function login(username, password) {
  const res = await fetch(BACKEND_URL + 'login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const displayName = document.getElementById('displayName').value.trim();
  const avatarUrl = document.getElementById('avatarUrl').value.trim();
  const backgroundUrl = document.getElementById('backgroundUrl').value.trim();
  if (!username || !password) return alert('Username and password required');
  // If displayName is present, treat as register
  if (displayName) {
    const ok = await register(username, password, displayName, avatarUrl, backgroundUrl);
    if (!ok) { alert('Could not register'); return; }
    currentUser = username;
    document.getElementById('profileUsername').textContent = username;
    document.getElementById('profileName').textContent = displayName;
    loginModal.style.display = 'none';
    connectWS();
    await loadUsers();
  } else {
    // login flow
    const user = await login(username, password);
    if (!user) { alert('Login failed'); return; }
    currentUser = username;
    document.getElementById('profileUsername').textContent = username;
    document.getElementById('profileName').textContent = user.displayName || username;
    if (user.avatarUrl) document.getElementById('profileAvatar').src = user.avatarUrl;
    if (user.backgroundUrl) document.querySelector('.chat-box').style.backgroundImage = `url(${user.backgroundUrl})`;
    loginModal.style.display = 'none';
    connectWS();
    await loadUsers();
  }
});

async function loadUsers() {
  const res = await fetch(BACKEND_URL + 'users');
  const users = await res.json();
  userList.innerHTML = '';
  users.forEach(u => {
    if (u.username === currentUser) return;
    const li = document.createElement('li');
    li.textContent = u.displayName || u.username;
    li.onclick = () => selectUser(u.username);
    userList.appendChild(li);
  });
}

async function searchUsers(q) {
  const res = await fetch(BACKEND_URL + 'search?q=' + encodeURIComponent(q));
  const users = await res.json();
  userList.innerHTML = '';
  users.forEach(u => {
    if (u.username === currentUser) return;
    const li = document.createElement('li');
    li.textContent = u.displayName || u.username;
    li.onclick = () => selectUser(u.username);
    userList.appendChild(li);
  });
}

searchInput.addEventListener('input', (e) => {
  const q = e.target.value.trim();
  if (!q) return loadUsers();
  searchUsers(q);
});

async function loadMessages() {
  if (!selectedUser) return;
  const endpoint = selectedUser === 'WORLD' ? 'messages/world' : `messages/${currentUser}/${selectedUser}`;
  const res = await fetch(`${BACKEND_URL}${endpoint}`);
  const messages = await res.json();
  chatBox.innerHTML = '';
  messages.forEach(m => {
    const d = document.createElement('div');
    d.className = m.sender === currentUser ? 'msg msg-out' : 'msg msg-in';
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = `${m.sender} • ${new Date(m.timestamp).toLocaleTimeString()}`;
    const body = document.createElement('div');
    body.className = 'msg-body';
    body.textContent = m.content;
    d.appendChild(meta);
    d.appendChild(body);
    chatBox.appendChild(d);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

function selectUser(username) {
  selectedUser = username;
  document.getElementById('chatHeader').textContent = 'Chat with ' + username;
  loadMessages();
}

worldBtn.onclick = () => { selectUser('WORLD'); };

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const content = document.getElementById('message').value.trim();
  if (!content || !selectedUser || !socket) return;
  const payload = { sender: currentUser, receiver: selectedUser, content };
  socket.send(JSON.stringify(payload));
  document.getElementById('message').value = '';
});

function connectWS() {
  socket = new WebSocket(WS_URL);
  socket.onopen = () => console.log('ws connected');
  socket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    // show world messages when WORLD selected, or direct messages
    const isRelevant = (selectedUser === 'WORLD' && msg.receiver === 'WORLD') ||
      (msg.sender === currentUser && msg.receiver === selectedUser) ||
      (msg.sender === selectedUser && msg.receiver === currentUser);
    if (isRelevant) {
      const d = document.createElement('div');
      d.className = msg.sender === currentUser ? 'msg msg-out' : 'msg msg-in';
      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      meta.textContent = `${msg.sender} • ${new Date(msg.timestamp).toLocaleTimeString()}`;
      const body = document.createElement('div');
      body.className = 'msg-body';
      body.textContent = msg.content;
      d.appendChild(meta);
      d.appendChild(body);
      chatBox.appendChild(d);
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  };
  socket.onclose = () => console.log('ws closed');
}

settingsBtn.onclick = () => settingsModal.style.display = 'flex';
saveProfile.onclick = async () => {
  const displayName = document.getElementById('displayName').value.trim();
  const avatarUrl = document.getElementById('avatarUrl').value.trim();
  const backgroundUrl = document.getElementById('backgroundUrl').value.trim();
  // displayName is required
  if (!displayName) {
    alert('Display name is required');
    document.getElementById('displayName').focus();
    return;
  }
  // save profile to backend
  const res = await fetch(BACKEND_URL + 'profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser, displayName, avatarUrl, backgroundUrl })
  });
  if (!res.ok) { alert('Could not save profile'); return; }
  const data = await res.json();
  if (data && data.user) {
    const u = data.user;
    document.getElementById('profileName').textContent = u.displayName || currentUser;
    if (u.avatarUrl) document.getElementById('profileAvatar').src = u.avatarUrl;
    if (u.backgroundUrl) document.querySelector('.chat-box').style.backgroundImage = `url(${u.backgroundUrl})`;
  } else {
    if (displayName) document.getElementById('profileName').textContent = displayName;
    if (avatarUrl) document.getElementById('profileAvatar').src = avatarUrl;
    if (backgroundUrl) document.querySelector('.chat-box').style.backgroundImage = `url(${backgroundUrl})`;
  }
  settingsModal.style.display = 'none';
};

// show login on load
showLogin();
