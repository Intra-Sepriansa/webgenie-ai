import { ANTI_AI_SLOP_MANIFESTO } from './designSystemSkill';
import { INTERACTION_SKILL } from './interactionSkill';
import { FRAMEWORK_SKILL } from './frameworkSkill';

export interface SkillOptions {
  antiSlopEnabled?: boolean;
  interactionsEnabled?: boolean;
  frameworkEnabled?: boolean;
}

/**
 * Builds the comprehensive skills payload injected into DeepSeek AI.
 */
export function buildSkillsPrompt(options: SkillOptions = {}): string {
  const parts: string[] = [];

  if (options.antiSlopEnabled !== false) {
    parts.push(ANTI_AI_SLOP_MANIFESTO);
  }

  if (options.interactionsEnabled !== false) {
    parts.push(INTERACTION_SKILL);
  }

  if (options.frameworkEnabled !== false) {
    parts.push(FRAMEWORK_SKILL);
  }

  return parts.join('\n\n');
}
