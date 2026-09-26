import * as vscode from 'vscode';
import { AIService } from './services/aiService';
import { FileService } from './services/fileService';
import { TerminalService } from './services/terminalService';
import { VerificationService } from './services/verificationService';
import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from './types';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'webgenie.sidebarView';
  private static readonly SECRET_KEY = 'deepseek_api_key';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data: WebviewToExtensionMessage) => {
      switch (data.command) {
        case 'getApiKeyStatus': {
          await this.notifyApiKeyStatus();
          break;
        }

        case 'setApiKey': {
          if (data.apiKey) {
            await this._context.secrets.store(SidebarProvider.SECRET_KEY, data.apiKey.trim());
            vscode.window.showInformationMessage('WebGenie: DeepSeek API Key saved.');
            await this.notifyApiKeyStatus();
          }
          break;
        }

        case 'clearApiKey': {
          await this._context.secrets.delete(SidebarProvider.SECRET_KEY);
          vscode.window.showInformationMessage('WebGenie: DeepSeek API Key removed.');
          await this.notifyApiKeyStatus();
          break;
        }

        case 'generate': {
          await this.handleGenerate(data.prompt, data.model, data.framework);
          break;
        }

        case 'runDevServer': {
          try {
            TerminalService.runCommand(data.customCommand || 'npm install && npm run dev');
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to run terminal: ${err.message}`);
          }
          break;
        }

        case 'openFile': {
          try {
            await FileService.openFile(data.filePath);
          } catch (err: any) {
            vscode.window.showErrorMessage(`Could not open file: ${err.message}`);
          }
          break;
        }

        case 'scanAndFixErrors': {
          try {
            const workspace = FileService.ensureWorkspace();
            const apiKey = await this._context.secrets.get(SidebarProvider.SECRET_KEY);
            const aiService = apiKey ? new AIService(apiKey) : undefined;
            const report = await VerificationService.scanWorkspace(workspace.uri, aiService);
            this.postMessage({
              type: 'verificationComplete',
              report
            });
          } catch (err: any) {
            vscode.window.showErrorMessage(`Verification scan failed: ${err.message}`);
          }
          break;
        }

        case 'fixSingleError': {
          try {
            const workspace = FileService.ensureWorkspace();
            const apiKey = await this._context.secrets.get(SidebarProvider.SECRET_KEY);
            if (!apiKey) {
              throw new Error('API Key is required to repair errors with AI.');
            }
            const aiService = new AIService(apiKey);
            const res = await VerificationService.fixWorkspaceIssue(
              {
                type: 'syntax_error',
                filePath: data.filePath,
                message: data.issueMessage
              },
              workspace.uri,
              aiService
            );
            this.postMessage({
              type: 'errorFixed',
              filePath: data.filePath,
              success: res.success,
              message: res.message
            });
            if (res.success) {
              vscode.window.showInformationMessage(`WebGenie: ${res.message}`);
            } else {
              vscode.window.showWarningMessage(`WebGenie: ${res.message}`);
            }
          } catch (err: any) {
            vscode.window.showErrorMessage(`Fix error failed: ${err.message}`);
          }
          break;
        }
      }
    });
  }

  public async promptSetApiKey(): Promise<void> {
    const key = await vscode.window.showInputBox({
      title: 'Enter DeepSeek API Key',
      prompt: 'Your API key is securely encrypted in VS Code keychain.',
      password: true,
      ignoreFocusOut: true,
      placeHolder: 'sk-...'
    });

    if (key && key.trim()) {
      await this._context.secrets.store(SidebarProvider.SECRET_KEY, key.trim());
      vscode.window.showInformationMessage('WebGenie: DeepSeek API Key saved.');
      await this.notifyApiKeyStatus();
    }
  }

  public async promptClearApiKey(): Promise<void> {
    await this._context.secrets.delete(SidebarProvider.SECRET_KEY);
    vscode.window.showInformationMessage('WebGenie: DeepSeek API Key removed.');
    await this.notifyApiKeyStatus();
  }

  private async notifyApiKeyStatus(): Promise<void> {
    const key = await this._context.secrets.get(SidebarProvider.SECRET_KEY);
    const hasKey = !!(key && key.trim().length > 0);
    const maskedKey = hasKey && key
      ? `${key.slice(0, 4)}...${key.slice(-4)}`
      : undefined;

    this.postMessage({
      type: 'apiKeyStatus',
      hasKey,
      maskedKey
    });
  }

  private async handleGenerate(
    prompt: string,
    model: string = 'deepseek-chat',
    framework?: string
  ): Promise<void> {
    try {
      FileService.ensureWorkspace();

      const apiKey = await this._context.secrets.get(SidebarProvider.SECRET_KEY);
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('DeepSeek API Key is not set. Please click the gear icon to configure.');
      }

      this.postMessage({
        type: 'generationProgress',
        progress: {
          step: 'prompting',
          message: 'Communicating with DeepSeek AI to architect the application...'
        }
      });

      const aiService = new AIService(apiKey);
      const projectResponse = await aiService.generateProject(
        prompt,
        model,
        framework,
        undefined,
        (streamedLength, activeFile) => {
          this.postMessage({
            type: 'generationProgress',
            progress: {
              step: 'prompting',
              message: activeFile
                ? `Generating ${activeFile}...`
                : `DeepSeek is streaming code (${Math.round(streamedLength / 4)} tokens)...`
            }
          });
        }
      );

      this.postMessage({
        type: 'generationProgress',
        progress: {
          step: 'writing',
          message: `Writing ${projectResponse.files.length} project files into workspace...`,
          totalFiles: projectResponse.files.length
        }
      });

      // 6. Write files
      let allCreatedFiles = await FileService.writeProjectFiles(
        projectResponse.files,
        (filePath, index, total) => {
          this.postMessage({
            type: 'fileCreated',
            path: filePath,
            index,
            total
          });
        }
      );

      // Verification & Error Detection (Auto-Heal missing assets / syntax check / AI self-repair)
      this.postMessage({
        type: 'generationProgress',
        progress: {
          step: 'verifying',
          message: 'Verifying code integrity, syntax, and asset references...'
        }
      });

      const { files: healedFiles, report } = await VerificationService.verifyAndHeal(
        projectResponse.files,
        FileService.ensureWorkspace().uri,
        aiService
      );

      if (report.autoFixedCount > 0) {
        const newlyAdded = healedFiles.slice(projectResponse.files.length);
        if (newlyAdded.length > 0) {
          const extraWritten = await FileService.writeProjectFiles(newlyAdded);
          allCreatedFiles = allCreatedFiles.concat(extraWritten);
        }
      }

      projectResponse.files = healedFiles;

      const verificationNotes = report.summary;

      this.postMessage({
        type: 'generationSuccess',
        response: projectResponse,
        createdFiles: allCreatedFiles,
        verificationReport: report,
        verificationNotes
      });

      const selection = await vscode.window.showInformationMessage(
        `WebGenie: Generated "${projectResponse.projectName}" with ${allCreatedFiles.length} files. (${verificationNotes})`,
        'Launch Dev Server'
      );

      if (selection === 'Launch Dev Server') {
        TerminalService.runCommand(projectResponse.suggestedCommand);
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred while generating project.';
      this.postMessage({
        type: 'generationError',
        error: errorMessage
      });
      vscode.window.showErrorMessage(`WebGenie Error: ${errorMessage}`);
    }
  }

  private postMessage(message: ExtensionToWebviewMessage): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet" />
  <title>WebGenie AI</title>
</head>
<body>
  <!-- Top Navigation (Codex Style) -->
  <div class="top-nav">
    <div class="chats-title">Chats</div>
    <div class="nav-actions">
      <button id="btn-scan-errors" class="btn-icon" title="Scan & Fix Workspace Errors">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="m9 12 2 2 4-4"></path>
        </svg>
      </button>
      <button id="btn-history" class="btn-icon" title="Recent History">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </button>
      <button id="btn-toggle-settings" class="btn-icon" title="Settings (API Key)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
      <button id="btn-new-chat" class="btn-icon" title="New Session">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      </button>
    </div>
  </div>

  <!-- Recent Chats List (Collapsible) -->
  <div id="recent-chats-list" class="recent-chats-list" style="display:none;"></div>

  <!-- Settings Drawer (API Key) -->
  <div id="settings-drawer" class="settings-drawer">
    <label class="input-label" for="api-key-input">DeepSeek API Key</label>
    <div class="input-group">
      <input type="password" id="api-key-input" class="text-input" placeholder="sk-..." />
      <button id="btn-save-key" class="btn-secondary">Save</button>
      <button id="btn-clear-key" class="btn-secondary" style="display:none;">Clear</button>
    </div>
    <div class="helper-text">
      Get key from <a href="https://platform.deepseek.com/api_keys">platform.deepseek.com</a>.
    </div>
  </div>

  <!-- Main Chat Body -->
  <div class="chat-body" id="chat-body">
    <!-- Center Watermark Icon (Codex Style) -->
    <div id="empty-state" class="empty-state">
      <svg class="watermark-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
        <polyline points="8 14 10 16 8 18"></polyline>
        <line x1="12" y1="18" x2="14" y2="18"></line>
      </svg>
    </div>

    <!-- Active User Message Bubble -->
    <div id="user-msg-bubble" class="user-msg-bubble" style="display:none;"></div>

    <!-- Diagnostic Card (On-Demand Workspace Scan) -->
    <div id="diagnostic-card" class="diagnostic-card" style="display:none;">
      <div class="diagnostic-header">
        <div class="diagnostic-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="m9 12 2 2 4-4"></path>
          </svg>
          <span>Workspace Diagnostic</span>
        </div>
        <button id="btn-close-diagnostic" class="btn-icon" title="Close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div id="diagnostic-summary" class="diagnostic-summary">Scanning workspace for errors...</div>
      <div id="diagnostic-list" class="diagnostic-list"></div>
    </div>

    <!-- Progress Card -->
    <div id="progress-card" class="progress-card">
      <div class="progress-header">
        <div class="spinner"></div>
        <span id="progress-header-msg">Generating project...</span>
      </div>
      <div class="progress-bar-container">
        <div id="progress-bar" class="progress-bar"></div>
      </div>
      <div id="progress-msg" class="progress-msg">Please wait...</div>
    </div>

    <!-- Results Card -->
    <div id="results-card" class="results-card">
      <div id="result-title" class="result-title">Project Generated</div>
      <div id="result-desc" class="result-desc">All files have been written directly to your workspace.</div>
      
      <!-- Verification Badge & Diagnostic -->
      <div id="verification-card" class="verification-card">
        <div class="verification-pill" id="verification-pill">
          <svg class="verify-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span id="verification-summary">Verified: 0 syntax or asset errors found</span>
        </div>
        <div id="verification-issues-list" class="verification-issues-list" style="display:none;"></div>
      </div>

      <div id="file-list-box" class="file-list-box"></div>

      <div class="terminal-action-box">
        <div class="terminal-cmd" id="terminal-cmd-text">npm install && npm run dev</div>
        <button id="btn-run-dev" class="btn-action">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          Launch Dev Server in Terminal
        </button>
      </div>
    </div>

    <!-- Error Card -->
    <div id="error-card" class="error-card">
      <div style="font-weight:700; margin-bottom:4px;">Generation Failed</div>
      <div id="error-msg"></div>
    </div>
  </div>

  <!-- Codex Bottom Input Capsule -->
  <div class="input-capsule">
    <textarea id="prompt-input" class="capsule-textarea" rows="2" placeholder="Mau buat apa..."></textarea>
    
    <div class="capsule-footer">
      <div class="footer-left">
        <button id="btn-clear-chat" class="capsule-btn-tool" title="Add / Reset">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <select id="model-select" class="capsule-select" title="DeepSeek Model">
          <option value="deepseek-chat" selected>V3</option>
          <option value="deepseek-reasoner">R1</option>
        </select>
        <select id="framework-select" class="capsule-select" title="Tech Stack">
          <option value="Auto / Best Fit" selected>Auto</option>
          <option value="PHP Native + MySQL (database.sql, CRUD)">PHP</option>
          <option value="Modern HTML5 + Tailwind CSS + Vanilla JS (Zero Config)">HTML</option>
          <option value="Vite + React + TypeScript + Tailwind CSS">React</option>
          <option value="Node.js + Express + REST API">Node</option>
          <option value="Python Flask + SQLite">Python</option>
        </select>
      </div>

      <button id="btn-send" class="btn-send" title="Send (Enter)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </button>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
