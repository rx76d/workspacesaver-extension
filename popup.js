document.addEventListener('DOMContentLoaded', () => {
  // --- ELEMENTS ---
  const mainView = document.getElementById('main-view');
  const editView = document.getElementById('edit-view');
  const workspaceList = document.getElementById('workspace-list');
  const tabList = document.getElementById('tab-list');
  
  const saveBtn = document.getElementById('saveBtn');
  const nameInput = document.getElementById('newWorkspaceName');
  const backBtn = document.getElementById('backBtn');
  const viewTitle = document.getElementById('viewTitle');

  const editNameInput = document.getElementById('editWorkspaceName');
  const updateNameBtn = document.getElementById('updateNameBtn');
  
  // Modal Elements
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const modalInput = document.getElementById('modalInput');
  const modalConfirm = document.getElementById('modalConfirm');
  const modalCancel = document.getElementById('modalCancel');

  // Icons (SVG Strings)
  const ICON_LOCK_CLOSED = `<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;
  const ICON_LOCK_OPEN = `<svg viewBox="0 0 24 24"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>`;
  const ICON_PENCIL = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
  const ICON_TRASH = `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
  const ICON_PLAY = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  const ICON_DRAG = `<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>`;

  // State
  let currentEditingId = null;
  let modalCallback = null;

  // Initialize
  loadWorkspaces();
  setupGithubLink();

  backBtn.addEventListener('click', () => {
    switchView('main');
    currentEditingId = null;
  });

  // --- DRAG AND DROP ---
  function enableDragAndDrop(container, onUpdate) {
    let draggedItem = null;
    container.addEventListener('dragstart', (e) => {
      draggedItem = e.target.closest('.list-item');
      if (draggedItem) {
        draggedItem.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      }
    });
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(container, e.clientY);
      const currentItem = document.querySelector('.list-item[style*="opacity: 0.5"]');
      if (afterElement == null) container.appendChild(currentItem);
      else container.insertBefore(currentItem, afterElement);
    });
    container.addEventListener('dragend', (e) => {
      if(draggedItem) draggedItem.style.opacity = '1';
      onUpdate();
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.list-item:not([style*="opacity: 0.5"])')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
      else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  enableDragAndDrop(workspaceList, saveWorkspaceOrder);
  enableDragAndDrop(tabList, saveTabOrder);

  // --- SAVE WORKSPACE ---
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return showToast("Name required", "error");

    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const urls = tabs.map(t => ({ url: t.url, title: t.title, favIconUrl: t.favIconUrl }));
      const id = 'ws_' + Date.now();
      const newWorkspace = {
        id: id,
        name: name,
        tabs: urls,
        locked: false,
        password: null,
        created: new Date().toLocaleDateString()
      };

      chrome.storage.local.get(['workspace_order'], (res) => {
        const order = res.workspace_order || [];
        order.unshift(id);
        const data = {};
        data[id] = newWorkspace;
        data['workspace_order'] = order;
        chrome.storage.local.set(data, () => {
          nameInput.value = '';
          showToast("Workspace Saved!", "success");
          loadWorkspaces();
        });
      });
    });
  });

  // --- LOAD & RENDER ---
  function loadWorkspaces() {
    workspaceList.innerHTML = '';
    chrome.storage.local.get(null, (items) => {
      const order = items.workspace_order || [];
      const validOrder = order.filter(id => items[id]);

      if (validOrder.length === 0) {
        workspaceList.innerHTML = '<div style="text-align:center; padding:20px; color:#999; font-size:13px;">No workspaces yet.</div>';
        return;
      }

      validOrder.forEach(id => {
        const ws = items[id];
        renderWorkspaceItem(ws);
      });
    });
  }

  function renderWorkspaceItem(ws) {
    const div = document.createElement('div');
    div.className = `list-item ${ws.locked ? 'locked' : ''}`;
    div.draggable = true;
    div.dataset.id = ws.id;

    // IMPORTANT: Only SVGs here, no Emojis
    const lockSvg = ws.locked ? ICON_LOCK_CLOSED : ICON_LOCK_OPEN;

    div.innerHTML = `
      <div class="item-info">
        <div style="width:16px; height:16px; color:${ws.locked ? '#fa1e4e' : '#aaa'}">${lockSvg}</div>
        <div>
          <div class="item-name">${ws.name}</div>
          <div class="item-meta">${ws.tabs.length} tabs</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn-icon btn-load" title="Load Tabs">${ICON_PLAY}</button>
        <button class="btn-icon btn-edit" title="Edit/Rename">${ICON_PENCIL}</button>
        <button class="btn-icon btn-lock" title="${ws.locked ? 'Unlock' : 'Lock'}">${lockSvg}</button>
        <button class="btn-icon btn-del" title="Delete">${ICON_TRASH}</button>
      </div>
    `;

    div.querySelector('.btn-load').onclick = () => handleAction(ws, 'load');
    div.querySelector('.btn-edit').onclick = () => handleAction(ws, 'edit');
    div.querySelector('.btn-del').onclick = () => handleAction(ws, 'delete');
    div.querySelector('.btn-lock').onclick = () => handleAction(ws, 'toggleLock');

    workspaceList.appendChild(div);
  }

  // --- SECURITY & ACTIONS ---
  function handleAction(ws, action) {
    if (ws.locked && (action === 'load' || action === 'edit' || action === 'toggleLock')) {
      showModal("Locked Workspace", "Enter password to access:", (password) => {
        if (password === ws.password) {
          performAction(ws, action, password);
        } else {
          showToast("Incorrect Password", "error");
        }
      });
    } else {
      if (action === 'toggleLock' && !ws.locked) {
        showModal("Set Password", "Create a password for this workspace:", (newPass) => {
          if(newPass) {
            ws.locked = true;
            ws.password = newPass;
            saveWorkspaceData(ws, () => showToast("Locked successfully", "success"));
          } else {
            showToast("Password cannot be empty", "error");
          }
        });
      } else {
        performAction(ws, action);
      }
    }
  }

  function performAction(ws, action) {
    if (action === 'load') {
      ws.tabs.forEach(t => chrome.tabs.create({ url: t.url, active: false }));
    }
    else if (action === 'edit') {
      enterEditMode(ws);
    }
    else if (action === 'delete') {
      showModal("Delete Workspace", `Are you sure you want to delete "${ws.name}"?`, () => {
        chrome.storage.local.get(['workspace_order'], (res) => {
          const newOrder = res.workspace_order.filter(id => id !== ws.id);
          chrome.storage.local.remove(ws.id);
          chrome.storage.local.set({ workspace_order: newOrder }, loadWorkspaces);
        });
      }, false);
    }
    else if (action === 'toggleLock' && ws.locked) {
      ws.locked = false;
      ws.password = null;
      saveWorkspaceData(ws, () => showToast("Unlocked", "success"));
    }
  }

  function saveWorkspaceData(ws, cb) {
    const data = {};
    data[ws.id] = ws;
    chrome.storage.local.set(data, () => {
      if(cb) cb();
      loadWorkspaces();
    });
  }

  // --- EDIT MODE ---
  function enterEditMode(ws) {
    currentEditingId = ws.id;
    switchView('edit');
    viewTitle.innerText = "Edit: " + ws.name;
    editNameInput.value = ws.name;

    tabList.innerHTML = '';
    ws.tabs.forEach((tab, index) => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.draggable = true;
      div.dataset.index = index;

      const iconUrl = tab.favIconUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS0xIDE3LjkzYy0zLjk1LS40OS03LTMuODUtNy03LjkzIDAtNC42MiAzLjg0LTguMzggOC41LTguNS40OCAwIC45LjAyIDEuMy4wNS0uMDIuMDMuMDQuMDUuMDYuMDggMS4yNi42MyAyLjM4IDEuNTMgMy4yIDIuNjYtMi41MS4zMy00Ljg1IDEuNjktNi40MiAzLjQ4LTIuMjMuMzUtNC4yIDEuNTYtNS41NyAzLjE0ek0xNi41IDE2aC0uOTVjLS42NSAwLTEuMjYtLjMxLTEuNTctLjgybC0uODQtMS4zNWMtLjQ4LS43OC0xLjQ3LS45LTEuODUtLjEybC0uOTMgMS44NmMtLjM5Ljc4LTEuMiAxLjI3LTIuMDggMS4yN2gtLjI4VjE0aC4yOGMuMzYgMCAuNjktLjIuODUtLjUyTDEwIDIuOTloNC41bDQuNSA5IC44NC41MmMuMTYuMS41LjE5Ljg1LjE5aC4yOHYyeiIvPjwvc3ZnPg==';

      div.innerHTML = `
        <div class="item-info" style="gap:10px">
          <img src="${iconUrl}" style="width:16px;height:16px;border-radius:3px;">
          <div class="item-name" style="font-weight:400">${tab.title || tab.url}</div>
        </div>
        <div class="actions">
           <span style="color:#ccc; cursor:grab">${ICON_DRAG}</span>
        </div>
      `;
      tabList.appendChild(div);
    });
  }

  updateNameBtn.addEventListener('click', () => {
    if(!currentEditingId) return;
    const newName = editNameInput.value.trim();
    if(!newName) return showToast("Name cannot be empty", "error");

    chrome.storage.local.get(currentEditingId, (res) => {
      const ws = res[currentEditingId];
      ws.name = newName;
      chrome.storage.local.set({ [ws.id]: ws }, () => {
        showToast("Renamed successfully", "success");
        viewTitle.innerText = "Edit: " + newName;
      });
    });
  });

  function saveWorkspaceOrder() {
    const newOrder = [];
    workspaceList.querySelectorAll('.list-item').forEach(el => newOrder.push(el.dataset.id));
    chrome.storage.local.set({ workspace_order: newOrder });
  }

  function saveTabOrder() {
    if(!currentEditingId) return;
    chrome.storage.local.get(currentEditingId, (res) => {
      const ws = res[currentEditingId];
      const oldTabs = ws.tabs;
      const newTabs = [];
      tabList.querySelectorAll('.list-item').forEach(el => {
        newTabs.push(oldTabs[parseInt(el.dataset.index)]);
      });
      // Re-index
      tabList.querySelectorAll('.list-item').forEach((el, idx) => el.dataset.index = idx);
      ws.tabs = newTabs;
      chrome.storage.local.set({ [ws.id]: ws });
    });
  }

  // --- HELPERS (Toast & Modal) ---

  function switchView(viewName) {
    if (viewName === 'main') {
      mainView.classList.remove('hidden');
      editView.classList.add('hidden');
      backBtn.style.display = 'none';
      viewTitle.innerText = 'My Workspaces';
      loadWorkspaces();
    } else {
      mainView.classList.add('hidden');
      editView.classList.remove('hidden');
      backBtn.style.display = 'block';
    }
  }

  // Replaces Alert
  function showToast(msg, type = "default") {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.className = type; 
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); }, 2500);
  }

  function showModal(title, desc, callback, showInput = true) {
    modalTitle.innerText = title;
    modalDesc.innerText = desc;
    modalInput.value = '';
    
    if (showInput) {
      modalInput.classList.remove('hidden');
      modalInput.focus();
    } else {
      modalInput.classList.add('hidden');
    }
    
    modalOverlay.style.display = 'flex';
    modalCallback = callback;
  }

  modalConfirm.addEventListener('click', () => {
    const val = modalInput.value;
    if (modalCallback) {
      modalCallback(val);
      modalOverlay.style.display = 'none';
    }
  });
  
  // Allow hitting Enter in password modal
  modalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') modalConfirm.click();
  });

  modalCancel.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    modalCallback = null;
  });
  
  function setupGithubLink() {
    document.getElementById('githubLink').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://github.com/rx76d' });
    });
  }
});