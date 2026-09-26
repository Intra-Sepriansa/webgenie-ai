import * as vscode from 'vscode';
import { FileService } from './fileService';

export class TerminalService {
  private static terminalName = 'WebGenie Dev Server';

  /**
   * Executes a terminal command in the workspace folder.
   */
  public static runCommand(command: string = 'npm install && npm run dev'): void {
    const workspaceFolder = FileService.ensureWorkspace();

    // Look for an existing WebGenie terminal or create a new one
    let terminal = vscode.window.terminals.find(t => t.name === this.terminalName);
    if (!terminal) {
      terminal = vscode.window.createTerminal({
        name: this.terminalName,
        cwd: workspaceFolder.uri.fsPath
      });
    }

    terminal.show(false);
    terminal.sendText(command);
  }
}
