import { Project, Integration, Report, BloggerSubmission, AllowedUser, BulkPurchase, KanbanColumn, BloggerRequisites, ChatMessage, ChatResponse } from '../data/mockData';

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
    let errMsg = '';
    try {
      const data = await res.json();
      if (data.errors && typeof data.errors === 'object') {
        const errorList = Object.values(data.errors).flat().join(' ');
        errMsg = errorList || data.message || data.error || res.statusText || 'Validation Failed';
      } else {
        errMsg = data.message || data.error || res.statusText || 'Unknown Server Error';
      }
    } catch {
      errMsg = res.statusText || `Server Error (Status ${res.status})`;
    }
    throw new Error(errMsg);
  }

  if (res.status === 204) {
    return null as unknown as T;
  }

  return res.json();
}

// Bootstrap API (loads all initial core data in a single ultra-fast HTTP request)
export interface BootstrapData {
  users: AllowedUser[];
  projects: Project[];
  integrations: Integration[];
  reports: Report[];
  submissions: BloggerSubmission[];
  bulkPurchases: BulkPurchase[];
  kanbanColumns: KanbanColumn[];
  bloggerRequisites: BloggerRequisites[];
}

const BOOTSTRAP_CACHE_KEY = 'tezi_bootstrap_cache_v1';

export function getInitialBootstrapData(): Partial<BootstrapData> | null {
  if (typeof window === 'undefined') return null;

  // 1. First priority: Server-inlined script tag (rendered in initial HTML, 0 network latency)
  try {
    const serverScript = document.getElementById('server-bootstrap-data');
    if (serverScript && serverScript.textContent) {
      const data = JSON.parse(serverScript.textContent);
      if (data && typeof data === 'object') {
        try {
          localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch (err) {
    console.warn('Failed to parse server bootstrap data', err);
  }

  // 2. Second priority: LocalStorage cache (instant hydration on subsequent visits/reloads)
  try {
    const cached = localStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (data && typeof data === 'object') {
        return data;
      }
    }
  } catch (err) {
    console.warn('Failed to parse local bootstrap cache', err);
  }

  return null;
}

export function saveBootstrapCache(data: BootstrapData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to write bootstrap cache', err);
  }
}

export function clearBootstrapCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(BOOTSTRAP_CACHE_KEY);
  } catch {}
}

export function fetchBootstrapData(): Promise<BootstrapData> {
  return request<BootstrapData>('/api/bootstrap');
}

// Projects API
export function fetchProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects');
}
export function createProject(name: string, description: string, telegramThreadId?: string, monthlyLimit?: number | null): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description, telegramThreadId, monthlyLimit }),
  });
}
export function updateProject(id: string, name: string, description: string, telegramThreadId?: string, monthlyLimit?: number | null, userEmail?: string): Promise<Project> {
  const headers = userEmail ? { 'X-User-Email': userEmail } : undefined;
  return request<Project>(`/api/projects/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name, description, telegramThreadId, monthlyLimit }),
  });
}
export function deleteProject(id: string, userEmail?: string): Promise<void> {
  const headers = userEmail ? { 'X-User-Email': userEmail } : undefined;
  return request<void>(`/api/projects/${id}`, { method: 'DELETE', headers });
}

// Integrations API
export function fetchIntegrations(): Promise<Integration[]> {
  return request<Integration[]>('/api/integrations');
}
export function createIntegration(
  data: Omit<Integration, 'id' | 'totalAmount' | 'paidAmount' | 'bloggerCabinetToken'>,
  userEmail?: string
): Promise<Integration> {
  const headers = userEmail ? { 'X-User-Email': userEmail } : undefined;
  return request<Integration>('/api/integrations', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}
export function updateIntegration(
  id: string,
  data: Partial<Integration>,
  userEmail?: string
): Promise<Integration> {
  const headers = userEmail ? { 'X-User-Email': userEmail } : undefined;
  return request<Integration>(`/api/integrations/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
}
export function deleteIntegration(id: string): Promise<void> {
  return request<void>(`/api/integrations/${id}`, { method: 'DELETE' });
}

export function refreshIntegrationSubscribers(id: string): Promise<{ success: boolean; message: string; integration: Integration }> {
  return request<{ success: boolean; message: string; integration: Integration }>(`/api/integrations/${id}/refresh-subscribers`, {
    method: 'POST',
  });
}

export function addIntegrationSubscriberHistory(
  id: string,
  data: { date: string; count: number; note?: string }
): Promise<{ success: boolean; integration: Integration }> {
  return request<{ success: boolean; integration: Integration }>(`/api/integrations/${id}/subscribers-history`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Kanban Columns API
export function fetchKanbanColumns(): Promise<KanbanColumn[]> {
  return request<KanbanColumn[]>('/api/kanban-columns');
}
export function saveKanbanColumns(columns: KanbanColumn[]): Promise<KanbanColumn[]> {
  return request<KanbanColumn[]>('/api/kanban-columns', {
    method: 'POST',
    body: JSON.stringify({ columns }),
  });
}
export function clearKanbanStageApi(stage: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/api/kanban-columns/clear-stage', {
    method: 'POST',
    body: JSON.stringify({ stage }),
  });
}

// Reports API
export function fetchReports(): Promise<Report[]> {
  return request<Report[]>('/api/reports');
}
export function createReport(data: Omit<Report, 'id' | 'totalAmount' | 'paidAmount' | 'projectName'>, userEmail?: string): Promise<Report> {
  const headers = userEmail ? { 'X-User-Email': userEmail } : undefined;
  return request<Report>('/api/reports', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}
export function updateReport(
  id: string,
  data: Partial<Report> & { amount?: number },
  userEmail?: string
): Promise<Report> {
  const headers = userEmail ? { 'X-User-Email': userEmail } : undefined;
  return request<Report>(`/api/reports/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
}
export function deleteReport(id: string): Promise<void> {
  return request<void>(`/api/reports/${id}`, { method: 'DELETE' });
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

// Whitelisted Users & Auth API
export function loginApi(login: string, password: string): Promise<AllowedUser> {
  return request<AllowedUser>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  });
}
export function fetchAllowedUsers(): Promise<AllowedUser[]> {
  return request<AllowedUser[]>('/api/allowed-users');
}
export function createAllowedUser(name: string, email: string, role: AllowedUser['role'], allowedMetrics?: string[], allowedPages?: string[], allowedProjects?: string[], password?: string): Promise<AllowedUser> {
  return request<AllowedUser>('/api/allowed-users', {
    method: 'POST',
    body: JSON.stringify({ name, email, role, allowedMetrics, allowedPages, allowedProjects, password }),
  });
}
export function deleteAllowedUser(id: string): Promise<void> {
  return request<void>(`/api/allowed-users/${id}`, { method: 'DELETE' });
}
export function updateAllowedUser(id: string, name: string, role: AllowedUser['role'], allowedMetrics?: string[], allowedPages?: string[], allowedProjects?: string[]): Promise<AllowedUser> {
  return request<AllowedUser>(`/api/allowed-users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, role, allowedMetrics, allowedPages, allowedProjects }),
  });
}
export function updateUserPassword(id: string, password: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/allowed-users/${id}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });
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

// Bulk Purchases API
export function fetchBulkPurchases(): Promise<BulkPurchase[]> {
  return request<BulkPurchase[]>('/api/bulk-purchases');
}
export function createBulkPurchase(data: {
  bloggerName: string;
  platform: string;
  totalSlots: number;
  pricePerSlot: number;
  paidAmount?: number;
  purchaseDate: string;
  referralLink?: string;
  receipt?: string | null;
  comments?: string;
}, userEmail?: string): Promise<BulkPurchase> {
  const headers = userEmail ? { 'X-User-Email': userEmail } : undefined;
  return request<BulkPurchase>('/api/bulk-purchases', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}
export function allocateBulkPurchaseSlots(bulkPurchaseId: string, projectId: string, slotsCount: number): Promise<BulkPurchase> {
  return request<BulkPurchase>(`/api/bulk-purchases/${bulkPurchaseId}/allocate`, {
    method: 'POST',
    body: JSON.stringify({ projectId, slotsCount }),
  });
}
export function deleteBulkPurchase(id: string): Promise<void> {
  return request<void>(`/api/bulk-purchases/${id}`, { method: 'DELETE' });
}

// Blogger Requisites API
export function fetchBloggerRequisites(): Promise<BloggerRequisites[]> {
  return request<BloggerRequisites[]>('/api/blogger-requisites');
}

export function submitBloggerRequisites(data: {
  integrationId: string;
  [key: string]: any;
}): Promise<{ success: boolean; message: string; integration: Integration; requisites: BloggerRequisites }> {
  return request<{ success: boolean; message: string; integration: Integration; requisites: BloggerRequisites }>('/api/blogger-requisites', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Telegram Live Chat API
export function fetchChatMessages(integrationId: string, sinceId?: string): Promise<ChatResponse> {
  const url = sinceId ? `/api/integrations/${integrationId}/messages?since_id=${encodeURIComponent(sinceId)}` : `/api/integrations/${integrationId}/messages`;
  return request<ChatResponse>(url);
}

export function sendChatMessage(integrationId: string, text: string, senderName?: string): Promise<{
  message: ChatMessage;
  delivered: boolean;
  hasChatId: boolean;
  telegramError?: string | null;
  chatUrl: string;
}> {
  return request<{
    message: ChatMessage;
    delivered: boolean;
    hasChatId: boolean;
    telegramError?: string | null;
    chatUrl: string;
  }>(`/api/integrations/${integrationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text, senderName }),
  });
}

export function updateIntegrationChatSettings(
  integrationId: string,
  telegramChatId?: string | null,
  telegramUsername?: string | null
): Promise<{
  success: boolean;
  telegramChatId: string | null;
  telegramUsername?: string | null;
}> {
  return request<{
    success: boolean;
    telegramChatId: string | null;
    telegramUsername?: string | null;
  }>(`/api/integrations/${integrationId}/chat-settings`, {
    method: 'PUT',
    body: JSON.stringify({ telegramChatId, telegramUsername }),
  });
}

export function fetchTelegramWebhookStatus(): Promise<{
  info: any;
  botUsername: string | null;
  expectedUrl: string;
}> {
  return request<{
    info: any;
    botUsername: string | null;
    expectedUrl: string;
  }>('/api/telegram/webhook-status');
}

export function setupTelegramWebhook(url?: string): Promise<{
  result: any;
  webhookUrl: string;
}> {
  return request<{
    result: any;
    webhookUrl: string;
  }>('/api/telegram/setup-webhook', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

// Telegram Personal MTProto Gateway API (QR Login)
export interface TelegramGatewayStatus {
  isRunning: boolean;
  isAuthorized: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    username?: string | null;
    phone?: string | null;
  } | null;
  qr?: {
    tgUrl: string;
    dataUrl: string;
    expires?: number;
  } | null;
  qrLoginActive?: boolean;
}

export function fetchTelegramGatewayStatus(): Promise<TelegramGatewayStatus> {
  return request<TelegramGatewayStatus>('/api/telegram-gateway/status');
}

export function startTelegramGatewayQr(): Promise<{
  isAuthorized?: boolean;
  qr?: { tgUrl: string; dataUrl: string; expires?: number };
  user?: any;
}> {
  return request<{
    isAuthorized?: boolean;
    qr?: { tgUrl: string; dataUrl: string; expires?: number };
    user?: any;
  }>('/api/telegram-gateway/qr', { method: 'POST' });
}

export function logoutTelegramGateway(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/api/telegram-gateway/logout', { method: 'POST' });
}


