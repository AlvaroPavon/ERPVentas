// Chat page renderer
let currentChatConversationId = null;
let chatMessagesPage = 1;
let chatHasMore = true;
let typingTimeout = null;

async function renderChatPage(container) {
  App.updateTitle(I18n.t('title.chat'));
  container.innerHTML = `
    <div class="chat-container">
      <div class="chat-sidebar" id="chat-sidebar">
        <div class="chat-sidebar-header">
          <h3>💬 Chat</h3>
          <button class="icon-btn" id="chat-refresh-btn" title="Actualizar">🔄</button>
        </div>
        <div class="chat-search">
          <input type="text" id="chat-search-input" placeholder="Buscar conversaciones..." />
        </div>
        <div class="chat-conversations-list" id="chat-conversations-list">
          <div class="loading-spinner">Cargando...</div>
        </div>
        <div class="chat-sidebar-footer" id="chat-sidebar-footer">
          <button class="btn btn-ghost btn-sm" id="chat-show-contacts">👥 Amigos</button>
          <button class="btn btn-ghost btn-sm" id="chat-find-people">🔍 Buscar</button>
        </div>
      </div>
      <div class="chat-main" id="chat-main">
        <div class="chat-main-placeholder" id="chat-placeholder">
          <div class="empty-icon">💬</div>
          <p>Selecciona una conversación</p>
        </div>
        <div class="chat-header" id="chat-header" style="display:none;">
          <button class="icon-btn" id="chat-back">←</button>
          <h3 id="chat-header-name" style="cursor:pointer;">Conversación</h3>
          <div class="chat-header-actions">
            <button class="icon-btn" id="chat-members-btn" title="Miembros">👥</button>
            <button class="icon-btn" id="chat-online-btn" title="En línea">🟢</button>
            <button class="icon-btn" id="chat-delete-btn" title="Eliminar conversación">🗑️</button>
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

    <!-- Modal: Contacts -->
    <div id="chat-contacts-modal" class="modal-overlay" style="display:none;">
      <div class="modal-content" style="max-width:400px;">
        <div class="modal-header">
          <h3>👥 Contactos</h3>
          <button class="modal-close" onclick="closeModal('chat-contacts-modal')">✕</button>
        </div>
        <div id="chat-contacts-list" class="modal-list" style="max-height:400px;overflow-y:auto;"></div>
      </div>
    </div>

    <!-- Modal: Delete confirmation -->
    <div id="chat-delete-modal" class="modal-overlay" style="display:none;">
      <div class="modal-content" style="max-width:350px;">
        <h3>🗑️ Eliminar conversación</h3>
        <p style="color:var(--text-secondary);margin:12px 0;">¿Seguro que querés eliminar esta conversación? Esta acción no se puede deshacer.</p>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
          <button class="btn btn-secondary" onclick="closeModal('chat-delete-modal')">Cancelar</button>
          <button class="btn btn-danger" id="chat-delete-confirm-btn">Eliminar</button>
        </div>
      </div>
    </div>
  `;

  await loadConversationsAndContacts();
  setupChatListeners();
}

let cachedContacts = [];

async function loadConversationsAndContacts(searchQuery = '') {
  const list = document.getElementById('chat-conversations-list');
  try {
    const [conversations, contacts, friendRequests] = await Promise.all([
      API.getChatConversations(),
      API.getChatContacts(),
      API.getFriendRequests()
    ]);
    cachedContacts = contacts || [];

    let filtered = conversations;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = conversations.filter(c => c.name.toLowerCase().includes(q));
    }

    // Build conversation list
    let html = '';

    // Show pending friend requests first (if any and no search)
    if (!searchQuery && friendRequests && friendRequests.length > 0) {
      html += `<div style="font-size:11px;font-weight:700;color:var(--text-secondary);padding:8px 12px 4px;letter-spacing:0.3px;">SOLICITUDES DE AMISTAD</div>`;
      html += friendRequests.map(r => `
        <div class="chat-conversation-item friend-request-item" data-request-id="${r.id}" style="background:var(--primary-bg);border-left:3px solid var(--primary);">
          <div class="chat-conv-icon" style="background:var(--warning);">👤</div>
          <div class="chat-conv-info">
            <div class="chat-conv-name">${escapeHtml(r.name)}</div>
            <div class="chat-conv-last">Quiere ser tu amigo</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button class="btn btn-sm btn-primary accept-request" data-request-id="${r.id}" style="width:auto;padding:4px 10px;font-size:11px;">✓</button>
            <button class="btn btn-sm btn-danger reject-request" data-request-id="${r.id}" style="width:auto;padding:4px 10px;font-size:11px;">✕</button>
          </div>
        </div>
      `).join('');
    }

    if (filtered.length > 0) {
      if (!searchQuery) html += `<div style="font-size:11px;font-weight:700;color:var(--text-secondary);padding:8px 12px 4px;letter-spacing:0.3px;">CONVERSACIONES</div>`;
      html += filtered.map(c => `
        <div class="chat-conversation-item ${c.id === currentChatConversationId ? 'active' : ''}" data-conv-id="${c.id}">
          <div class="chat-conv-icon">${c.type === 'company' ? '🏢' : '💬'}</div>
          <div class="chat-conv-info">
            <div class="chat-conv-name">${escapeHtml(c.name)}</div>
            <div class="chat-conv-last">${c.last_message ? escapeHtml(c.last_message.substring(0, 50)) : 'Sin mensajes'}</div>
          </div>
          ${c.message_count > 0 ? `<div class="chat-conv-badge">${c.message_count}</div>` : ''}
        </div>
      `).join('');
      list.innerHTML = html;
      attachFriendRequestListeners();
      return;
    }

    // No conversations — show contacts (friends)
    if (contacts.length === 0) {
      if (!searchQuery) {
        html += `<div class="list-empty" style="padding:24px 12px;"><div class="empty-icon" style="font-size:40px;">👥</div><p style="font-size:14px;font-weight:600;">No hay contactos disponibles</p><p class="list-empty-sub">Buscá personas y enviales solicitud de amistad</p>
          <button class="btn btn-primary btn-sm" id="chat-find-friends-btn" style="margin-top:12px;width:auto;">🔍 Buscar personas</button>
        </div>`;
      }
      list.innerHTML = html;
      const findBtn = document.getElementById('chat-find-friends-btn');
      if (findBtn) findBtn.addEventListener('click', showSearchPeopleModal);
      return;
    }

    // Show friends as startable chats
    html += `<div style="font-size:11px;font-weight:700;color:var(--text-secondary);padding:8px 12px 4px;letter-spacing:0.3px;">AMIGOS</div>`;
    html += contacts.map(c => `
      <div class="chat-conversation-item contact-item" data-contact-id="${c.id}" data-existing-dm="${c.existing_dm_id || ''}">
        <div class="chat-conv-icon" style="overflow:hidden;">${c.avatar ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;" />` : '👤'}</div>
        <div class="chat-conv-info">
          <div class="chat-conv-name">${escapeHtml(c.name)}</div>
          <div class="chat-conv-last">${c.existing_dm_id ? 'Tocar para abrir chat' : 'Tocar para iniciar chat'}</div>
        </div>
        ${!c.existing_dm_id ? '<div class="chat-conv-badge" style="background:var(--primary);font-size:16px;">➕</div>' : ''}
      </div>
    `).join('');
    list.innerHTML = html;
  } catch (err) {
    list.innerHTML = '<div class="list-empty"><p>Error al cargar</p></div>';
  }
}

function attachFriendRequestListeners() {
  document.querySelectorAll('.accept-request').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.requestId;
      try {
        await API.acceptFriendRequest(id);
        App.showToast('Solicitud aceptada', 'success');
        loadConversationsAndContacts(document.getElementById('chat-search-input')?.value || '');
      } catch (err) {
        App.showToast('Error: ' + err.message, 'error');
      }
    });
  });
  document.querySelectorAll('.reject-request').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.requestId;
      try {
        await API.rejectFriendRequest(id);
        App.showToast('Solicitud rechazada', 'success');
        loadConversationsAndContacts(document.getElementById('chat-search-input')?.value || '');
      } catch (err) {
        App.showToast('Error: ' + err.message, 'error');
      }
    });
  });
}

function setupChatListeners() {
  // Select conversation
  document.getElementById('chat-conversations-list').addEventListener('click', async (e) => {
    const item = e.target.closest('.chat-conversation-item');
    if (!item) return;

    // Check if it's a contact item (no existing DM)
    if (item.classList.contains('contact-item')) {
      const contactId = parseInt(item.dataset.contactId);
      const existingDm = item.dataset.existingDm;
      if (existingDm) {
        await openChatConversation(parseInt(existingDm));
      } else {
        await startDmWithContact(contactId);
      }
      return;
    }

    const convId = parseInt(item.dataset.convId);
    await openChatConversation(convId);
  });

  // Search
  document.getElementById('chat-search-input').addEventListener('input', (e) => {
    loadConversationsAndContacts(e.target.value);
  });

  // Refresh
  document.getElementById('chat-refresh-btn')?.addEventListener('click', () => {
    loadConversationsAndContacts(document.getElementById('chat-search-input').value);
  });

  // Show contacts modal
  document.getElementById('chat-show-contacts')?.addEventListener('click', showContactsModal);
  document.getElementById('chat-find-people')?.addEventListener('click', showSearchPeopleModal);

  // Send message
  document.getElementById('chat-send-btn').addEventListener('click', sendChatMessage);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
    clearTimeout(typingTimeout);
    if (currentChatConversationId) {
      window.chatSocket.send('typing', { conversation_id: currentChatConversationId });
      typingTimeout = setTimeout(() => {}, 3000);
    }
  });

  // Back button (mobile)
  document.getElementById('chat-back').addEventListener('click', closeChatView);

  // Members button
  document.getElementById('chat-members-btn').addEventListener('click', loadChatMembers);

  // Online button
  document.getElementById('chat-online-btn').addEventListener('click', loadChatOnline);

  // Delete chat
  document.getElementById('chat-delete-btn').addEventListener('click', () => {
    openModal('chat-delete-modal');
  });
  document.getElementById('chat-delete-confirm-btn').addEventListener('click', deleteCurrentConversation);

  // Emoji picker
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
}

async function startDmWithContact(contactId) {
  try {
    // Create a DM conversation
    const contact = cachedContacts.find(c => c.id === contactId);
    if (!contact) return;

    const conv = await API.createChatConversation(
      contact.name,
      'dm',
      null
    );

    // Add the other user to the conversation
    await API.addChatParticipant(conv.id, contactId);

    // Reload sidebar and open the new conversation
    await loadConversationsAndContacts();
    await openChatConversation(conv.id);
  } catch (err) {
    App.showToast('Error al iniciar chat: ' + err.message, 'error');
  }
}

function showSearchPeopleModal() {
  // Reuse contacts modal with search
  const existingTitle = document.querySelector('#chat-contacts-modal h3');
  if (existingTitle) existingTitle.textContent = '🔍 Buscar personas';

  document.getElementById('chat-contacts-list').innerHTML = `
    <div class="chat-search" style="padding:0 0 12px;">
      <input type="text" id="people-search-input" placeholder="Buscar por nombre o email..." autofocus />
    </div>
    <div id="people-search-results"></div>
  `;

  openModal('chat-contacts-modal');

  let searchTimeout;
  document.getElementById('people-search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    if (q.length < 2) {
      document.getElementById('people-search-results').innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;font-size:13px;">Escribí al menos 2 caracteres</p>';
      return;
    }
    searchTimeout = setTimeout(async () => {
      try {
        const users = await API.searchUsers(q);
        const results = document.getElementById('people-search-results');
        if (users.length === 0) {
          results.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">No se encontraron usuarios</p>';
          return;
        }
        results.innerHTML = users.map(u => `
          <div class="modal-list-item" style="cursor:pointer;">
            <div class="chat-member-avatar" style="width:40px;height:40px;font-size:16px;">
              ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />` : '👤'}
            </div>
            <div style="flex:1;">
              <strong>${escapeHtml(u.name)}</strong>
              <div style="font-size:12px;color:var(--text-secondary);">${escapeHtml(u.email)}</div>
            </div>
            ${u.is_friend ? '<span style="color:var(--success);font-size:12px;">✅ Amigo</span>'
              : u.request_sent ? '<span style="color:var(--text-secondary);font-size:12px;">⏳ Pendiente</span>'
              : u.request_received ? '<span style="color:var(--warning);font-size:12px;">📩 Responder</span>'
              : `<button class="btn btn-sm btn-primary send-friend-request" data-user-id="${u.id}" style="width:auto;padding:6px 12px;font-size:12px;">➕ Amigo</button>`}
          </div>
        `).join('');

        // Attach send request handlers
        results.querySelectorAll('.send-friend-request').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
              await API.sendFriendRequest(parseInt(btn.dataset.userId));
              btn.textContent = '✅ Enviada';
              btn.disabled = true;
              App.showToast('Solicitud enviada', 'success');
            } catch (err) {
              App.showToast('Error: ' + err.message, 'error');
            }
          });
        });
      } catch (err) {
        App.showToast('Error al buscar', 'error');
      }
    }, 300);
  });
}

function showContactsModal() {
  const existingTitle = document.querySelector('#chat-contacts-modal h3');
  if (existingTitle) existingTitle.textContent = '👥 Amigos';

  if (cachedContacts.length === 0) {
    document.getElementById('chat-contacts-list').innerHTML = `
      <div class="list-empty"><p>No tenés amigos agregados</p></div>
      <button class="btn btn-primary btn-sm" id="modal-find-friends" style="margin:12px auto;width:auto;">🔍 Buscar personas</button>
    `;
    document.getElementById('modal-find-friends')?.addEventListener('click', () => {
      closeModal('chat-contacts-modal');
      setTimeout(showSearchPeopleModal, 300);
    });
  } else {
    document.getElementById('chat-contacts-list').innerHTML = cachedContacts.map(c => `
      <div class="modal-list-item" style="cursor:pointer;" data-contact-id="${c.id}" data-existing-dm="${c.existing_dm_id || ''}">
        <div class="chat-member-avatar" style="width:40px;height:40px;font-size:16px;">
          ${c.avatar ? `<img src="${c.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />` : '👤'}
        </div>
        <div style="flex:1;">
          <strong>${escapeHtml(c.name)}</strong>
          <div style="font-size:12px;color:var(--text-secondary);">${c.email}</div>
        </div>
        <span style="color:var(--primary);font-size:18px;">${c.existing_dm_id ? '💬' : '➕'}</span>
      </div>
    `).join('');

    document.querySelectorAll('#chat-contacts-list .modal-list-item').forEach(item => {
      item.addEventListener('click', async () => {
        const contactId = parseInt(item.dataset.contactId);
        const existingDm = item.dataset.existingDm;
        closeModal('chat-contacts-modal');
        if (existingDm) {
          await openChatConversation(parseInt(existingDm));
        } else {
          await startDmWithContact(contactId);
        }
      });
    });
  }
  openModal('chat-contacts-modal');
}

function closeChatView() {
  document.getElementById('chat-header').style.display = 'none';
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('chat-input-area').style.display = 'none';
  document.getElementById('chat-placeholder').style.display = 'block';
  document.querySelector('.chat-sidebar').classList.remove('collapsed');
  currentChatConversationId = null;
  chatMessagesPage = 1;
  chatHasMore = true;
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

    const convs = await API.getChatConversations();
    const conv = convs.find(c => c.id === convId);
    if (conv) headerName.textContent = conv.name;

    renderMessages(data.messages, true);

    window.chatSocket.subscribe([convId]);

    requestAnimationFrame(() => {
      const msgs = document.getElementById('chat-messages');
      msgs.scrollTop = msgs.scrollHeight;
    });
  } catch (err) {
    App.showToast(err.message, 'error');
  }

  document.querySelectorAll('.chat-conversation-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.convId) === convId);
  });
}

async function deleteCurrentConversation() {
  if (!currentChatConversationId) return;
  try {
    await API.deleteChatConversation(currentChatConversationId);
    closeModal('chat-delete-modal');
    App.showToast('Conversación eliminada', 'success');
    closeChatView();
    await loadConversationsAndContacts();
  } catch (err) {
    App.showToast('Error al eliminar: ' + err.message, 'error');
  }
}

function renderMessages(messages, replace = false) {
  const container = document.getElementById('chat-messages');
  if (replace) container.innerHTML = '';

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

  // Load more
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
    await API.sendChatMessage(currentChatConversationId, content);
    input.value = '';
    clearTimeout(typingTimeout);
  } catch (err) {
    App.showToast('Error al enviar mensaje', 'error');
  }
}

async function loadChatMembers() {
  if (!currentChatConversationId) return;
  try {
    const participants = await API.getChatParticipants(currentChatConversationId);
    const list = document.getElementById('chat-members-list') || document.createElement('div');
    // Reuse contacts modal for members view
    const existingTitle = document.querySelector('#chat-contacts-modal h3');
    if (existingTitle) existingTitle.textContent = '👥 Miembros';

    document.getElementById('chat-contacts-list').innerHTML = participants.map(p => `
      <div class="modal-list-item">
        <div class="chat-member-avatar" style="width:40px;height:40px;font-size:16px;">
          ${p.avatar ? `<img src="${p.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />` : p.name.charAt(0)}
        </div>
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <span style="font-size:12px;color:var(--text-secondary);display:block;">Se unió ${new Date(p.joined_at).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
    openModal('chat-contacts-modal');
  } catch (err) {
    App.showToast('Error al cargar miembros', 'error');
  }
}

async function loadChatOnline() {
  if (!currentChatConversationId) return;
  try {
    const data = await API.getChatOnline(currentChatConversationId);
    const list = document.getElementById('chat-online-list');

    // Reuse contacts modal
    const existingTitle = document.querySelector('#chat-contacts-modal h3');
    if (existingTitle) existingTitle.textContent = '🟢 Usuarios en línea';

    if (data.online.length === 0) {
      document.getElementById('chat-contacts-list').innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">No hay usuarios en línea</p>';
    } else {
      document.getElementById('chat-contacts-list').innerHTML = data.online.map(u => `
        <div class="modal-list-item">
          <span class="online-dot" style="width:10px;height:10px;background:#10b981;border-radius:50%;display:inline-block;margin-right:12px;"></span>
          <span>${escapeHtml(u.name)}</span>
        </div>
      `).join('');
    }
    openModal('chat-contacts-modal');
  } catch (err) {
    App.showToast('Error al cargar usuarios en línea', 'error');
  }
}

// Image modal
function openImageModal(url) {
  App.showModal(`
    <div style="text-align:center;padding:16px;">
      <img src="${url}" style="max-width:100%;max-height:70vh;border-radius:12px;" />
    </div>
  `);
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
    // Reset contacts modal title
    const title = document.querySelector('#chat-contacts-modal h3');
    if (title) title.textContent = '👥 Contactos';
  }
});

// Handle WebSocket events
if (window.chatSocket) {
  // Real-time incoming messages
  window.chatSocket.onMessage = (data) => {
    // Update badge in nav
    if (typeof updateChatBadge === 'function') updateChatBadge();
    // If this message is for the current conversation, append it
    if (data.conversation_id === currentChatConversationId && data.message) {
      const msg = data.message;
      const container = document.getElementById('chat-messages');
      if (!container) return;
      // Remove "no messages" placeholder if present
      const empty = container.querySelector('.list-empty');
      if (empty) empty.remove();
      const div = document.createElement('div');
      div.className = `chat-message ${msg.user_id === App.user.id ? 'own' : ''}`;
      div.dataset.messageId = msg.id;
      const isSystem = msg.type === 'system';
      div.innerHTML = `
        ${!isSystem ? `<div class="chat-message-avatar">${msg.user_avatar ? `<img src="${msg.user_avatar}" />` : escapeHtml((msg.user_name || '?')[0])}</div>` : ''}
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
      container.appendChild(div);
      requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
    }
    // Refresh conversations list to show updated last message
    loadConversationsAndContacts(document.getElementById('chat-search-input')?.value || '');
  };

  // Typing indicator
  window.chatSocket.onTyping = (data) => {
    if (data.conversation_id === currentChatConversationId) {
      const indicator = document.getElementById('chat-typing');
      if (!indicator) return;
      indicator.innerHTML = `<span>${escapeHtml(data.user_name)}</span> está escribiendo...`;
      indicator.style.display = 'block';
      clearTimeout(window._typingHide);
      window._typingHide = setTimeout(() => {
        indicator.style.display = 'none';
      }, 3000);
    }
  };

  // Online status
  window.chatSocket.onOnline = (users) => {
    window._chatOnlineUsers = users;
  };
}
