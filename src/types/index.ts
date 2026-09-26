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
  step: 'idle' | 'prompting' | 'parsing' | 'writing' | 'verifying' | 'completed' | 'error';
  message: string;
  filesWritten?: number;
  totalFiles?: number;
  currentFile?: string;
  suggestedCommand?: string;
}

export interface VerificationIssue {
  type: 'missing_file' | 'syntax_error' | 'db_config' | 'broken_link';
  filePath: string;
  message: string;
  line?: number;
  fixed?: boolean;
}

export interface VerificationReport {
  isValid: boolean;
  issues: VerificationIssue[];
  autoFixedCount: number;
  summary: string;
}

export type WebviewToExtensionMessage =
  | { command: 'generate'; prompt: string; model?: string; framework?: string }
  | { command: 'setApiKey'; apiKey: string }
  | { command: 'getApiKeyStatus' }
  | { command: 'clearApiKey' }
  | { command: 'runDevServer'; customCommand?: string }
  | { command: 'openFile'; filePath: string }
  | { command: 'scanAndFixErrors' }
  | { command: 'fixSingleError'; filePath: string; issueMessage: string };

export type ExtensionToWebviewMessage =
  | { type: 'apiKeyStatus'; hasKey: boolean; maskedKey?: string }
  | { type: 'generationStart'; prompt: string }
  | { type: 'generationProgress'; progress: GenerationProgress }
  | { type: 'fileCreated'; path: string; index: number; total: number }
  | { 
      type: 'generationSuccess'; 
      response: AIProjectResponse; 
      createdFiles: string[]; 
      verificationReport?: VerificationReport;
      verificationNotes?: string 
    }
  | { type: 'verificationComplete'; report: VerificationReport }
  | { type: 'errorFixed'; filePath: string; success: boolean; message: string }
  | { type: 'generationError'; error: string };
