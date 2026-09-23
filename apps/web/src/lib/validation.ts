// eslint-disable-next-line no-control-regex
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007f]/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export interface UrlValidation {
  valid: boolean;
  message?: string;
}

export function validateEvidenceUrl(input: string): UrlValidation {
  if (!input || input.length > 2048) return { valid: false, message: 'Enter a URL under 2048 characters.' };
  if (CONTROL_OR_SPACE.test(input)) return { valid: false, message: 'Whitespace and control characters are not allowed.' };
  let parsed: URL;
  try { parsed = new URL(input); } catch { return { valid: false, message: 'Enter a complete HTTPS URL.' }; }
  if (parsed.protocol !== 'https:') return { valid: false, message: 'Evidence sources must use HTTPS.' };
  if (parsed.username || parsed.password) return { valid: false, message: 'Credentials in evidence URLs are not allowed.' };
  if (parsed.hash) return { valid: false, message: 'Fragments are not part of an evidence source.' };
  if (!parsed.hostname || parsed.hostname.startsWith('[') || parsed.hostname.includes(':')) return { valid: false, message: 'IP-literal hosts are not allowed.' };
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return { valid: false, message: 'Localhost hosts are not allowed.' };
  if (hostname.length > 253 || hostname.split('.').some((label) => !LABEL.test(label))) return { valid: false, message: 'Use a normal DNS hostname.' };
  if (/^\d+(?:\.\d+){0,3}$/.test(hostname) || /^[0-9a-f]+$/i.test(hostname)) return { valid: false, message: 'Direct IP-literal hosts are not allowed.' };
  const authority = input.slice(input.indexOf('//') + 2).split(/[/?#]/, 1)[0] ?? '';
  const portMatch = authority.match(/:(\d+)$/);
  if (authority.includes(':') && !portMatch) return { valid: false, message: 'The URL authority is malformed.' };
  if (portMatch && portMatch[1] !== '443') return { valid: false, message: 'Only the implicit HTTPS port or explicit port 443 is allowed.' };
  return { valid: true };
}

export function parseStringArray(value: string, max = 8): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length > max || parsed.some((item) => typeof item !== 'string')) throw new Error(`Enter at most ${max} URLs.`);
  return parsed;
}

export function validateUrlList(urls: string[], max: number): string | null {
  if (urls.length > max) return `Use no more than ${max} sources.`;
  for (const url of urls) {
    const result = validateEvidenceUrl(url);
    if (!result.valid) return result.message ?? 'Invalid source URL.';
  }
  return null;
}

const TEMPLATE_FIELD_LABELS: Record<string, string> = {
  description: 'description',
  mutability: 'freshness mode',
  object_value: 'object / value',
  predicate: 'predicate',
  qualifiers: 'qualifiers',
  subject: 'subject',
  temporal: 'temporal constraint',
};

export function templateMutabilityRule(factType: string): 'IMMUTABLE' | 'MUTABLE_WITH_TTL' | null {
  const normalized = factType.toLowerCase();
  if (normalized.includes('immutable')) return 'IMMUTABLE';
  if (normalized.includes('ttl') || normalized.includes('mutable')) return 'MUTABLE_WITH_TTL';
  return null;
}

export function templateMutabilityLabel(factType: string): string {
  const rule = templateMutabilityRule(factType);
  return rule === 'IMMUTABLE' ? 'Immutable facts' : rule === 'MUTABLE_WITH_TTL' ? 'Mutable facts with TTL' : 'Any freshness mode';
}

export function templateRequiredFieldsLabel(requiredFields: string): string {
  return requiredFields.split(',').map((field) => field.trim()).filter(Boolean).map((field) => TEMPLATE_FIELD_LABELS[field] ?? field.replaceAll('_', ' ')).join(', ') || 'none';
}

export function validateTemplateRequiredFields(requiredFields: string, values: Record<string, string>): string | null {
  const fields = requiredFields.split(',').map((field) => field.trim()).filter(Boolean);
  if (fields.some((field) => !Object.prototype.hasOwnProperty.call(TEMPLATE_FIELD_LABELS, field))) {
    return 'This template has required fields the form cannot collect. Choose another template or a custom fact.';
  }
  const missing = fields.filter((field) => !values[field]?.trim());
  return missing.length ? `This template requires ${missing.map((field) => TEMPLATE_FIELD_LABELS[field]).join(', ')}. Add them in Define the fact.` : null;
}
