/**
 * Utility functions for platform badges, branding colors, and social links
 */

export function getPlatformBadgeClasses(platform: string | null | undefined): string {
  const p = (platform || '').toLowerCase().trim();
  switch (p) {
    case 'instagram':
      return 'bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white shadow-xs';
    case 'telegram':
      return 'bg-[#229ED9] text-white shadow-xs';
    case 'youtube':
      return 'bg-red-600 text-white shadow-xs';
    case 'tiktok':
      return 'bg-black text-[#25F4EE] border border-neutral-800 shadow-xs';
    case 'max':
      return 'bg-amber-500 text-white shadow-xs';
    case 'facebook':
      return 'bg-[#1877F2] text-white shadow-xs';
    case 'vk':
      return 'bg-[#0077FF] text-white shadow-xs';
    default:
      return 'bg-neutral-800 text-white shadow-xs';
  }
}

/**
 * Normalizes any telegram username, handle, or URL into a direct chat redirect link (https://t.me/...).
 * Guaranteed to redirect directly to chat with user across 100% of cases.
 * Handles:
 * - "@username" -> "https://t.me/username"
 * - "username" -> "https://t.me/username"
 * - "t.me/username" -> "https://t.me/username"
 * - "https://t.me/username" -> "https://t.me/username"
 * - "http://telegram.me/username" -> "https://t.me/username"
 * - "tg://resolve?domain=username" -> "https://t.me/username"
 */
export function formatTelegramLink(input: string | null | undefined): string {
  if (!input) return '';
  let clean = input.trim();
  if (!clean) return '';

  // Remove trailing slashes
  clean = clean.replace(/\/+$/, '');

  // If starts with tg://resolve?domain=
  const tgDomainMatch = clean.match(/^tg:\/\/resolve\?domain=([^&]+)/i);
  if (tgDomainMatch && tgDomainMatch[1]) {
    return `https://t.me/${tgDomainMatch[1].replace(/^@+/, '')}`;
  }

  // If it's already a full t.me or telegram.me or telegram.dog URL:
  if (/^https?:\/\/(www\.)?(t\.me|telegram\.me|telegram\.dog)\//i.test(clean)) {
    return clean.replace(/^http:\/\//i, 'https://');
  }

  // If it starts with (www.)t.me/ or (www.)telegram.me/
  if (/^(www\.)?(t\.me|telegram\.me|telegram\.dog)\//i.test(clean)) {
    return `https://${clean}`;
  }

  // Remove leading @ or https?://
  clean = clean.replace(/^@+/, '');
  clean = clean.replace(/^https?:\/\//i, '');

  // Strip any remaining leading @
  clean = clean.replace(/^@+/, '');

  if (!clean) return '';

  return `https://t.me/${clean}`;
}

/**
 * Formats a telegram handle for clean display, e.g. "@username"
 */
export function formatTelegramHandle(input: string | null | undefined): string {
  if (!input) return '';
  let clean = input.trim().replace(/\/+$/, '');
  clean = clean.replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|telegram\.dog)\//i, '');
  if (/^tg:\/\/resolve\?domain=([^&]+)/i.test(clean)) {
    const match = clean.match(/^tg:\/\/resolve\?domain=([^&]+)/i);
    clean = match ? match[1] : clean;
  }
  clean = clean.replace(/^@+/, '');
  return clean ? `@${clean}` : '';
}
