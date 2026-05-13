// Chat page renderer
let currentChatConversationId = null;
let chatMessagesPage = 1;
let chatHasMore = true;
let typingTimeout = null;

async function renderChatPage(container) {
  container.innerHTML = `
    <div class="chat-container">
      <div class="chat-sidebar" id="chat-sidebar">
        <div class="chat-sidebar-header">
          <h3>💬 Chat</h3>
          <button class="icon-btn" id="chat-new-conversation" title="Nueva conversación">➕</button>
        </div>
        <div class="chat-search">
          <input type="text" id="chat-search-input" placeholder="Buscar conversación..." />
        </div>
        <div class="chat-conversations-list" id="chat-conversations-list">
          <div class="loading-spinner">Cargando...</div>
        </div>
      </div>
      <div class="chat-main" id="chat-main">
        <div class="chat-main-placeholder" id="chat-placeholder">
          <div class="empty-icon">💬</div>
          <p>Selecciona una conversación</p>
        </div>
        <div class="chat-header" id="chat-header" style="display:none;">
          <button class="icon-btn" id="chat-back">←</button>
          <h3 id="chat-header-name">Conversación</h3>
          <div class="chat-header-actions">
            <button class="icon-btn" id="chat-members-btn" title="Miembros">👥</button>
            <button class="icon-btn" id="chat-online-btn" title="En línea">🟢</button>
          </div>
        </div>
        <div class="chat-messages" id="chat-messages">
          <div class="loading-spinner">Cargando mensajes...</div>
        </div>
        <div class="chat-input-area" id="chat-input-area" style="display:none;">
          <div class="chat-typing-indicator" id="chat-typing" style="display:none;">
            <span></span> está escribiendo...
          </div>
          <div class="chat-input-wrapper">
            <button class="icon-btn chat-emoji-btn" id="chat-emoji-btn" title="Emoji">😊</button>
            <div class="emoji-picker-panel" id="chat-emoji-panel" style="display:none;">
              ${EMOJI_PICKER.map(e => `<span class="emoji-option" data-emoji="${e}">${e}</span>`).join('')}
            </div>
            <input type="text" id="chat-input" placeholder="Escribe un mensaje..." autocomplete="off" />
            <button class="icon-btn chat-send-btn" id="chat-send-btn" title="Enviar">➤</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: New conversation -->
    <div id="chat-new-modal" class="modal-overlay" style="display:none;">
      <div class="modal-content" style="max-width:400px;">
        <h3>Nueva Conversación</h3>
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="chat-new-name" placeholder="Nombre de la conversación" />
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="chat-new-type">
            <option value="channel">Canal</option>
            <option value="dm">Mensaje Directo</option>
          </select>
        </div>
        <div class="form-group" id="chat-new-company-group">
          <label>Empresa</label>
          <select id="chat-new-company"></select>
        </div>
        <div class="form-group" id="chat-new-user-group" style="display:none;">
          <label>Usuario (email)</label>
          <input type="email" id="chat-new-user-email" placeholder="email@ejemplo.com" />
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
          <button class="btn btn-secondary" onclick="closeModal('chat-new-modal')">Cancelar</button>
          <button class="btn btn-primary" id="chat-create-btn">Crear</button>
        </div>
      </div>
    </div>

    <!-- Modal: Members -->
    <div id="chat-members-modal" class="modal-overlay" style="display:none;">
      <div class="modal-content" style="max-width:350px;">
        <h3>👥 Miembros</h3>
        <div id="chat-members-list" class="modal-list"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px;">
          <button class="btn btn-secondary" onclick="closeModal('chat-members-modal')">Cerrar</button>
        </div>
      </div>
    </div>

    <!-- Modal: Online users -->
    <div id="chat-online-modal" class="modal-overlay" style="display:none;">
      <div class="modal-content" style="max-width:350px;">
        <h3>🟢 Usuarios en línea</h3>
        <div id="chat-online-list" class="modal-list"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px;">
          <button class="btn btn-secondary" onclick="closeModal('chat-online-modal')">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  await loadConversations();
  setupChatListeners();
  loadChatUserDetails();
}

async function loadChatUserDetails() {
  try {
    const user = await API.me();
    App.user = user;
  } catch (e) {}
}

async function loadConversations(searchQuery = '') {
  const list = document.getElementById('chat-conversations-list');
  try {
    const conversations = await API.getChatConversations();
    let filtered = conversations;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = conversations.filter(c => c.name.toLowerCase().includes(q));
    }

    if (filtered.length === 0) {
      list.innerHTML = '<div class="list-empty"><div class="empty-icon">💬</div><p>No hay conversaciones</p></div>';
      return;
    }

    list.innerHTML = filtered.map(c => `
      <div class="chat-conversation-item ${c.id === currentChatConversationId ? 'active' : ''}" data-conv-id="${c.id}">
        <div class="chat-conv-icon">${c.type === 'company' ? '🏢' : '💬'}</div>
        <div class="chat-conv-info">
          <div class="chat-conv-name">${escapeHtml(c.name)}</div>
          <div class="chat-conv-last">${c.last_message ? escapeHtml(c.last_message.substring(0, 50)) : 'Sin mensajes'}</div>
        </div>
        ${c.message_count > 0 ? `<div class="chat-conv-badge">${c.message_count}</div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<div class="list-empty"><p>Error al cargar</p></div>';
  }
}

function setupChatListeners() {
  // Select conversation
  document.getElementById('chat-conversations-list').addEventListener('click', async (e) => {
    const item = e.target.closest('.chat-conversation-item');
    if (!item) return;

    const convId = parseInt(item.dataset.convId);
    await openChatConversation(convId);
  });

  // Search
  document.getElementById('chat-search-input').addEventListener('input', (e) => {
    loadConversations(e.target.value);
  });

  // New conversation button
  document.getElementById('chat-new-conversation').addEventListener('click', async () => {
    try {
      const companies = await API.getCompanies();
      const select = document.getElementById('chat-new-company');
      select.innerHTML = '<option value="">Seleccionar...</option>' +
        companies.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

      const newType = document.getElementById('chat-new-type');
      newType.value = 'channel';
      toggleNewConversationFields();

      openModal('chat-new-modal');
    } catch (err) {
      App.showToast('Error al cargar empresas', 'error');
    }
  });

  document.getElementById('chat-new-type').addEventListener('change', toggleNewConversationFields);

  // Create conversation
  document.getElementById('chat-create-btn').addEventListener('click', createNewConversation);

  // Send message
  document.getElementById('chat-send-btn').addEventListener('click', sendChatMessage);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
    // Typing indicator
    clearTimeout(typingTimeout);
    if (currentChatConversationId) {
      chatSocket.send('typing', { conversation_id: currentChatConversationId });
      typingTimeout = setTimeout(() => {
        // Stop typing after 3s of inactivity
      }, 3000);
    }
  });

  // Back button (mobile)
  document.getElementById('chat-back').addEventListener('click', () => {
    document.getElementById('chat-header').style.display = 'none';
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('chat-input-area').style.display = 'none';
    document.getElementById('chat-placeholder').style.display = 'block';
    currentChatConversationId = null;
    chatMessagesPage = 1;
    chatHasMore = true;
  });

  // Members button
  document.getElementById('chat-members-btn').addEventListener('click', loadChatMembers);

  // Online button
  document.getElementById('chat-online-btn').addEventListener('click', loadChatOnline);

  // Emoji in chat input
  document.getElementById('chat-emoji-btn').addEventListener('click', () => {
    const panel = document.getElementById('chat-emoji-panel');
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  });

  document.querySelectorAll('#chat-emoji-panel .emoji-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      input.value += opt.dataset.emoji;
      document.getElementById('chat-emoji-panel').style.display = 'none';
      input.focus();
    });
  });

  // Listen for global emoji clicks (message reactions)
  document.addEventListener('click', (e) => {
    const opt = e.target.closest('.emoji-option');
    if (opt && opt.closest('#chat-emoji-panel') === null) return;
    if (opt && opt.closest('.emoji-picker-panel') === null) return;
  });
}

function toggleNewConversationFields() {
  const type = document.getElementById('chat-new-type').value;
  document.getElementById('chat-new-company-group').style.display = type === 'channel' ? 'block' : 'none';
  document.getElementById('chat-new-user-group').style.display = type === 'dm' ? 'block' : 'none';
}

async function createNewConversation() {
  const name = document.getElementById('chat-new-name').value.trim();
  const type = document.getElementById('chat-new-type').value;
  const company_id = type === 'channel' ? parseInt(document.getElementById('chat-new-company').value) : null;

  if (!name) {
    App.showToast('Introduce un nombre', 'error');
    return;
  }

  if (type === 'channel' && !company_id) {
    App.showToast('Selecciona una empresa', 'error');
    return;
  }

  try {
    const conv = await API.createChatConversation(name, type, company_id);
    closeModal('chat-new-modal');
    await loadConversations();
    await openChatConversation(conv.id);
    App.showToast('Conversación creada', 'success');
  } catch (err) {
    App.showToast(err.message, 'error');
  }
}

async function openChatConversation(convId) {
  currentChatConversationId = convId;
  chatMessagesPage = 1;
  chatHasMore = true;

  const main = document.getElementById('chat-main');
  main.querySelector('.chat-main-placeholder').style.display = 'none';
  main.querySelector('.chat-header').style.display = 'flex';
  main.querySelector('.chat-messages').style.display = 'block';
  main.querySelector('.chat-input-area').style.display = 'block';
  main.querySelector('#chat-header-name').textContent = 'Cargando...';
  main.querySelector('#chat-messages').innerHTML = '<div class="loading-spinner">Cargando mensajes...</div>';

  // Resize sidebar for mobile
  document.querySelector('.chat-sidebar').classList.add('collapsed');

  try {
    const data = await API.getChatMessages(convId, 1, 50);
    const headerName = document.getElementById('chat-header-name');

    // Find conversation name
    const convs = await API.getChatConversations();
    const conv = convs.find(c => c.id === convId);
    if (conv) headerName.textContent = conv.name;

    renderMessages(data.messages, true);

    // Subscribe to WebSocket for real-time updates
    chatSocket.subscribe([convId]);

    // Scroll to bottom
    requestAnimationFrame(() => {
      const msgs = document.getElementById('chat-messages');
      msgs.scrollTop = msgs.scrollHeight;
    });
  } catch (err) {
    App.showToast(err.message, 'error');
  }

  // Update active state in sidebar
  document.querySelectorAll('.chat-conversation-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.convId) === convId);
  });
}

function renderMessages(messages, replace = false) {
  const container = document.getElementById('chat-messages');
  if (replace) {
    container.innerHTML = '';
  }

  if (messages.length === 0 && replace) {
    container.innerHTML = '<div class="list-empty"><p>No hay mensajes aún</p></div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = `chat-message ${msg.user_id === App.user.id ? 'own' : ''}`;
    div.dataset.messageId = msg.id;

    const isSystem = msg.type === 'system';
    div.innerHTML = `
      ${!isSystem ? `<div class="chat-message-avatar">${(msg.user_avatar ? `<img src="${msg.user_avatar}" />` : msg.user_name.charAt(0))}</div>` : ''}
      <div class="chat-message-content">
        ${!isSystem ? `<div class="chat-message-sender">${escapeHtml(msg.user_name)}</div>` : ''}
        <div class="chat-message-text">${escapeHtml(msg.content || '')}</div>
        ${msg.image_url ? `<img src="${msg.image_url}" class="chat-message-image" onclick="openImageModal('${msg.image_url}')" />` : ''}
        <div class="chat-message-meta">
          <span>${formatTime(msg.created_at)}</span>
          <button class="reaction-btn" onclick="toggleEmojiPicker(${msg.id})" title="Reaccionar">😊</button>
        </div>
        ${renderReactions(msg.emoji_reactions, msg.id)}
      </div>
    `;
    fragment.appendChild(div);
  });

  container.appendChild(fragment);

  // Infinite scroll loader
  const existingLoader = container.querySelector('.load-more-messages');
  if (chatHasMore) {
    if (!existingLoader) {
      const loader = document.createElement('div');
      loader.className = 'load-more-messages';
      loader.textContent = 'Cargar más mensajes...';
      loader.style.cssText = 'text-align:center;padding:12px;cursor:pointer;color:#0381fe;font-size:14px;opacity:0.7;';
      loader.addEventListener('click', loadMoreMessages);
      container.appendChild(loader);
    }
  } else if (existingLoader) {
    existingLoader.remove();
  }

  // Scroll to bottom if loading newest
  if (!replace) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
}

async function loadMoreMessages() {
  if (!chatHasMore || !currentChatConversationId) return;
  chatMessagesPage++;

  try {
    const data = await API.getChatMessages(currentChatConversationId, chatMessagesPage, 50);
    if (data.messages.length === 0) {
      chatHasMore = false;
    }

    // Insert at top
    data.messages.reverse().forEach(msg => {
      const div = document.createElement('div');
      div.className = `chat-message ${msg.user_id === App.user.id ? 'own' : ''}`;
      div.dataset.messageId = msg.id;

      const isSystem = msg.type === 'system';
      div.innerHTML = `
        ${!isSystem ? `<div class="chat-message-avatar">${msg.user_avatar ? `<img src="${msg.user_avatar}" />` : msg.user_name.charAt(0)}</div>` : ''}
        <div class="chat-message-content">
          ${!isSystem ? `<div class="chat-message-sender">${escapeHtml(msg.user_name)}</div>` : ''}
          <div class="chat-message-text">${escapeHtml(msg.content || '')}</div>
          ${msg.image_url ? `<img src="${msg.image_url}" class="chat-message-image" onclick="openImageModal('${msg.image_url}')" />` : ''}
          <div class="chat-message-meta">
            <span>${formatTime(msg.created_at)}</span>
            <button class="reaction-btn" onclick="toggleEmojiPicker(${msg.id})" title="Reaccionar">😊</button>
          </div>
          ${renderReactions(msg.emoji_reactions, msg.id)}
        </div>
      `;
      const first = document.getElementById('chat-messages').querySelector('.chat-message, .list-empty');
      document.getElementById('chat-messages').insertBefore(div, first);
    });
  } catch (err) {
    chatMessagesPage--;
    App.showToast('Error al cargar más mensajes', 'error');
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content || !currentChatConversationId) return;

  try {
    const msg = await API.sendChatMessage(currentChatConversationId, content);
    input.value = '';
    // Socket will broadcast the message via WebSocket

    // Also handle typing stop
    clearTimeout(typingTimeout);
  } catch (err) {
    App.showToast('Error al enviar mensaje', 'error');
  }
}

async function loadChatMembers() {
  if (!currentChatConversationId) return;
  try {
    const participants = await API.getChatParticipants(currentChatConversationId);
    const list = document.getElementById('chat-members-list');
    list.innerHTML = participants.map(p => `
      <div class="modal-list-item">
        <div class="chat-member-avatar">${p.avatar ? `<img src="${p.avatar}" />` : p.name.charAt(0)}</div>
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <span class="chat-member-role">Se unió ${new Date(p.joined_at).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
    openModal('chat-members-modal');
  } catch (err) {
    App.showToast('Error al cargar miembros', 'error');
  }
}

async function loadChatOnline() {
  if (!currentChatConversationId) return;
  try {
    const data = await API.getChatOnline(currentChatConversationId);
    const list = document.getElementById('chat-online-list');
    if (data.online.length === 0) {
      list.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;padding:20px;">No hay usuarios en línea</p>';
    } else {
      list.innerHTML = data.online.map(u => `
        <div class="modal-list-item">
          <span class="online-dot"></span>
          <span>${escapeHtml(u.name)}</span>
        </div>
      `).join('');
    }
    openModal('chat-online-modal');
  } catch (err) {
    App.showToast('Error al cargar usuarios en línea', 'error');
  }
}

// Helper functions
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Ahora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
  }
});

// Handle WebSocket typing indicators from global socket
if (chatSocket.onTyping === null) {
  chatSocket.onTyping = (data) => {
    if (data.conversation_id === currentChatConversationId) {
      const indicator = document.getElementById('chat-typing');
      indicator.textContent = `${data.user_name} está escribiendo...`;
      indicator.style.display = 'block';
      clearTimeout(window._typingHide);
      window._typingHide = setTimeout(() => {
        indicator.style.display = 'none';
      }, 3000);
    }
  };
}

// Initialize WebSocket on page load
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    // Delay WebSocket connection until user navigates to chat
    console.log('Chat disponible. Conexión al abrir la página de chat.');
  }
});