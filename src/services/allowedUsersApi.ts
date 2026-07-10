import { AllowedUser } from '../data/mockData';

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function fetchAllowedUsers(): Promise<AllowedUser[]> {
  const res = await fetch('/api/allowed-users');
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json();
}

export async function addAllowedUser(
  email: string,
  role: AllowedUser['role']
): Promise<AllowedUser> {
  const res = await fetch('/api/allowed-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json();
}

export async function removeAllowedUser(id: string): Promise<void> {
  const res = await fetch(`/api/allowed-users/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}
