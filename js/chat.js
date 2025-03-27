// ArusdataJS Chat Demo
document.addEventListener('DOMContentLoaded', function () {
  // Elements
  const connectionStatus = document.getElementById('connection-status');
  const messagesContainer = document.getElementById('messages');
  const messageInput = document.getElementById('message-input');
  const sendMessageBtn = document.getElementById('send-message-btn');
  const channelsList = document.getElementById('channels');
  const currentChannelElem = document.getElementById('current-channel');
  const userCountElem = document.getElementById('user-count');
  const usersListElem = document.getElementById('users-list');
  const usernameInput = document.getElementById('username-input');
  const setUsernameBtn = document.getElementById('set-username-btn');
  const newChannelInput = document.getElementById('new-channel-input');
  const addChannelBtn = document.getElementById('add-channel-btn');

  // State
  let currentChannel = 'general';
  let username = `user-${Math.floor(1000 + Math.random() * 9000)}`;
  usernameInput.value = username;
  const onlineUsers = new Map();

  // Initialize ArusdataJS client
  const arusdata = new ArusdataClient({
    endpoint: 'ws://localhost:8080/arusdata'
  });

  // Connection handler
  arusdata.onConnection((socketId) => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'connection-status status-connected';

    console.log('Connected with socket ID:', socketId);

    // Subscribe to the default channel
    subscribeToChannel(currentChannel);

    // Subscribe to presence channel
    subscribeToPresence();

    // Announce user joined
    announceUserPresence(true);
  });

  // Disconnection handler
  arusdata.onDisconnection(() => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.className = 'connection-status status-disconnected';
  });

  // Subscribe to a channel
  function subscribeToChannel(channelName) {
    // Update UI
    document.querySelectorAll('#channels li').forEach(li => {
      li.classList.remove('active');
    });
    const channelElem = document.querySelector(`#channels li[data-channel="${channelName}"]`);
    if (channelElem) {
      channelElem.classList.add('active');
    }

    currentChannelElem.textContent = `# ${channelName}`;
    currentChannel = channelName;

    // Clear messages
    while (messagesContainer.firstChild) {
      if (messagesContainer.firstChild.classList && messagesContainer.firstChild.classList.contains('welcome-message')) {
        break;
      }
      messagesContainer.removeChild(messagesContainer.firstChild);
    }

    // Subscribe to the channel
    arusdata.subscribe(channelName)
      .bind('message', (data) => {
        displayMessage(data);
      })
      .bind('user_joined', (data) => {
        displaySystemMessage(`${data.username} joined the channel`);
      })
      .bind('user_left', (data) => {
        displaySystemMessage(`${data.username} left the channel`);
      });
  }

  // Subscribe to presence channel
  function subscribeToPresence() {
    arusdata.subscribe('presence')
      .bind('user_online', (data) => {
        onlineUsers.set(data.user_id, data.username);
        updateOnlineUsers();
      })
      .bind('user_offline', (data) => {
        onlineUsers.delete(data.user_id);
        updateOnlineUsers();
      });
  }

  // Update online users list
  function updateOnlineUsers() {
    usersListElem.innerHTML = '';

    if (onlineUsers.size === 0) {
      const li = document.createElement('li');
      li.textContent = 'No users online';
      usersListElem.appendChild(li);
      userCountElem.textContent = '0 users';
      return;
    }

    onlineUsers.forEach((username, userId) => {
      const li = document.createElement('li');

      const status = document.createElement('span');
      status.className = 'user-status';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = username;

      li.appendChild(status);
      li.appendChild(nameSpan);
      usersListElem.appendChild(li);
    });

    userCountElem.textContent = `${onlineUsers.size} user${onlineUsers.size !== 1 ? 's' : ''}`;
  }

  // Announce user presence
  function announceUserPresence(joined = true) {
    arusdata.publish('presence', joined ? 'user_online' : 'user_offline', {
      user_id: arusdata.getSocketId(),
      username: username
    });

    if (joined) {
      arusdata.publish(currentChannel, 'user_joined', {
        username: username
      });
    }
  }

  // Send a message
  function sendMessage() {
    const content = messageInput.value.trim();

    if (!content) return;

    const message = {
      sender: username,
      content: content,
      timestamp: new Date().toISOString()
    };

    arusdata.publish(currentChannel, 'message', message);

    // Clear input
    messageInput.value = '';
  }

  // Display a message
  function displayMessage(message) {
    const messageElem = document.createElement('div');
    messageElem.className = `message ${message.sender === username ? 'self' : 'other'}`;

    const header = document.createElement('div');
    header.className = 'message-header';

    const sender = document.createElement('span');
    sender.className = 'sender';
    sender.textContent = message.sender;

    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = formatTimestamp(message.timestamp);

    header.appendChild(sender);
    header.appendChild(timestamp);

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = message.content;

    messageElem.appendChild(header);
    messageElem.appendChild(content);

    messagesContainer.appendChild(messageElem);
    scrollToBottom();
  }

  // Display a system message
  function displaySystemMessage(text) {
    const messageElem = document.createElement('div');
    messageElem.className = 'system-message';
    messageElem.textContent = text;

    messagesContainer.appendChild(messageElem);
    scrollToBottom();
  }

  // Format timestamp
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Scroll messages container to bottom
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Set username
  function setUsername() {
    const newUsername = usernameInput.value.trim();

    if (!newUsername) {
      return;
    }

    const oldUsername = username;
    username = newUsername;

    // Update presence
    if (arusdata.isConnected()) {
      arusdata.publish('presence', 'user_online', {
        user_id: arusdata.getSocketId(),
        username: username
      });

      displaySystemMessage(`You changed your username from ${oldUsername} to ${username}`);
    }
  }

  // Add new channel
  function addChannel() {
    const channelName = newChannelInput.value.trim().toLowerCase();

    if (!channelName) {
      return;
    }

    // Check if channel already exists
    if (document.querySelector(`#channels li[data-channel="${channelName}"]`)) {
      newChannelInput.value = '';
      return;
    }

    // Create new channel list item
    const li = document.createElement('li');
    li.setAttribute('data-channel', channelName);

    const span = document.createElement('span');
    span.textContent = `# ${channelName}`;

    li.appendChild(span);
    channelsList.appendChild(li);

    // Clear input
    newChannelInput.value = '';

    // Switch to the new channel
    switchChannel(channelName);
  }

  // Switch to a channel
  function switchChannel(channelName) {
    // Leave current channel
    arusdata.publish(currentChannel, 'user_left', {
      username: username
    });

    // Subscribe to new channel
    subscribeToChannel(channelName);

    // Announce joining new channel
    arusdata.publish(channelName, 'user_joined', {
      username: username
    });
  }

  // Event Listeners
  sendMessageBtn.addEventListener('click', () => {
    sendMessage();
  });

  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  setUsernameBtn.addEventListener('click', () => {
    setUsername();
  });

  addChannelBtn.addEventListener('click', () => {
    addChannel();
  });

  newChannelInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChannel();
    }
  });

  // Channel clicks
  channelsList.addEventListener('click', (e) => {
    let target = e.target;

    // If clicked on span inside li, get the parent li
    if (target.tagName === 'SPAN') {
      target = target.parentElement;
    }

    if (target.tagName === 'LI') {
      const channelName = target.getAttribute('data-channel');
      if (channelName !== currentChannel) {
        switchChannel(channelName);
      }
    }
  });

  // Initial setup
  updateOnlineUsers();
});