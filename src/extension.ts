import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';
import { TerminalService } from './services/terminalService';

export function activate(context: vscode.ExtensionContext) {
  console.log('WebGenie AI is now active!');

  // Register Webview Sidebar Provider
  const sidebarProvider = new SidebarProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Register Command: Set DeepSeek API Key
  const setApiKeyCommand = vscode.commands.registerCommand(
    'webgenie.setApiKey',
    async () => {
      await sidebarProvider.promptSetApiKey();
    }
  );

  // Register Command: Clear DeepSeek API Key
  const clearApiKeyCommand = vscode.commands.registerCommand(
    'webgenie.clearApiKey',
    async () => {
      await sidebarProvider.promptClearApiKey();
    }
  );

  // Register Command: Run Dev Server
  const runDevServerCommand = vscode.commands.registerCommand(
    'webgenie.runDevServer',
    () => {
      try {
        TerminalService.runCommand('npm install && npm run dev');
      } catch (err: any) {
        vscode.window.showErrorMessage(`WebGenie: ${err.message}`);
      }
    }
  );

  context.subscriptions.push(
    setApiKeyCommand,
    clearApiKeyCommand,
    runDevServerCommand
  );
}

export function deactivate() {
  console.log('WebGenie AI has been deactivated.');
}
