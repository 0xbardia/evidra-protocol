export function shortHash(value: string, size = 8): string {
  if (!value) return '—';
  if (value.length <= size * 2 + 1) return value;
  return `${value.slice(0, size)}…${value.slice(-size)}`;
}

export function shortAddress(value: string): string {
  return shortHash(value, 5);
}

function timestampSeconds(value: unknown): number {
  if (typeof value === 'bigint') return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : Number.POSITIVE_INFINITY;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value) return 0;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds / 1000 : 0;
}

export function formatDate(value: unknown): string {
  const seconds = timestampSeconds(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Not recorded';
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) return 'Out of range';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date);
}

export function relativeDate(value: unknown): string {
  const seconds = timestampSeconds(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Not recorded';
  const delta = Math.round(seconds - Date.now() / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) if (Math.abs(delta) >= size) return formatter.format(Math.round(delta / size), unit);
  return formatter.format(delta, 'second');
}

export function formatTtl(value: unknown): string {
  let seconds: bigint;
  try {
    if (typeof value === 'bigint') seconds = value;
    else if (typeof value === 'number' && Number.isSafeInteger(value)) seconds = BigInt(value);
    else if (typeof value === 'string' && /^\d+$/.test(value)) seconds = BigInt(value);
    else return 'No expiry';
  } catch { return 'No expiry'; }
  if (seconds <= 0n) return 'No expiry';
  if (seconds % 86400n === 0n) {
    const days = seconds / 86400n;
    return `${days.toLocaleString()} ${days === 1n ? 'day' : 'days'}`;
  }
  if (seconds % 3600n === 0n) {
    const hours = seconds / 3600n;
    return `${hours.toLocaleString()} ${hours === 1n ? 'hour' : 'hours'}`;
  }
  return `${seconds.toLocaleString()} seconds`;
}

export function outcomeLabel(value: unknown): string {
  const text = String(value ?? 'UNKNOWN');
  return text === 'TRUE' ? 'Verified true' : text === 'FALSE' ? 'Verified false' : text === 'UNRESOLVED' ? 'Unresolved' : text;
}

export function outcomeTone(value: unknown): 'positive' | 'negative' | 'neutral' | 'warning' {
  const text = String(value ?? '');
  return text === 'TRUE' ? 'positive' : text === 'FALSE' ? 'negative' : text === 'UNRESOLVED' ? 'warning' : 'neutral';
}

export function activityLabel(value: unknown): string {
  const type = String(value ?? '');
  return type === 'request_created' ? 'Fact request created' : type === 'resolution_committed' ? 'Resolution committed' : 'Protocol activity';
}

export function activityDetail(item: { activity_type?: unknown; activity_id?: unknown; status?: unknown; outcome?: unknown }): string {
  const type = String(item.activity_type ?? '');
  if (type === 'request_created') return `Request #${String(item.activity_id ?? '—')} · ${protocolStatusLabel(item.status)}`;
  if (type === 'resolution_committed') return `Resolution #${String(item.activity_id ?? '—')} · ${outcomeLabel(item.outcome)}`;
  return 'Indexed protocol event';
}

export function protocolStatusLabel(value: unknown): string {
  const status = String(value ?? 'status unavailable').replaceAll('_', ' ').toLowerCase();
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function factStatement(request: Record<string, unknown>, fallback = 'Fact specification unavailable'): string {
  const subject = String(request.subject ?? '').replace(/\s+/g, ' ').trim();
  const predicate = String(request.predicate ?? '').replace(/\s+/g, ' ').trim();
  const objectValue = String(request.object_value ?? '').replace(/\s+/g, ' ').trim();
  if (subject || predicate) {
    const statement = [subject, predicate].filter(Boolean).join(' ');
    return objectValue && !predicate.toLowerCase().includes(objectValue.toLowerCase()) ? `${statement} ${objectValue}` : statement;
  }
  return String(request.description ?? '').replace(/\s+/g, ' ').trim() || fallback;
}

export function safeExternalUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch {
    return null;
  }
}
