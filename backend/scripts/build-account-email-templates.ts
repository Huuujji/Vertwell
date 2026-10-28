import { readFile, writeFile } from 'node:fs/promises';

// Supabase administration files are excluded from deployment. Embed only these
// two reviewed bodies in a normal runtime module; no runtime filesystem lookup.
const templates: Record<string, { subject: string; html: string }> = {};
for (const [purpose, file, subject] of [
  ['verification', 'confirmation.html', 'HappyHentie — Verify your account email'],
  ['recovery', 'recovery.html', 'HappyHentie — Recover your password'],
] as const) {
  const html = (await readFile(new URL(`../supabase/templates/${file}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const variables = [...html.matchAll(/{{\s*\.(\w+)\s*}}/g)].map(match => match[1]).sort();
  if (variables.join(',') !== 'ChallengeLink,SiteURL,Token' || !html.includes(`<title>${subject}</title>`) ||
      html.replace(/{{\s*\.(ChallengeLink|SiteURL|Token)\s*}}/g, '').includes('{{')) {
    throw new Error('Account email template does not match the reviewed contract.');
  }
  templates[purpose] = { subject, html };
}
const output = '// Generated from backend/supabase/templates by npm run email:templates. Do not edit.\n' +
  `export const accountEmailTemplates = ${JSON.stringify(templates, null, 2)} as const;\n`;
const target = new URL('../src/lib/account-email-templates.generated.ts', import.meta.url);
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Only --check is supported.');
if (args[0] === '--check') {
  if ((await readFile(target, 'utf8')).replace(/\r\n/g, '\n') !== output) throw new Error('Account email templates are stale. Run npm run email:templates.');
  console.log('Account email template bundle matches both reviewed bodies.');
} else {
  await writeFile(target, output, 'utf8');
  console.log('Bundled both reviewed account email bodies.');
}
