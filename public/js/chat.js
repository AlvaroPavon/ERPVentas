// Chat WebSocket Manager
class ChatSocket {
  constructor() {
    this.ws = null;
    this.onMessage = null;
    this.onOnline = null;
    this.onConnected = null;
    this.onTyping = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(conversationIds) {
    const token = localStorage.getItem('token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const convParam = encodeURIComponent(JSON.stringify(conversationIds || []));
    const url = `${protocol}//${host}/ws?token=${token}&conversations=${convParam}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      if (this.onConnected) this.onConnected();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'message' && this.onMessage) this.onMessage(data);
        if (data.event === 'users_online' && this.onOnline) this.onOnline(data.users);
        if (data.event === 'typing' && this.onTyping) this.onTyping(data);
        if (data.event === 'connected' && this.onConnected) this.onConnected(data.user);
      } catch (e) {
        console.error('ChatSocket parse error:', e);
      }
    };

    this.ws.onclose = (e) => {
      if (e.code === 4001) {
        console.log('Chat: auth rejected');
        return;
      }
      // Reconnect with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect(conversationIds);
        }, delay);
      }
    };

    this.ws.onerror = (err) => {
      console.error('Chat WebSocket error:', err);
    };
  }

  send(event, data) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ event, ...data }));
    }
  }

  subscribe(conversationIds) {
    if (this.ws && this.ws.readyState === 1) {
      this.send('subscribe', { conversationIds });
    }
  }

  sendMessage(conversationId, content) {
    this.send('message', { conversation_id: conversationId, content, type: 'text' });
  }

  sendTyping(conversationId) {
    this.send('typing', { conversation_id: conversationId });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Global chat socket instance
const chatSocket = new ChatSocket();
window.chatSocket = chatSocket;

// Emoji reactions picker
const EMOJI_PICKER = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏', '🤔', '✅'];

// Render emoji reactions bar
function renderReactions(reactions, messageId) {
  if (!reactions || !reactions.length) return '';

  const grouped = {};
  reactions.forEach(r => {
    if (!grouped[r.emoji]) grouped[r.emoji] = [];
    grouped[r.emoji].push(r.name || r.user_id);
  });

  let html = '<div class="reactions-bar">';
  Object.entries(grouped).forEach(([emoji, names]) => {
    html += `<span class="reaction" title="${names.join(', ')}">${emoji} ${names.length}</span>`;
  });
  html += '</div>';

  // Emoji picker
  html += `<div class="emoji-picker" id="emoji-picker-${messageId}" style="display:none;">`;
  EMOJI_PICKER.forEach(emoji => {
    html += `<span class="emoji-option" data-emoji="${emoji}" data-message-id="${messageId}">${emoji}</span>`;
  });
  html += '</div>';

  return html;
}

// Show/hide emoji picker
function toggleEmojiPicker(messageId) {
  const picker = document.getElementById(`emoji-picker-${messageId}`);
  if (picker) {
    picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
  }
  // Close all other pickers
  document.querySelectorAll('.emoji-picker').forEach(p => {
    if (p.id !== `emoji-picker-${messageId}`) p.style.display = 'none';
  });
}

// Handle emoji click
function handleEmojiClick(messageId, emoji) {
  API.addChatReaction(messageId, emoji).then(() => {
    document.getElementById(`emoji-picker-${messageId}`).style.display = 'none';
  }).catch(err => {
    App.showToast('Error al añadir reacción', 'error');
  });
}

// Register emoji clicks globally
document.addEventListener('click', (e) => {
  const emojiOption = e.target.closest('.emoji-option');
  if (emojiOption) {
    const { messageId, emoji } = emojiOption.dataset;
    handleEmojiClick(messageId, emoji);
  }

  // Close emoji picker when clicking outside
  if (!e.target.closest('.emoji-picker') && !e.target.closest('.reaction-btn')) {
    document.querySelectorAll('.emoji-picker').forEach(p => p.style.display = 'none');
  }
});