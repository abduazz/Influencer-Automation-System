/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface SlotConfig {
  platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX';
  format: string; // "Reels", "Stories", "Post", "Release", etc.
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
  paymentType?: 'prepaid' | 'full' | 'other';
  amount?: number;
  receipt?: string | null;
  lang?: string;
  bloggerCabinetToken?: string | null;
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
  email: string;
  role: 'super_admin' | 'pr_manager' | 'product_manager';
  createdAt: string;
  allowedMetrics?: string[];
}

export const INITIAL_ALLOWED_USERS: AllowedUser[] = [
  {
    id: 'user-1',
    email: 'abduazizmurodqosimov@gmail.com',
    role: 'super_admin',
    createdAt: '2026-07-10',
  },
  {
    id: 'user-4',
    email: 'khalilovdev@gmail.com',
    role: 'super_admin',
    createdAt: '2026-07-10',
  },
  {
    id: 'user-2',
    email: 'pr@fluenceflow.com',
    role: 'pr_manager',
    createdAt: '2026-07-10',
  },
  {
    id: 'user-3',
    email: 'product@fluenceflow.com',
    role: 'product_manager',
    createdAt: '2026-07-10',
  },
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'VK Fest Summer Promo',
    description: 'Promo campaign for VK Fest offline activations with lifestyle and tech bloggers.',
    createdAt: '2026-06-01',
  },
  {
    id: 'proj-2',
    name: 'SaaS AI Assistant Launch',
    description: 'Global integration campaign for new AI code assistant platform with developer channels.',
    createdAt: '2026-06-15',
  },
  {
    id: 'proj-3',
    name: 'Fitness Marathon 2026',
    description: 'Instagram Stories influencer marathon for fitness supplements and training schedules.',
    createdAt: '2026-07-01',
  },
];

export const INITIAL_INTEGRATIONS: Integration[] = [
  {
    id: 'int-1',
    projectId: 'proj-1',
    bloggerName: 'Alex Tech Review',
    startDate: '2026-07-01',
    platform: 'Telegram',
    referralLink: 'https://vk.fest/promo?utm_source=alex_tech&utm_medium=tg',
    pricePerSlot: 150,
    slotsCount: 3,
    paidSlotsCount: 2,
    paidAmount: 300,
    totalAmount: 450,
    endDate: '2026-07-15',
    status: 'active',
    bloggerCabinetToken: 'tok_alextech',
  },
  {
    id: 'int-2',
    projectId: 'proj-1',
    bloggerName: 'Masha Lifestyle',
    startDate: '2026-07-05',
    platform: 'Instagram',
    referralLink: 'https://vk.fest/promo?utm_source=masha_life&utm_medium=inst',
    pricePerSlot: 300,
    slotsCount: 4,
    paidSlotsCount: 4,
    paidAmount: 1200,
    totalAmount: 1200,
    endDate: '2026-07-10',
    status: 'completed',
    bloggerCabinetToken: 'tok_mashalife',
  },
  {
    id: 'int-3',
    projectId: 'proj-2',
    bloggerName: 'CodeGeek Channel',
    startDate: '2026-07-12',
    platform: 'YouTube',
    referralLink: 'https://saas-ai.io/start?utm_campaign=geek_yt',
    pricePerSlot: 800,
    slotsCount: 1,
    paidSlotsCount: 1,
    paidAmount: 800,
    totalAmount: 800,
    endDate: '2026-07-20',
    status: 'active',
    bloggerCabinetToken: 'tok_codegeek',
  },
  {
    id: 'int-4',
    projectId: 'proj-3',
    bloggerName: 'Elena Fit & Health',
    startDate: '2026-07-08',
    platform: 'Instagram',
    referralLink: 'https://fitmara.com/join?utm_source=elena_fit',
    pricePerSlot: 200,
    slotsCount: 5,
    paidSlotsCount: 3,
    paidAmount: 600,
    totalAmount: 1000,
    endDate: '2026-07-18',
    status: 'active',
    bloggerCabinetToken: 'tok_elenafit',
  },
];

export const INITIAL_REPORTS: Report[] = [
  {
    id: 'rep-1',
    date: '2026-07-09',
    projectId: 'proj-1',
    destination: 'Direct Conversion Promo',
    channelBlogger: 'TG/Masha Dev Stories',
    platform: 'Telegram',
    slotsCount: 2,
    paidSlotsCount: 1,
    pricePerSlot: 120,
    paidAmount: 120,
    totalAmount: 240,
    comments: 'Good CTR observed on the first slot. Will follow up for the second one next week.',
  },
  {
    id: 'rep-2',
    date: '2026-07-10',
    projectId: 'proj-2',
    destination: 'Beta Signups',
    channelBlogger: 'WebDev Mastery',
    platform: 'YouTube',
    slotsCount: 1,
    paidSlotsCount: 1,
    pricePerSlot: 750,
    paidAmount: 750,
    totalAmount: 750,
    comments: 'Video integration is live. Direct traffic spiking.',
  },
];

export const INITIAL_SUBMISSIONS: BloggerSubmission[] = [
  {
    id: 'sub-1',
    integrationId: 'int-2',
    submittedAt: '2026-07-09T18:30:00Z',
    status: 'approved',
    data: {
      slot_1: 'stories_screenshot_1_active.png',
      slot_2: 'stories_screenshot_2_metric.png',
      slot_3: 'stories_screenshot_3_swipe.png',
      slot_4: 'stories_screenshot_4_link.png',
    },
  },
];
