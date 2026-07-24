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
}

export interface SlotConfig {
  platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX';
  format: string; // "Reels", "Stories", "Post", "Release", etc.
  projectId?: string | null;
}

export interface Integration {
  id: string;
  projectId: string;
  bloggerName: string;
  startDate: string;
  platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX';
  referralLink: string;
  pricePerSlot: number;
  slotsCount: number;
  paidSlotsCount?: number;
  paidAmount?: number;
  totalAmount: number; // calculated: pricePerSlot * slotsCount
  endDate: string;
  status: 'active' | 'completed' | 'paused';
  bloggerCabinetToken?: string;
  slotsConfig?: SlotConfig[];
}

export interface Report {
  id: string;
  date: string;
  projectId: string;
  projectName?: string; // resolved for display
  destination: string;
  channelBlogger: string | null;
  platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | null;
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
  platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX';
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
  role: 'super_admin' | 'pr_manager' | 'product_manager';
  createdAt: string;
  allowedMetrics?: string[];
  allowedPages?: string[];
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
];

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_INTEGRATIONS: Integration[] = [];

export const INITIAL_REPORTS: Report[] = [];

export const INITIAL_SUBMISSIONS: BloggerSubmission[] = [];
