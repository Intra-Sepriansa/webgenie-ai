export interface GeneratedFile {
  path: string;
  content: string;
  description?: string;
}

export interface AIProjectResponse {
  projectName: string;
  description: string;
  summary: string;
  files: GeneratedFile[];
  suggestedCommand: string;
}

export interface GenerationProgress {
  step: 'idle' | 'prompting' | 'parsing' | 'writing' | 'completed' | 'error';
  message: string;
  filesWritten?: number;
  totalFiles?: number;
  currentFile?: string;
  suggestedCommand?: string;
}

export type WebviewToExtensionMessage =
  | { command: 'generate'; prompt: string; model?: string; framework?: string }
  | { command: 'setApiKey'; apiKey: string }
  | { command: 'getApiKeyStatus' }
  | { command: 'clearApiKey' }
  | { command: 'runDevServer'; customCommand?: string }
  | { command: 'openFile'; filePath: string };

export type ExtensionToWebviewMessage =
  | { type: 'apiKeyStatus'; hasKey: boolean; maskedKey?: string }
  | { type: 'generationStart'; prompt: string }
  | { type: 'generationProgress'; progress: GenerationProgress }
  | { type: 'fileCreated'; path: string; index: number; total: number }
  | { type: 'generationSuccess'; response: AIProjectResponse; createdFiles: string[] }
  | { type: 'generationError'; error: string };
