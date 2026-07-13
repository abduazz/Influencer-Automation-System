import { Project, Integration, Report, BloggerSubmission, AllowedUser } from '../data/mockData';

// Fetch helper that handles errors
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let errMsg = res.statusText;
    try {
      const data = await res.json();
      errMsg = data.message || data.error || res.statusText;
    } catch {}
    throw new Error(errMsg);
  }

  if (res.status === 204) {
    return null as unknown as T;
  }

  return res.json();
}

// Projects API
export function fetchProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects');
}
export function createProject(name: string, description: string): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}
export function deleteProject(id: string): Promise<void> {
  return request<void>(`/api/projects/${id}`, { method: 'DELETE' });
}

// Integrations API
export function fetchIntegrations(): Promise<Integration[]> {
  return request<Integration[]>('/api/integrations');
}
export function createIntegration(data: Omit<Integration, 'id' | 'totalAmount' | 'paidAmount' | 'bloggerCabinetToken'>): Promise<Integration> {
  return request<Integration>('/api/integrations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
export function updateIntegration(id: string, data: Partial<Integration>): Promise<Integration> {
  return request<Integration>(`/api/integrations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
export function deleteIntegration(id: string): Promise<void> {
  return request<void>(`/api/integrations/${id}`, { method: 'DELETE' });
}

// Reports API
export function fetchReports(): Promise<Report[]> {
  return request<Report[]>('/api/reports');
}
export function createReport(data: Omit<Report, 'id' | 'totalAmount' | 'paidAmount' | 'projectName'>): Promise<Report> {
  return request<Report>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Submissions API
export function fetchSubmissions(): Promise<BloggerSubmission[]> {
  return request<BloggerSubmission[]>('/api/blogger-submissions');
}
export function createSubmission(integrationId: string, data: Record<string, string>, lang?: string): Promise<BloggerSubmission> {
  return request<BloggerSubmission>('/api/blogger-submissions', {
    method: 'POST',
    body: JSON.stringify({ integrationId, data, lang }),
  });
}

// Whitelisted Users API
export function fetchAllowedUsers(): Promise<AllowedUser[]> {
  return request<AllowedUser[]>('/api/allowed-users');
}
export function createAllowedUser(email: string, role: AllowedUser['role'], allowedMetrics?: string[]): Promise<AllowedUser> {
  return request<AllowedUser>('/api/allowed-users', {
    method: 'POST',
    body: JSON.stringify({ email, role, allowedMetrics }),
  });
}
export function deleteAllowedUser(id: string): Promise<void> {
  return request<void>(`/api/allowed-users/${id}`, { method: 'DELETE' });
}

export async function shortenUrl(longUrl: string): Promise<string> {
  try {
    const data = await request<{ short_url: string }>(`/api/shorten-url?url=${encodeURIComponent(longUrl)}`);
    return data.short_url;
  } catch (e) {
    console.error("Shorten API failed, fallback to original", e);
    return longUrl;
  }
}

// System Logs API
export interface LogEntry {
  timestamp: string;
  environment: string;
  level: string;
  message: string;
}

export function fetchLogs(): Promise<LogEntry[]> {
  return request<LogEntry[]>('/api/logs');
}

export function clearLogs(): Promise<void> {
  return request<void>('/api/logs', { method: 'DELETE' });
}
