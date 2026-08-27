export function getCabinetUrl(token?: string | null): string {
  if (!token) return '';

  const envDomain = import.meta.env.VITE_CABINET_DOMAIN;
  if (envDomain) {
    const origin = envDomain.startsWith('http') ? envDomain : `https://${envDomain}`;
    return `${origin.replace(/\/$/, '')}/c/${token}`;
  }

  if (typeof window !== 'undefined' && window.location.hostname.includes('tezi.uz')) {
    return `${window.location.origin}/c/${token}`;
  }

  return `https://tezi.uz/c/${token}`;
}
