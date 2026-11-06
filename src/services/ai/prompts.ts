/** Instruções enviadas ao modelo. Escritas em inglês (funcionam melhor em modelos pequenos); o idioma da resposta é definido à parte. */
export type Platform = 'generic' | 'facebook' | 'instagram' | 'pinterest' | 'tiktok' | 'youtube' | 'shopee';
export const PLATFORMS: { id: Platform; name: string; maxChars?: number; rule: string }[] = [
  { id: 'generic', name: '', rule: 'No specific platform; keep it concise.' },
  { id: 'facebook', name: 'Facebook', rule: 'Short post (ideally under 250 characters), conversational, 1-3 hashtags at most.' },
  { id: 'instagram', name: 'Instagram', maxChars: 2200, rule: 'Caption up to 2,200 characters; the first line must hook the reader; hashtags at the end (5-10, never more than 30).' },
  { id: 'pinterest', name: 'Pinterest', maxChars: 500, rule: 'Title up to 100 characters and description up to 500 characters; keyword-rich and descriptive.' },
  { id: 'tiktok', name: 'TikTok', maxChars: 2200, rule: 'Caption up to 2,200 characters but short and punchy; 3-5 hashtags.' },
  { id: 'youtube', name: 'YouTube Shorts', maxChars: 5000, rule: 'Title up to 100 characters; description up to 5,000 characters; include #Shorts.' },
  { id: 'shopee', name: 'Shopee Video', rule: 'Official text limits were not confirmed; keep it short (under about 150 characters) and avoid claims that cannot be verified.' },
];
export const STYLES = ['professional', 'casual', 'creative', 'persuasive', 'funny', 'promotional'] as const;
export type Style = (typeof STYLES)[number];
export const TASKS = ['caption', 'title', 'hashtags', 'cta', 'productDesc', 'promo', 'rewrite', 'variations', 'audience'] as const;
export type Task = (typeof TASKS)[number];
export const SHOPEE_TASKS = ['desc', 'caption', 'hashtags', 'cta', 'script', 'ideas', 'variations'] as const;
export type ShopeeTask = (typeof SHOPEE_TASKS)[number];
export const LANG_NAMES: Record<string, string> = { 'pt-BR': 'Brazilian Portuguese', en: 'English', es: 'Spanish' };

const STYLE_TEXT: Record<Style, string> = {
  professional: 'professional and trustworthy', casual: 'casual and friendly', creative: 'creative and original',
  persuasive: 'persuasive and benefit-oriented (without exaggeration)', funny: 'funny and light-hearted', promotional: 'promotional with a clear offer focus',
};
const GUARD = "Never invent prices, discounts, product features, statistics or benefits that are not in the user's text. If information is missing, keep the wording neutral. Reply ONLY with the requested content, without introductions or explanations.";

export const fluxSystem = (lang: string) =>
  `You are FLUX, a friendly assistant specialised in content creation and social media (Facebook, Instagram, Pinterest, TikTok, YouTube Shorts, Shopee Video). Give practical, concise answers. ${GUARD.split(' Reply ONLY')[0]} Answer in ${LANG_NAMES[lang] ?? 'English'}.`;

const TASK_TEXT: Record<Task, (n: number) => string> = {
  caption: () => 'Write a social media caption for the topic below.',
  title: () => 'Write 5 distinct title options for the topic below.',
  hashtags: () => 'Generate relevant hashtags for the topic below. Output only the hashtags separated by spaces.',
  cta: () => 'Write 5 short, distinct calls to action for the topic below.',
  productDesc: () => 'Write a product description using ONLY the facts provided below.',
  promo: () => 'Write a promotional text using ONLY the facts provided below.',
  rewrite: () => 'Rewrite the text below keeping its meaning and facts, improving clarity and engagement.',
  variations: (n) => `Write ${n} clearly different numbered versions of the post for the topic or text below.`,
  audience: () => 'Adapt the text below for the target audience, keeping the facts unchanged.',
};
export function buildGeneral(o: { task: Task; style: Style; platform: Platform; lang: string; text: string; audience: string; count: number }) {
  const p = PLATFORMS.find((x) => x.id === o.platform)!;
  const system = `You are FLUX, an expert social media copywriter. ${GUARD} Write in ${LANG_NAMES[o.lang] ?? 'English'}.`;
  const user = `${TASK_TEXT[o.task](o.count)}\nStyle: ${STYLE_TEXT[o.style]}.\nPlatform: ${p.name || 'generic'}. Rules: ${p.rule}${o.audience.trim() ? `\nTarget audience: ${o.audience.trim()}` : ''}\n\nText/topic:\n${o.text.trim()}`;
  return { system, user };
}
const SHOPEE_TEXT: Record<ShopeeTask, (n: number) => string> = {
  desc: () => 'Write a clear product description for a Shopee listing.',
  caption: () => 'Write a promotional caption for a Shopee Video post.',
  hashtags: () => 'Generate relevant hashtags for this product. Output only the hashtags separated by spaces.',
  cta: () => 'Write 5 short, distinct calls to action for this product.',
  script: () => 'Write a short vertical sales-video script (15-30 seconds) with numbered scenes: hook, product demonstration, call to action.',
  ideas: () => 'Suggest 5 different sales video ideas for this product, one line each.',
  variations: (n) => `Write ${n} clearly different numbered versions of a promotional text for this product.`,
};
export function buildShopee(o: { task: ShopeeTask; style: Style; lang: string; name: string; details: string; count: number }) {
  const system = `You are FLUX, an expert in Shopee product content. Use ONLY the product facts provided. Never invent prices, discounts, specifications or benefits. If a detail is missing, do not mention it. Reply ONLY with the requested content. Write in ${LANG_NAMES[o.lang] ?? 'English'}.`;
  const user = `${SHOPEE_TEXT[o.task](o.count)}\nStyle: ${STYLE_TEXT[o.style]}.\n\nProduct name: ${o.name.trim()}\nProduct facts:\n${o.details.trim() || '(none provided)'}`;
  return { system, user };
}
export const ANALYSIS_PROMPTS = {
  describe: 'Describe what you see in the image(s) in detail: scene, colors, mood and composition.',
  products: 'List the objects and products visible. For each, say what it is and relevant visible characteristics. Do not guess brands or details you cannot see.',
  ideas: 'Based on what you see, suggest 5 social media post ideas.',
  captions: 'Based on what you see, write 3 short social media captions with hashtags. Do not invent prices or product features that are not visible.',
} as const;
export type AnalysisTask = keyof typeof ANALYSIS_PROMPTS;
