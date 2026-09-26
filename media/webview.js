// @ts-nocheck
(function () {
  const vscode = acquireVsCodeApi();

  // Navigation & Settings
  const btnHistory = document.getElementById('btn-history');
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const btnScanErrors = document.getElementById('btn-scan-errors');
  const btnNewChat = document.getElementById('btn-new-chat');
  const btnClearChat = document.getElementById('btn-clear-chat');
  const recentChatsList = document.getElementById('recent-chats-list');
  const settingsDrawer = document.getElementById('settings-drawer');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnSaveKey = document.getElementById('btn-save-key');
  const btnClearKey = document.getElementById('btn-clear-key');

  // Chat body & state
  const chatBody = document.getElementById('chat-body');
  const emptyState = document.getElementById('empty-state');
  const userMsgBubble = document.getElementById('user-msg-bubble');
  const progressCard = document.getElementById('progress-card');
  const progressHeaderMsg = document.getElementById('progress-header-msg');
  const progressBar = document.getElementById('progress-bar');
  const progressMsg = document.getElementById('progress-msg');
  const resultsCard = document.getElementById('results-card');
  const resultTitle = document.getElementById('result-title');
  const resultDesc = document.getElementById('result-desc');
  const verificationCard = document.getElementById('verification-card');
  const verificationPill = document.getElementById('verification-pill');
  const verificationSummary = document.getElementById('verification-summary');
  const verificationIssuesList = document.getElementById('verification-issues-list');
  const fileListBox = document.getElementById('file-list-box');
  const terminalCmdText = document.getElementById('terminal-cmd-text');
  const btnRunDev = document.getElementById('btn-run-dev');
  const errorCard = document.getElementById('error-card');
  const errorMsg = document.getElementById('error-msg');

  // Diagnostic Card (On demand)
  const diagnosticCard = document.getElementById('diagnostic-card');
  const btnCloseDiagnostic = document.getElementById('btn-close-diagnostic');
  const diagnosticSummary = document.getElementById('diagnostic-summary');
  const diagnosticList = document.getElementById('diagnostic-list');

  // Input capsule
  const promptInput = document.getElementById('prompt-input');
  const modelSelect = document.getElementById('model-select');
  const frameworkSelect = document.getElementById('framework-select');
  const btnSend = document.getElementById('btn-send');

  let currentCommand = 'npm install && npm run dev';
  let hasValidApiKey = false;
  let recentHistory = [];

  // Check API key on load
  vscode.postMessage({ command: 'getApiKeyStatus' });

  // Toggle Settings Drawer
  btnToggleSettings.addEventListener('click', () => {
    settingsDrawer.classList.toggle('open');
  });

  // Toggle Recent History
  btnHistory.addEventListener('click', () => {
    if (recentChatsList.style.display === 'none') {
      renderRecentHistory();
      recentChatsList.style.display = 'block';
    } else {
      recentChatsList.style.display = 'none';
    }
  });

  // On-demand Error Scan
  if (btnScanErrors) {
    btnScanErrors.addEventListener('click', () => {
      diagnosticCard.style.display = 'block';
      diagnosticSummary.textContent = 'Scanning workspace for errors...';
      diagnosticList.innerHTML = '<div style="padding:6px; font-size:10px; color:#71717a;">Checking PHP syntax, JS integrity, and missing stylesheets/scripts...</div>';
      chatBody.scrollTop = chatBody.scrollHeight;
      vscode.postMessage({ command: 'scanAndFixErrors' });
    });
  }

  if (btnCloseDiagnostic) {
    btnCloseDiagnostic.addEventListener('click', () => {
      diagnosticCard.style.display = 'none';
    });
  }

  // New Chat / Clear
  function resetChatView() {
    emptyState.style.display = 'flex';
    userMsgBubble.style.display = 'none';
    progressCard.classList.remove('active');
    resultsCard.classList.remove('active');
    errorCard.classList.remove('active');
    if (diagnosticCard) diagnosticCard.style.display = 'none';
    if (verificationIssuesList) {
      verificationIssuesList.innerHTML = '';
      verificationIssuesList.style.display = 'none';
    }
    promptInput.value = '';
    updateSendButtonState();
    promptInput.focus();
  }

  btnNewChat.addEventListener('click', resetChatView);
  btnClearChat.addEventListener('click', resetChatView);

  // Save API Key
  btnSaveKey.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) return;
    vscode.postMessage({ command: 'setApiKey', apiKey: key });
    apiKeyInput.value = '';
    settingsDrawer.classList.remove('open');
  });

  // Clear API Key
  btnClearKey.addEventListener('click', () => {
    vscode.postMessage({ command: 'clearApiKey' });
  });

  // Textarea input monitoring
  promptInput.addEventListener('input', () => {
    updateSendButtonState();
  });

  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      triggerGenerate();
    }
  });

  btnSend.addEventListener('click', () => {
    triggerGenerate();
  });

  function updateSendButtonState() {
    const hasText = promptInput.value.trim().length > 0;
    if (hasText) {
      btnSend.classList.add('active');
    } else {
      btnSend.classList.remove('active');
    }
  }

  // Trigger Generation
  function triggerGenerate() {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    if (!hasValidApiKey) {
      settingsDrawer.classList.add('open');
      apiKeyInput.focus();
      showError('Please set your DeepSeek API Key first.');
      return;
    }

    // UI Updates
    hideError();
    emptyState.style.display = 'none';
    userMsgBubble.style.display = 'block';
    userMsgBubble.textContent = prompt;

    resultsCard.classList.remove('active');
    fileListBox.innerHTML = '';
    if (verificationIssuesList) {
      verificationIssuesList.innerHTML = '';
      verificationIssuesList.style.display = 'none';
    }
    btnSend.classList.remove('active');
    promptInput.value = '';

    // Show progress
    progressCard.classList.add('active');
    progressBar.style.width = '20%';
    progressHeaderMsg.textContent = 'Designing with DeepSeek AI...';
    progressMsg.textContent = 'Planning files and code structure...';

    // Add to history
    recentHistory.unshift({
      title: prompt.length > 28 ? prompt.substring(0, 28) + '...' : prompt,
      time: 'Just now'
    });
    if (recentHistory.length > 5) recentHistory.pop();

    vscode.postMessage({
      command: 'generate',
      prompt: prompt,
      model: modelSelect.value,
      framework: frameworkSelect.value
    });

    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // Run Dev Server Button
  btnRunDev.addEventListener('click', () => {
    vscode.postMessage({
      command: 'runDevServer',
      customCommand: currentCommand
    });
  });

  function showError(msg) {
    errorCard.classList.add('active');
    errorMsg.textContent = msg;
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function hideError() {
    errorCard.classList.remove('active');
    errorMsg.textContent = '';
  }

  function renderRecentHistory() {
    recentChatsList.innerHTML = '';
    if (recentHistory.length === 0) {
      recentChatsList.innerHTML = '<div style="padding:6px; font-size:11px; color:#71717a;">No recent sessions</div>';
      return;
    }
    recentHistory.forEach(item => {
      const el = document.createElement('div');
      el.className = 'recent-chat-item';
      el.innerHTML = `
        <span class="recent-chat-title">${item.title}</span>
        <span class="recent-chat-time">${item.time}</span>
      `;
      recentChatsList.appendChild(el);
    });
  }

  function createIssueElement(issue) {
    const item = document.createElement('div');
    item.className = 'issue-item';

    const left = document.createElement('div');
    left.className = 'issue-left';

    const title = document.createElement('div');
    title.className = 'issue-title';
    title.textContent = issue.filePath + (issue.line ? `:${issue.line}` : '');

    const msg = document.createElement('div');
    msg.className = 'issue-msg';
    msg.textContent = issue.message;

    left.appendChild(title);
    left.appendChild(msg);

    const right = document.createElement('div');
    right.className = 'issue-right';

    if (issue.fixed) {
      const badge = document.createElement('span');
      badge.className = 'issue-status-badge fixed';
      badge.textContent = 'Auto-Healed';
      right.appendChild(badge);
    } else {
      const btnFix = document.createElement('button');
      btnFix.className = 'btn-fix-ai';
      btnFix.textContent = 'Fix with AI';
      btnFix.addEventListener('click', () => {
        btnFix.textContent = 'Fixing...';
        btnFix.disabled = true;
        vscode.postMessage({
          command: 'fixSingleError',
          filePath: issue.filePath,
          issueMessage: issue.message
        });
      });
      right.appendChild(btnFix);
    }

    item.appendChild(left);
    item.appendChild(right);
    return item;
  }

  // Handle messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'apiKeyStatus':
        hasValidApiKey = message.hasKey;
        if (message.hasKey) {
          btnClearKey.style.display = 'inline-block';
        } else {
          btnClearKey.style.display = 'none';
        }
        break;

      case 'generationProgress':
        progressCard.classList.add('active');
        if (message.progress.step === 'prompting') {
          progressHeaderMsg.textContent = 'Generating with DeepSeek AI...';
          progressMsg.textContent = message.progress.message;
          const current = parseInt(progressBar.style.width) || 15;
          if (current < 65) {
            progressBar.style.width = `${current + 2}%`;
          }
        } else if (message.progress.step === 'writing') {
          progressBar.style.width = '75%';
          progressHeaderMsg.textContent = 'Writing Workspace Files...';
          progressMsg.textContent = message.progress.message;
        } else if (message.progress.step === 'verifying') {
          progressBar.style.width = '92%';
          progressHeaderMsg.textContent = 'Verifying Code & Assets...';
          progressMsg.textContent = message.progress.message;
        }
        chatBody.scrollTop = chatBody.scrollHeight;
        break;

      case 'fileCreated':
        {
          const percent = Math.round((message.index / message.total) * 100);
          progressBar.style.width = `${percent}%`;
          progressMsg.textContent = `Writing (${message.index}/${message.total}): ${message.path}`;

          const item = document.createElement('div');
          item.className = 'file-item';
          item.innerHTML = `
            <div class="file-item-left">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>${message.path}</span>
            </div>
            <span style="font-size:9px; color:#71717a;">created</span>
          `;
          item.addEventListener('click', () => {
            vscode.postMessage({ command: 'openFile', filePath: message.path });
          });
          fileListBox.appendChild(item);
          chatBody.scrollTop = chatBody.scrollHeight;
        }
        break;

      case 'generationSuccess':
        progressCard.classList.remove('active');
        resultsCard.classList.add('active');

        resultTitle.textContent = message.response.projectName;
        resultDesc.textContent = message.response.summary || message.response.description;

        currentCommand = message.response.suggestedCommand || 'npm install && npm run dev';
        terminalCmdText.textContent = currentCommand;

        // Verification & Error Detection Display
        if (verificationSummary) {
          verificationSummary.textContent = message.verificationNotes || 'Verified: 0 syntax or asset errors found.';
        }
        if (verificationIssuesList) {
          verificationIssuesList.innerHTML = '';
          if (message.verificationReport && message.verificationReport.issues && message.verificationReport.issues.length > 0) {
            verificationIssuesList.style.display = 'flex';
            message.verificationReport.issues.forEach(issue => {
              const item = createIssueElement(issue);
              verificationIssuesList.appendChild(item);
            });
          } else {
            verificationIssuesList.style.display = 'none';
          }
        }

        chatBody.scrollTop = chatBody.scrollHeight;
        break;

      case 'verificationComplete':
        if (diagnosticCard) {
          diagnosticCard.style.display = 'block';
          diagnosticSummary.textContent = message.report.summary;
          diagnosticList.innerHTML = '';
          if (!message.report.issues || message.report.issues.length === 0) {
            diagnosticList.innerHTML = '<div style="padding:6px; font-size:10px; color:#a1a1aa;">All files verified. 0 syntax errors or missing references.</div>';
          } else {
            message.report.issues.forEach(issue => {
              const item = createIssueElement(issue);
              diagnosticList.appendChild(item);
            });
          }
          chatBody.scrollTop = chatBody.scrollHeight;
        }
        break;

      case 'errorFixed':
        if (diagnosticSummary) {
          diagnosticSummary.textContent = message.message;
        }
        // Re-scan workspace automatically to refresh issues
        vscode.postMessage({ command: 'scanAndFixErrors' });
        break;

      case 'generationError':
        progressCard.classList.remove('active');
        showError(message.error);
        break;
    }
  });
})();
