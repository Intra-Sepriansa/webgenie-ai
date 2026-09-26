import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { jsonrepair } from 'jsonrepair';
import { GeneratedFile, VerificationIssue, VerificationReport } from '../types';
import { AIService } from './aiService';

const execAsync = promisify(exec);

export class VerificationService {
  /**
   * Scans generated files for missing assets, broken references, and syntax errors.
   * Performs automatic self-healing for missing CSS/JS/DB and autonomous AI repair on syntax errors.
   */
  public static async verifyAndHeal(
    files: GeneratedFile[],
    workspaceUri: vscode.Uri,
    aiService?: AIService
  ): Promise<{ files: GeneratedFile[]; report: VerificationReport }> {
    const issues: VerificationIssue[] = [];
    const fileMap = new Map<string, GeneratedFile>();

    for (const f of files) {
      const normalized = f.path.replace(/^[/\\]+/, '').toLowerCase();
      fileMap.set(normalized, f);
    }

    let autoFixedCount = 0;
    const healedFiles = [...files];

    // 1. Scan for missing referenced assets (<link href="...">, <script src="...">, require/include)
    for (const file of files) {
      const ext = path.extname(file.path).toLowerCase();
      if (['.html', '.php', '.jsx', '.tsx'].includes(ext)) {
        // CSS references: <link ... href="path/to/style.css">
        const cssMatches = [...file.content.matchAll(/<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi)];
        for (const m of cssMatches) {
          const href = m[1].trim();
          if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('//') && !href.startsWith('data:')) {
            const cleanHref = href.replace(/^[/\\]+/, '').split('?')[0].split('#')[0];
            const lowerHref = cleanHref.toLowerCase();

            if (!fileMap.has(lowerHref)) {
              // Self-healing: auto generate modern fallback CSS
              if (cleanHref.endsWith('.css')) {
                const autoCss = this.generateFallbackCss();
                healedFiles.push({ path: cleanHref, content: autoCss });
                fileMap.set(lowerHref, { path: cleanHref, content: autoCss });
                autoFixedCount++;
                issues.push({
                  type: 'missing_file',
                  filePath: cleanHref,
                  message: `Missing stylesheet "${cleanHref}" referenced in "${file.path}" (Auto-Generated modern stylesheet)`,
                  fixed: true
                });
              } else {
                issues.push({
                  type: 'missing_file',
                  filePath: cleanHref,
                  message: `Missing asset "${cleanHref}" referenced in "${file.path}"`,
                  fixed: false
                });
              }
            }
          }
        }

        // JS references: <script ... src="path/to/script.js">
        const jsMatches = [...file.content.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)];
        for (const m of jsMatches) {
          const src = m[1].trim();
          if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//')) {
            const cleanSrc = src.replace(/^[/\\]+/, '').split('?')[0].split('#')[0];
            const lowerSrc = cleanSrc.toLowerCase();

            if (!fileMap.has(lowerSrc)) {
              if (cleanSrc.endsWith('.js')) {
                const autoJs = this.generateFallbackJs(cleanSrc);
                healedFiles.push({ path: cleanSrc, content: autoJs });
                fileMap.set(lowerSrc, { path: cleanSrc, content: autoJs });
                autoFixedCount++;
                issues.push({
                  type: 'missing_file',
                  filePath: cleanSrc,
                  message: `Missing script "${cleanSrc}" referenced in "${file.path}" (Auto-Generated functional script)`,
                  fixed: true
                });
              } else {
                issues.push({
                  type: 'missing_file',
                  filePath: cleanSrc,
                  message: `Missing script file "${cleanSrc}" referenced in "${file.path}"`,
                  fixed: false
                });
              }
            }
          }
        }

        // PHP require/include
        if (ext === '.php') {
          const incMatches = [...file.content.matchAll(/(?:require|include)(?:_once)?\s*(?:\(?\s*__DIR__\s*\.\s*)?['"]([^'"]+)['"]/gi)];
          for (const m of incMatches) {
            const incPath = m[1].replace(/^[/\\]+/, '').split('?')[0].split('#')[0];
            const lowerInc = incPath.toLowerCase();

            if (!incPath.includes('..') && !fileMap.has(lowerInc)) {
              // If it's a database connector like koneksi.php or db.php, auto-generate Smart Dual-Engine connector
              if (lowerInc.includes('koneksi') || lowerInc.includes('db') || lowerInc.includes('database')) {
                const autoDb = this.generateFallbackDatabase();
                healedFiles.push({ path: incPath, content: autoDb });
                fileMap.set(lowerInc, { path: incPath, content: autoDb });
                autoFixedCount++;
                issues.push({
                  type: 'db_config',
                  filePath: incPath,
                  message: `Missing database connection "${incPath}" (Auto-Generated Smart Dual-Engine connector)`,
                  fixed: true
                });
              } else {
                issues.push({
                  type: 'missing_file',
                  filePath: incPath,
                  message: `PHP require file "${incPath}" referenced in "${file.path}" not found`,
                  fixed: false
                });
              }
            }
          }
        }
      }
    }

    // 2. Multi-engine Syntax Checking (PHP, JS, JSON, CSS)
    for (let i = 0; i < healedFiles.length; i++) {
      const f = healedFiles[i];
      const fullPath = vscode.Uri.joinPath(workspaceUri, f.path).fsPath;

      // PHP Syntax Check via `php -l`
      if (f.path.endsWith('.php')) {
        try {
          await execAsync(`php -l "${fullPath}"`);
        } catch (err: any) {
          const output = (err?.stdout || err?.stderr || '').trim();
          if (output.includes('Parse error') || output.includes('syntax error')) {
            const lineMatch = output.match(/on line (\d+)/i);
            const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
            const errMsg = output.split('\n')[0];

            let fixed = false;
            // Attempt autonomous AI self-healing if aiService is available
            if (aiService) {
              try {
                const fixedCode = await aiService.fixFileError(f.path, f.content, errMsg);
                if (fixedCode && fixedCode !== f.content) {
                  // Write temp fix and re-verify
                  await vscode.workspace.fs.writeFile(
                    vscode.Uri.file(fullPath),
                    Buffer.from(fixedCode, 'utf8')
                  );
                  try {
                    await execAsync(`php -l "${fullPath}"`);
                    f.content = fixedCode;
                    fixed = true;
                    autoFixedCount++;
                  } catch {
                    // Revert if still failing
                    await vscode.workspace.fs.writeFile(
                      vscode.Uri.file(fullPath),
                      Buffer.from(f.content, 'utf8')
                    );
                  }
                }
              } catch {
                // Ignore AI repair failure
              }
            }

            issues.push({
              type: 'syntax_error',
              filePath: f.path,
              message: fixed
                ? `PHP syntax error on line ${lineNum || '?'}: Auto-repaired by AI`
                : `PHP syntax error on line ${lineNum || '?'}: ${errMsg}`,
              line: lineNum,
              fixed
            });
          }
        }
      }

      // JavaScript Syntax Check via `node --check`
      else if (f.path.endsWith('.js') && !f.path.includes('.min.js')) {
        try {
          await execAsync(`node --check "${fullPath}"`);
        } catch (err: any) {
          const output = (err?.stderr || err?.stdout || '').trim();
          if (output.includes('SyntaxError') || output.includes('unexpected')) {
            const lineMatch = output.match(/:(\d+)/);
            const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
            const errMsg = output.split('\n').slice(0, 2).join(' ');

            let fixed = false;
            if (aiService) {
              try {
                const fixedCode = await aiService.fixFileError(f.path, f.content, errMsg);
                if (fixedCode && fixedCode !== f.content) {
                  await vscode.workspace.fs.writeFile(
                    vscode.Uri.file(fullPath),
                    Buffer.from(fixedCode, 'utf8')
                  );
                  try {
                    await execAsync(`node --check "${fullPath}"`);
                    f.content = fixedCode;
                    fixed = true;
                    autoFixedCount++;
                  } catch {
                    await vscode.workspace.fs.writeFile(
                      vscode.Uri.file(fullPath),
                      Buffer.from(f.content, 'utf8')
                    );
                  }
                }
              } catch {
                // Ignore AI repair failure
              }
            }

            issues.push({
              type: 'syntax_error',
              filePath: f.path,
              message: fixed
                ? `JavaScript syntax error on line ${lineNum || '?'}: Auto-repaired by AI`
                : `JavaScript syntax error: ${errMsg}`,
              line: lineNum,
              fixed
            });
          }
        }
      }

      // JSON Syntax Check & Self-Repair
      else if (f.path.endsWith('.json')) {
        try {
          JSON.parse(f.content);
        } catch (jsonErr: any) {
          try {
            const repaired = jsonrepair(f.content);
            JSON.parse(repaired);
            f.content = repaired;
            await vscode.workspace.fs.writeFile(
              vscode.Uri.file(fullPath),
              Buffer.from(repaired, 'utf8')
            );
            autoFixedCount++;
            issues.push({
              type: 'syntax_error',
              filePath: f.path,
              message: `JSON syntax error in "${f.path}" (Auto-Repaired via jsonrepair)`,
              fixed: true
            });
          } catch {
            issues.push({
              type: 'syntax_error',
              filePath: f.path,
              message: `JSON syntax error in "${f.path}": ${jsonErr.message}`,
              fixed: false
            });
          }
        }
      }

      // CSS Braces balance check
      else if (f.path.endsWith('.css')) {
        const opens = (f.content.match(/\{/g) || []).length;
        const closes = (f.content.match(/\}/g) || []).length;
        if (opens !== closes) {
          issues.push({
            type: 'syntax_error',
            filePath: f.path,
            message: `CSS brace mismatch in "${f.path}": ${opens} opening '{' vs ${closes} closing '}'`,
            fixed: false
          });
        }
      }
    }

    const unhandledIssues = issues.filter(i => !i.fixed);
    const summary = unhandledIssues.length === 0
      ? (autoFixedCount > 0
          ? `Verified: Auto-healed ${autoFixedCount} missing asset(s) / syntax issue(s). 0 errors remaining.`
          : `Verified: 0 syntax or asset errors found across ${healedFiles.length} files.`)
      : `Detected ${unhandledIssues.length} issue(s) across project files.`;

    const report: VerificationReport = {
      isValid: unhandledIssues.length === 0,
      issues,
      autoFixedCount,
      summary
    };

    return {
      files: healedFiles,
      report
    };
  }

  /**
   * Scans the entire active workspace on demand for broken references, missing assets, and syntax errors.
   */
  public static async scanWorkspace(
    _workspaceUri: vscode.Uri,
    _aiService?: AIService
  ): Promise<VerificationReport> {
    const issues: VerificationIssue[] = [];
    let autoFixedCount = 0;

    // Find all web files in workspace, ignoring node_modules, .git, vendor, dist
    const uris = await vscode.workspace.findFiles(
      '**/*.{php,html,js,css,json}',
      '{**/node_modules/**,**/.git/**,**/vendor/**,**/dist/**,**/build/**}'
    );

    const relativeFiles = uris.map(u => vscode.workspace.asRelativePath(u));
    const fileSet = new Set(relativeFiles.map(f => f.toLowerCase()));

    for (const uri of uris) {
      const relPath = vscode.workspace.asRelativePath(uri);
      const ext = path.extname(relPath).toLowerCase();
      let content = '';

      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        content = Buffer.from(bytes).toString('utf8');
      } catch {
        continue;
      }

      // Check HTML / PHP asset references
      if (['.html', '.php'].includes(ext)) {
        // CSS links
        const cssMatches = [...content.matchAll(/<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi)];
        for (const m of cssMatches) {
          const href = m[1].trim();
          if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('//') && !href.startsWith('data:')) {
            const clean = href.replace(/^[/\\]+/, '').split('?')[0].split('#')[0].toLowerCase();
            if (!fileSet.has(clean)) {
              issues.push({
                type: 'missing_file',
                filePath: relPath,
                message: `Referenced stylesheet "${href}" does not exist in workspace`,
                fixed: false
              });
            }
          }
        }

        // Script src
        const jsMatches = [...content.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)];
        for (const m of jsMatches) {
          const src = m[1].trim();
          if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//')) {
            const clean = src.replace(/^[/\\]+/, '').split('?')[0].split('#')[0].toLowerCase();
            if (!fileSet.has(clean)) {
              issues.push({
                type: 'missing_file',
                filePath: relPath,
                message: `Referenced script "${src}" does not exist in workspace`,
                fixed: false
              });
            }
          }
        }
      }

      // PHP Syntax Check
      if (ext === '.php') {
        try {
          await execAsync(`php -l "${uri.fsPath}"`);
        } catch (err: any) {
          const out = (err?.stdout || err?.stderr || '').trim();
          const lineMatch = out.match(/on line (\d+)/i);
          issues.push({
            type: 'syntax_error',
            filePath: relPath,
            message: out.split('\n')[0] || 'PHP syntax error',
            line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
            fixed: false
          });
        }
      }

      // JS Syntax Check
      else if (ext === '.js' && !relPath.includes('.min.js')) {
        try {
          await execAsync(`node --check "${uri.fsPath}"`);
        } catch (err: any) {
          const out = (err?.stderr || err?.stdout || '').trim();
          const lineMatch = out.match(/:(\d+)/);
          issues.push({
            type: 'syntax_error',
            filePath: relPath,
            message: out.split('\n').slice(0, 2).join(' ') || 'JavaScript syntax error',
            line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
            fixed: false
          });
        }
      }

      // JSON Check
      else if (ext === '.json') {
        try {
          JSON.parse(content);
        } catch (err: any) {
          issues.push({
            type: 'syntax_error',
            filePath: relPath,
            message: `JSON syntax error: ${err.message}`,
            fixed: false
          });
        }
      }
    }

    const unhandled = issues.filter(i => !i.fixed);
    const summary = unhandled.length === 0
      ? `Workspace scan completed: 0 errors detected across ${uris.length} files.`
      : `Workspace scan detected ${unhandled.length} issue(s) across ${uris.length} files.`;

    return {
      isValid: unhandled.length === 0,
      issues,
      autoFixedCount,
      summary
    };
  }

  /**
   * Fixes a single reported issue in workspace using AI.
   */
  public static async fixWorkspaceIssue(
    issue: VerificationIssue,
    workspaceUri: vscode.Uri,
    aiService: AIService
  ): Promise<{ success: boolean; message: string }> {
    try {
      const fileUri = vscode.Uri.joinPath(workspaceUri, issue.filePath);
      const bytes = await vscode.workspace.fs.readFile(fileUri);
      const originalCode = Buffer.from(bytes).toString('utf8');

      const fixedCode = await aiService.fixFileError(issue.filePath, originalCode, issue.message);
      if (!fixedCode || fixedCode === originalCode) {
        return { success: false, message: 'AI was unable to resolve the issue.' };
      }

      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(fixedCode, 'utf8'));

      // Re-verify syntax
      if (issue.filePath.endsWith('.php')) {
        await execAsync(`php -l "${fileUri.fsPath}"`);
      } else if (issue.filePath.endsWith('.js')) {
        await execAsync(`node --check "${fileUri.fsPath}"`);
      }

      return { success: true, message: `Successfully repaired ${issue.filePath}.` };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Error while fixing file' };
    }
  }

  /**
   * Generates a modern luxury monochrome dark-mode stylesheet.
   */
  public static generateFallbackCss(): string {
    return `/* WebGenie AI Design System - Modern Dark Luxury */
:root {
  --bg-main: #0c0c0e;
  --bg-card: #18181b;
  --bg-elevated: #222226;
  --border: rgba(255, 255, 255, 0.08);
  --border-focus: rgba(255, 255, 255, 0.25);
  --text-primary: #f4f4f5;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --primary: #ffffff;
  --primary-fg: #000000;
  --radius: 10px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg-main);
  color: var(--text-primary);
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px;
}

.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}

.nav-brand {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.3px;
  color: var(--text-primary);
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 16px;
}

.nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.15s ease;
}

.nav-link:hover, .nav-link.active {
  color: var(--text-primary);
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card, .card, .panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  transition: border-color 0.2s ease;
}

.stat-card:hover, .card:hover {
  border-color: var(--border-focus);
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.stat-val {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

.bar-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 10px;
}

.bar-fill {
  height: 100%;
  background: #ffffff;
  border-radius: 3px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background: var(--primary);
  color: var(--primary-fg);
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th {
  text-align: left;
  padding: 12px 14px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
}

td {
  padding: 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
}

tr:hover td {
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-primary);
}

input, select, textarea {
  width: 100%;
  padding: 9px 12px;
  background: #09090b;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

input:focus, select:focus, textarea:focus {
  border-color: var(--border-focus);
}
`;
  }

  /**
   * Generates a functional fallback script for interactive UI elements.
   */
  public static generateFallbackJs(scriptName: string): string {
    return `/**
 * WebGenie AI Client Script (${scriptName})
 */
document.addEventListener('DOMContentLoaded', () => {
  // Modal toggling
  document.querySelectorAll('[data-toggle="modal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(btn.getAttribute('data-target'));
      if (target) target.classList.toggle('active');
    });
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.tabs-container') || document;
      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      parent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = parent.querySelector(btn.getAttribute('data-pane'));
      if (pane) pane.classList.add('active');
    });
  });

  console.log('[WebGenie] Client interaction initialized.');
});
`;
  }

  /**
   * Generates a resilient Smart Dual-Engine database connector.
   */
  public static generateFallbackDatabase(): string {
    return `<?php
/**
 * Smart Dual-Engine Database Connector (MySQL + SQLite Auto-Fallback)
 * Auto-generated by WebGenie AI Verification Engine.
 */
$host = '127.0.0.1';
$port = 3306;
$db   = 'webgenie_db';
$user = 'root';
$pass = '';

$pdo = null;

// Try MySQL TCP 127.0.0.1:3306 first
try {
    $dsn = "mysql:host=$host;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 2
    ]);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS \`$db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE \`$db\`");
} catch (Exception $e) {
    // Zero-config SQLite fallback if MySQL is offline
    $sqlitePath = __DIR__ . '/database.sqlite';
    $pdo = new PDO("sqlite:" . $sqlitePath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
}
`;
  }
}
