/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Project {
  id: string;
  name: string;
  description: string;
  telegramThreadId?: string;
  createdAt: string;
  monthlyLimit?: number | null;
}

export interface SlotConfig {
  platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok';
  format: string; // "Reels", "Stories", "Post", "Release", etc.
  projectId?: string | null;
}

export type KanbanStage = string;

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  hidden?: boolean;
}

export const INITIAL_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', title: 'Backlog', color: 'slate', hidden: true },
  { id: 'wishlist', title: 'Желаемые', color: 'purple' },
  { id: 'negotiation', title: 'Обговорить', color: 'amber' },
  { id: 'requisites_pending', title: 'Получить реквизиты', color: 'blue' },
  { id: 'ready_for_payment', title: 'Готов к оплате', color: 'indigo' },
  { id: 'paid_in_progress', title: 'Оплачено / В работе', color: 'emerald' },
  { id: 'completed', title: 'Завершено', color: 'neutral' },
];

export interface BloggerRequisites {
  id: string;
  integrationId: string;
  bloggerName: string;
  taxStatus: 'card_transfer' | 'contract' | 'individual' | 'self_employed' | 'individual_entrepreneur' | 'llc';
  fullName: string;
  passportSeriesNumber?: string;
  pinflOrTin?: string;
  passportIssueDate?: string;
  passportIssuedBy?: string;
  registrationAddress?: string;
  passportFrontScan?: string;
  passportBackScan?: string;
  cardNumberOrIban: string;
  bankName?: string;
  bankInn?: string;
  mfo?: string;
  transitAccount?: string;
  recipientName?: string;
  phone?: string;
  telegramHandle?: string;
  submittedAt: string;
  status: 'submitted' | 'verified' | 'rejected';
}

export interface DealComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface SubscriberHistoryItem {
  date: string;
  count: number;
  source?: 'api' | 'manual' | 'historical' | string;
  note?: string | null;
}

export interface Integration {
  id: string;
  projectId: string;
  bloggerName: string;
  bloggerPageLink?: string;
  telegramUsername?: string;
  startDate?: string;
  platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok';
  referralLink?: string;
  pricePerSlot: number;
  slotsCount: number;
  paidSlotsCount?: number;
  paidAmount?: number;
  totalAmount: number; // calculated: pricePerSlot * slotsCount
  endDate?: string;
  status: 'active' | 'completed' | 'paused';
  kanbanStage?: KanbanStage;
  createdBy?: string | null;
  bloggerCabinetToken?: string;
  requisites?: BloggerRequisites;
  slotsConfig?: SlotConfig[];
  comments?: string | DealComment[];
  subscribersCount?: number | null;
  subscribersUpdatedAt?: string | null;
  subscribersHistory?: SubscriberHistoryItem[];
}

export interface Report {
  id: string;
  date: string;
  projectId: string;
  projectName?: string; // resolved for display
  destination: string;
  channelBlogger: string | null;
  bloggerPageLink?: string | null;
  platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok' | null;
  slotsCount: number | null;
  paidSlotsCount: number | null;
  pricePerSlot: number | null;
  paidAmount: number;
  totalAmount: number; // calculated
  comments: string;
  slotsConfig?: SlotConfig[];
  paymentType?: 'prepaid' | 'full' | 'other' | 'remaining';
  amount?: number;
  receipt?: string | null;
  lang?: string;
  bloggerCabinetToken?: string | null;
  createdBy?: string | null;
}

export interface BulkPurchase {
  id: string;
  bloggerName: string;
  platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok';
  totalSlots: number;
  allocatedSlots: number;
  remainingSlots: number;
  pricePerSlot: number;
  totalAmount: number;
  paidAmount: number;
  purchaseDate: string;
  referralLink?: string;
  receipt?: string | null;
  comments?: string;
  slotsConfig?: { slot: number; platform: string; format: string; projectId: string | null; allocatedAt?: string | null }[];
  createdBy?: string | null;
}

export interface BloggerSubmission {
  id: string;
  integrationId: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  data: {
    [key: string]: string; // Key "slot_1", "slot_2" mapped to URLs or mock file paths
  };
}

export interface AllowedUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'pr_manager' | 'product_manager' | 'executive';
  createdAt: string;
  allowedMetrics?: string[];
  allowedPages?: string[];
  allowedProjects?: string[];
}

export const INITIAL_ALLOWED_USERS: AllowedUser[] = [
  {
    id: 'user-1',
    name: 'Abduaziz',
    email: 'abduazizmurodqosimov@gmail.com',
    role: 'super_admin',
    createdAt: '2026-07-10',
    allowedMetrics: ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
    allowedPages: ['projects', 'reports', 'reports_feed', 'other_expenses'],
  },
  {
    id: 'user-4',
    name: 'Khalilov',
    email: 'khalilovdev@gmail.com',
    role: 'super_admin',
    createdAt: '2026-07-10',
    allowedMetrics: ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
    allowedPages: ['projects', 'reports', 'reports_feed', 'other_expenses'],
  },
  {
    id: 'user-5',
    name: 'Chief 1',
    email: 'chief1@tezi.uz',
    role: 'executive',
    createdAt: '2026-08-27',
    allowedMetrics: ['spend', 'set_limit'],
    allowedPages: ['projects'],
  },
];

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_INTEGRATIONS: Integration[] = [];

export const INITIAL_REPORTS: Report[] = [];

export const INITIAL_SUBMISSIONS: BloggerSubmission[] = [];
