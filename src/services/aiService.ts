import OpenAI from 'openai';
import { AIProjectResponse } from '../types';
import { buildSkillsPrompt, SkillOptions } from '../skills';

export class AIService {
  private apiKey: string;
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('DeepSeek API Key is missing. Please set your API key first.');
    }
    this.apiKey = apiKey.trim();
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: 'https://api.deepseek.com'
    });
  }

  /**
   * Generates a complete project architecture and file tree based on user description,
   * infused with Anti-AI-Slop and high-end design engineering skills.
   */
  public async generateProject(
    prompt: string,
    model: string = 'deepseek-chat',
    frameworkPreference?: string,
    skillOptions?: SkillOptions
  ): Promise<AIProjectResponse> {
    const skillsInstructions = buildSkillsPrompt(skillOptions);

    const systemPrompt = `You are WebGenie AI, a Principal Design Technologist and Lead Full-Stack Architect.
Your mission is to craft jaw-dropping, production-grade, human-level web applications directly into the user's workspace.
You actively reject generic "AI slop" and deliver bespoke, high-craft digital experiences inspired by Linear, Apple, Vercel, and Stripe.

${skillsInstructions}

CRITICAL OUTPUT INSTRUCTIONS:
1. Output MUST be a strictly valid JSON object matching the exact schema specified below.
2. NEVER return conversational text, apologies, markdown commentary, or backticks outside the JSON. Return raw valid JSON.
3. Every file must contain COMPLETE, PRODUCTION-READY CODE. Absolutely NO placeholders, NO '// TODO', and NO truncated snippets.
4. Include all necessary config files (e.g., package.json, index.html, vite.config.ts, tsconfig.json, CSS/Tailwind configs, README.md, etc.) so that running the suggestedCommand immediately works without missing dependencies.
5. Provide a concise, executable terminal command in "suggestedCommand" (e.g., "npm install && npm run dev" or "npx serve .").

JSON OUTPUT SCHEMA:
{
  "projectName": "kebab-case-project-name",
  "description": "Concise summary of what this application does",
  "summary": "Bullet points of key features, architecture, and design highlights",
  "suggestedCommand": "npm install && npm run dev",
  "files": [
    {
      "path": "relative/file/path.ext",
      "content": "Complete full code content as a valid JSON string with escaped newlines and quotes."
    }
  ]
}

Framework Preference: ${frameworkPreference || 'Choose the best modern web stack (e.g. Modern HTML5 + Tailwind + Vanilla JS or Vite + React + TS) suitable for the user prompt.'}`;

    const userMessage = `Create a complete, bespoke, anti-ai-slop web application based on this prompt:
"${prompt}"

Remember:
- Apply the Anti-AI-Slop Manifesto (asymmetric Bento Grid, curated Unsplash photos, clean typography hierarchy, crisp 1px borders, functioning modals & micro-interactions).
- Respond ONLY with a valid JSON object containing all required files and runnable commands.`;

    try {
      const response = await this.client.chat.completions.create({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        // DeepSeek JSON Mode requires the word "json" in the prompt
        response_format: model === 'deepseek-reasoner' ? undefined : { type: 'json_object' },
        temperature: 0.2
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        throw new Error('Received an empty response from DeepSeek API.');
      }

      return this.parseAndValidateResponse(rawContent);
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
   * Resilient JSON parser that handles markdown code blocks or surrounding text.
   */
  private parseAndValidateResponse(raw: string): AIProjectResponse {
    let clean = raw.trim();

    // Remove markdown code fences if model enclosed JSON in ```json ... ```
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    // Extract the outermost JSON object if there is surrounding commentary
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (parseError: any) {
      try {
        const sanitized = clean.replace(/[\u0000-\u001F]+/g, (match) => {
          if (match === '\n') return '\\n';
          if (match === '\r') return '\\r';
          if (match === '\t') return '\\t';
          return '';
        });
        parsed = JSON.parse(sanitized);
      } catch {
        throw new Error(
          `Failed to parse DeepSeek response as JSON. Parser output: ${parseError.message}\n\nSnippet:\n${clean.substring(0, 300)}...`
        );
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('AI output is not a valid JSON object.');
    }

    if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
      throw new Error('AI response did not contain any files in "files" array.');
    }

    for (const f of parsed.files) {
      if (!f.path || typeof f.content !== 'string') {
        throw new Error(`Invalid file entry generated by AI: ${JSON.stringify(f)}`);
      }
    }

    return {
      projectName: parsed.projectName || 'webgenie-project',
      description: parsed.description || 'Generated by WebGenie AI',
      summary: parsed.summary || 'Project generated successfully with Anti-AI-Slop skills',
      suggestedCommand: parsed.suggestedCommand || 'npm install && npm run dev',
      files: parsed.files
    };
  }
}
