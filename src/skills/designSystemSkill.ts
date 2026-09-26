/**
 * Anti-AI-Slop & Modern Web Design System Skill
 * Enforces production-grade, human-crafted aesthetics inspired by Linear, Vercel, Apple, and Stripe.
 */
export const ANTI_AI_SLOP_MANIFESTO = `
=== ANTI-AI-SLOP DESIGN MANIFESTO & SYSTEM RULES ===

CRITICAL RULE: DO NOT GENERATE GENERIC "AI SLOP"!
AI Slop is defined as:
- Saturated rainbow/purple-to-pink gradient text on every single heading.
- 3 identical, boring cards with the exact same height and generic icons.
- Meaningless corporate buzzwords like "Revolutionize your paradigm with cutting-edge next-gen solutions".
- Empty gray box placeholder images or broken image links.
- Massive muddy blurry shadows instead of crisp borders.
- Non-functional UI where clicking buttons does nothing.

YOU MUST ADHERE TO THESE WORLD-CLASS DESIGN PRINCIPLES:

1. TYPOGRAPHY & VISUAL HIERARCHY:
- Always import modern Google Fonts in the HTML <head> appropriate for the project:
  * Tech / Modern / SaaS: 'Plus Jakarta Sans', 'Inter', or 'Geist'
  * Luxury / Artisan / Barbershop / Hospitality: 'Playfair Display' or 'Cinzel' paired with 'Plus Jakarta Sans'
  * Creative / Studio / Agency: 'Syne' or 'Space Grotesk'
- Implement strict typographic scales:
  * Eyebrow Tag: text-xs font-semibold tracking-wider uppercase text-zinc-400
  * Section Title: text-3xl sm:text-5xl font-extrabold tracking-tight text-white
  * Body: text-sm sm:text-base text-zinc-400 leading-relaxed font-normal
- Never apply full-sentence gradient text. If using gradient text, limit it to 1-2 punchy highlight words only.

2. BENTO GRID & ASYMMETRIC LAYOUTS:
- Replace boring 3-card columns with dynamic, asymmetric BENTO GRIDS (grid-cols-1 md:grid-cols-3 or grid-cols-12).
- Example: 1 large featured card spanning 2 columns with an interactive visual preview + 2 stacked complementary cards.
- Give each card unique purpose: one with live metric indicators, one with an interactive feature toggle, one with rich media.

3. CRISP DEPTH, BORDERS & GLASSMORPHISM:
- Dark Mode base: Use deep slate/zinc backgrounds (bg-[#09090b] or bg-[#030712]), not washed-out dark gray.
- Cards: bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8.
- Subtle inner highlights: shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] to make cards look elevated like glass.
- Hover states: hover:border-zinc-700 transition-all duration-300 hover:-translate-y-1.

4. REAL HIGH-RES UNSPLASH PHOTOGRAPHY:
- NEVER use placeholder gray rectangles. Always use high-quality Unsplash URLs matching the theme:
  * Barbershop / Grooming:
    - Interior/Vibe: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80"
    - Haircut Cut & Style: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80"
    - Master Barber Portrait: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80"
    - Shaving/Detailing: "https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=800&q=80"
  * Tech / SaaS / Dashboard:
    - Minimal Desk Setup: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80"
    - Modern Abstract Code/Tech: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80"
    - Executive/Founder Avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
  * E-Commerce / Fashion:
    - Minimalist Luxury Product: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80"
    - Fashion Model: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=80"

5. CLEAN SVG ICONS (NO CHEESY EMOJIS):
- In the generated website, do NOT use random emojis as icons in feature lists.
- Write crisp, lightweight inline SVG icons (stroke-width="1.8" or "2", stroke-linecap="round", stroke-linejoin="round", stroke="currentColor").

6. AUTHENTIC, DOMAIN-SPECIFIC CONTENT:
- Write realistic names, prices, testimonials, and feature specs.
- For a barbershop: "The Executive Taper & Hot Towel (\$48)", "Beard Sculpt & Razor Finish (\$32)", "Booked with Master Barber Dave (12 yrs exp)".
- Include real customer testimonials with avatars, review star ratings, and verified badge.
`;
