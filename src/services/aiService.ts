import OpenAI from 'openai';
import { jsonrepair } from 'jsonrepair';
import { AIProjectResponse, GeneratedFile } from '../types';
import { buildSkillsPrompt, SkillOptions } from '../skills';

export class AIService {
  private apiKey: string;
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('DeepSeek API Key is missing. Please set your API key in settings.');
    }
    this.apiKey = apiKey.trim();
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: 'https://api.deepseek.com'
    });
  }

  /**
   * Generates a complete project with real-time streaming and token-saving optimization.
   */
  public async generateProject(
    prompt: string,
    model: string = 'deepseek-chat',
    frameworkPreference?: string,
    skillOptions?: SkillOptions,
    onStreamChunk?: (streamedLength: number, activeFile?: string) => void
  ): Promise<AIProjectResponse> {
    const trimmedPrompt = prompt.trim();
    const isShortQuery = trimmedPrompt.length < 25;

    // Dynamically adjust token limits to save cost and maximize speed
    const maxTokens = isShortQuery ? 2048 : 5120;

    const skillsInstructions = buildSkillsPrompt(skillOptions);

    const systemPrompt = `You are WebGenie AI, a Principal Full-Stack Engineer and UI Architect.
Reject AI slop. Craft bespoke, production-ready, clean web apps directly into workspace files.

${skillsInstructions}

FORMAT:
Output each file inside <file path="...">...</file> tags. Write raw, complete code inside the tags.
Include:
<project_name>project-name</project_name>
<description>Short description</description>
<command>executable command</command>

<file path="index.html">
... code ...
</file>

ADVANCED DESIGN & FULL COMPLETENESS RULES:
1. ADVANCED VISUAL CRAFT (CRITICAL):
   - Reject plain, raw, amateur HTML. The website MUST look stunning, high-craft, and production-ready.
   - Include dark mode / luxury monochrome palettes, elevated stat cards, progress bars, status pills, and clean typography ('Plus Jakarta Sans').
   - If using custom CSS classes (like .stat-card, .panel, .bar-row, etc.), ALWAYS embed the complete CSS directly inside <style> tags in the header or generate the complete style.css so that NO CSS FILE IS EVER 404 OR MISSING!
2. COMPLETE WORKING PAGES:
   - Generate all necessary pages requested (e.g. dashboard, data list, forms, auth).
   - In PHP + MySQL projects, always use the Smart Dual-Engine database in koneksi.php (TCP 127.0.0.1 + SQLite auto-fallback) so it runs instantly on localhost:8000.
3. If the user prompt is a casual greeting or test ("bro", "halo", "tes"), generate a sleek single-file web app (index.html) with a greeting hero "Halo Bro! WebGenie Siap Coding Web Kamu", live demo interactive widgets, and contact modal.
4. Strictly honor requested tech stack: PHP Native + MySQL, Python, Node, React, or HTML.
Framework: ${frameworkPreference || 'Auto'}`;

    const userMessage = `Create web application for: "${trimmedPrompt}". Output using <file path="..."> tags.`;

    try {
      const stream = await this.client.chat.completions.create({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
        stream: true
      });

      let rawContent = '';
      let currentFile = '';
      let lastReportTime = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        rawContent += delta;

        const fileMatches = [...rawContent.matchAll(/<file\s+path=["']([^"']+)["']>/gi)];
        if (fileMatches.length > 0) {
          currentFile = fileMatches[fileMatches.length - 1][1];
        }

        const now = Date.now();
        if (onStreamChunk && now - lastReportTime > 80) {
          lastReportTime = now;
          onStreamChunk(rawContent.length, currentFile);
        }
      }

      if (!rawContent || rawContent.trim() === '') {
        throw new Error('Received an empty response from DeepSeek API.');
      }

      return this.parseAndExtractFiles(rawContent);
    } catch (error: any) {
      if (error?.status === 401) {
        throw new Error('Invalid DeepSeek API Key. Please verify your key in WebGenie settings.');
      } else if (error?.status === 429) {
        throw new Error('DeepSeek API rate limit reached or insufficient quota. Please check your account balance.');
      }
      throw new Error(`DeepSeek API Error: ${error?.message || error}`);
    }
  }

  /**
   * Resilient extractor that parses <file path="..."> tags, markdown code blocks, or JSON.
   */
  private parseAndExtractFiles(raw: string): AIProjectResponse {
    const files: GeneratedFile[] = [];

    // 1. Tag-based extraction: <file path="...">...</file>
    const fileTagRegex = /<file\s+path=["']([^"']+)["']>([\s\S]*?)(?:<\/file>|(?=<file\s+path=)|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = fileTagRegex.exec(raw)) !== null) {
      const filePath = match[1].trim();
      let content = match[2];
      content = content.replace(/^\r?\n/, '').replace(/\r?\n$/, '');

      if (content.startsWith('```')) {
        content = content.replace(/^```[a-zA-Z0-9_-]*\r?\n/, '').replace(/\r?\n```$/, '');
      }

      if (filePath && content.length > 0) {
        files.push({
          path: filePath,
          content: content
        });
      }
    }

    // 2. Fallback: Markdown header format
    if (files.length === 0) {
      const mdFileRegex = /(?:###|##|\*\*)\s*(?:FILE|File):\s*`?([^\n`]+)`?\s*\n```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```/gi;
      while ((match = mdFileRegex.exec(raw)) !== null) {
        const filePath = match[1].trim();
        const content = match[2];
        if (filePath && content.length > 0) {
          files.push({
            path: filePath,
            content: content
          });
        }
      }
    }

    // 3. Fallback: JSON format
    if (files.length === 0) {
      let clean = raw.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }

      try {
        let parsed: any;
        try {
          parsed = JSON.parse(clean);
        } catch {
          const repaired = jsonrepair(clean);
          parsed = JSON.parse(repaired);
        }

        if (parsed && Array.isArray(parsed.files)) {
          for (const f of parsed.files) {
            if (f && typeof f.path === 'string' && typeof f.content === 'string') {
              files.push({ path: f.path.trim(), content: f.content });
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    if (files.length === 0) {
      throw new Error(
        `Could not extract project files from DeepSeek response.\nSnippet:\n${raw.substring(0, 300)}...`
      );
    }

    const projMatch = raw.match(/<project_name>([\s\S]*?)<\/project_name>/i);
    const descMatch = raw.match(/<description>([\s\S]*?)<\/description>/i);
    const cmdMatch = raw.match(/<command>([\s\S]*?)<\/command>/i);

    const projectName = projMatch ? projMatch[1].trim() : 'webgenie-project';
    const description = descMatch ? descMatch[1].trim() : 'Generated by WebGenie AI';
    const suggestedCommand = cmdMatch ? cmdMatch[1].trim() : 'npm install && npm run dev';

    return {
      projectName,
      description,
      summary: `Created ${files.length} production-ready files with Anti-AI-Slop design engineering.`,
      suggestedCommand,
      files
    };
  }

  /**
   * Autonomous code repair: fixes a syntax or runtime error in a file using DeepSeek.
   */
  public async fixFileError(
    filePath: string,
    fileContent: string,
    errorMessage: string
  ): Promise<string> {
    const prompt = `Fix the syntax error in the following file:
File: ${filePath}
Error: ${errorMessage}

Original content:
${fileContent}

Return ONLY the completely fixed code inside:
<file path="${filePath}">
...fixed code...
</file>`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You are an autonomous code repair agent. Fix syntax errors precisely without changing functionality. Output only <file path="...">fixed code</file>.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 3072
      });

      const raw = response.choices[0]?.message?.content || '';
      const match = raw.match(/<file\s+path=["'][^"']+["']>([\s\S]*?)<\/file>/i);
      if (match) {
        let fixed = match[1].replace(/^\r?\n/, '').replace(/\r?\n$/, '');
        if (fixed.startsWith('```')) {
          fixed = fixed.replace(/^```[a-zA-Z0-9_-]*\r?\n/, '').replace(/\r?\n```$/, '');
        }
        return fixed;
      }
      return fileContent;
    } catch {
      return fileContent;
    }
  }
}

