/**
 * Framework Architecture Skill
 * Guides DeepSeek to output clean, well-factored, maintainable project architectures.
 */
export const FRAMEWORK_SKILL = `
=== FRAMEWORK & CODE ARCHITECTURE RULES ===

1. IF TECH STACK IS 'Modern HTML5 + Tailwind CSS + Vanilla JS':
- Perfect for instant zero-config setup that runs immediately without long npm install waits!
- Architecture:
  * index.html: Fully structured, semantic, loading Tailwind CDN (v3.4+), Google Fonts, and script.js.
  * css/style.css: Custom animations, keyframes, scrollbar styling, glassmorphism utilities.
  * js/app.js: Clean modern ES6+ code organizing modal logic, filter tabs, scroll listener, and toast messages.
- suggestedCommand: "npx serve ." or "npm install && npm run dev" (if package.json with dev server is provided).

2. IF TECH STACK IS 'Vite + React + TypeScript + Tailwind CSS':
- Architecture:
  * package.json: React 18/19, Vite, Tailwind CSS, Lucide-React, TypeScript dependencies.
  * vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js.
  * index.html: Clean entry point.
  * src/main.tsx & src/App.tsx: Main application layout.
  * src/components/: Modular, atomic components (e.g., Navbar.tsx, Hero.tsx, BentoGrid.tsx, BookingModal.tsx, Testimonials.tsx, Footer.tsx).
  * src/types/: TypeScript data interfaces.
- suggestedCommand: "npm install && npm run dev".

3. ZERO ERRORS & COMPLETE FILES:
- Ensure package.json has all necessary dependencies matching imports.
- Never import a library without declaring it in package.json.
- Always provide index.html as the primary web entry point.
`;
