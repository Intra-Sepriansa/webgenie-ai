import * as vscode from 'vscode';
import * as path from 'path';
import { GeneratedFile } from '../types';

export class FileService {
  /**
   * Ensures that a workspace folder is open.
   */
  public static ensureWorkspace(): vscode.WorkspaceFolder {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      throw new Error(
        'No workspace folder is currently open! Please open a project folder in VS Code before generating files.'
      );
    }
    return folders[0];
  }

  /**
   * Writes all generated files to the active workspace.
   */
  public static async writeProjectFiles(
    files: GeneratedFile[],
    onProgress?: (filePath: string, index: number, total: number) => void
  ): Promise<string[]> {
    const workspaceFolder = this.ensureWorkspace();
    const rootUri = workspaceFolder.uri;
    const writtenFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Clean path to prevent path traversal
      const cleanRelativePath = file.path
        .replace(/^[/\\]+/, '')
        .replace(/\.\.[/\\]/g, '');

      const targetUri = vscode.Uri.joinPath(rootUri, cleanRelativePath);
      const dirUri = vscode.Uri.joinPath(rootUri, path.dirname(cleanRelativePath));

      try {
        // Ensure directory exists
        await vscode.workspace.fs.createDirectory(dirUri);

        // Write file buffer
        const contentBuffer = Buffer.from(file.content, 'utf8');
        await vscode.workspace.fs.writeFile(targetUri, contentBuffer);

        writtenFiles.push(cleanRelativePath);

        if (onProgress) {
          onProgress(cleanRelativePath, i + 1, files.length);
        }
      } catch (err: any) {
        throw new Error(
          `Failed to write file "${cleanRelativePath}": ${err?.message || err}`
        );
      }
    }

    return writtenFiles;
  }

  /**
   * Opens a file in the active editor.
   */
  public static async openFile(relativePath: string): Promise<void> {
    const workspaceFolder = this.ensureWorkspace();
    const cleanPath = relativePath.replace(/^[/\\]+/, '');
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, cleanPath);
    
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document, { preview: false });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Unable to open file: ${relativePath}`);
    }
  }
}
