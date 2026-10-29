import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  UserCheck,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Layers,
  Sparkles,
  X,
  CalendarClock,
  Users,
  ArrowUpRight,
  Edit2,
  Download,
  LogOut,
  LayoutGrid,
  Columns3,
  Eye,
  ExternalLink,
} from 'lucide-react';
import {
  Project,
  Integration,
  BloggerSubmission,
  BulkPurchase,
  Report,
  AllowedUser,
  SlotConfig,
} from '../data/mockData';
import { Language } from '../translations';

export type SlotKanbanStage = 'planned' | 'review' | 'published';

export interface SlotScheduleUpdatePayload {
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  prManager?: string | null;
  platform?: string | null;
  format?: string | null;
  projectId?: string | null;
  topic?: string | null;
  stage?: SlotKanbanStage | null;
  isPublished?: boolean | null;
  publishedUrl?: string | null;
  publishedAt?: string | null;
  notes?: string | null;
}

interface TimelineViewProps {
  projects: Project[];
  integrations: Integration[];
  submissions: BloggerSubmission[];
  bulkPurchases?: BulkPurchase[];
  reports?: Report[];
  allowedUsers?: AllowedUser[];
  currentUserName?: string;
  userEmail?: string;
  userRole: 'super_admin' | 'pr_manager' | 'product_manager' | 'executive' | 'blogger' | null;
  allowedMetrics?: string[];
  lang?: Language;
  setLang?: (lang: Language) => void;
  onLogout?: () => void;
  onUpdateSlotSchedule: (
    integrationId: string,
    slotNumber: number,
    payload: SlotScheduleUpdatePayload
  ) => Promise<void>;
  onUpdateProject?: (projectId: string, name: string, description: string, monthlyLimit?: number | null) => Promise<void>;
}

export type SlotSlaStatus =
  | 'published_on_time'
  | 'published_late'
  | 'published'
  | 'due_today'
  | 'overdue'
  | 'scheduled'
  | 'unscheduled';

export interface TimelineSlotItem {
  key: string;
  integrationId: string;
  slotNumber: number;
  totalSlotsInDeal: number;
  bloggerName: string;
  bloggerPageLink?: string;
  telegramUsername?: string | null;
  projectId: string;
  projectName: string;
  platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok';
  format: string;
  pricePerSlot: number;
  isSlotPaid: boolean;
  dealStatus: 'active' | 'completed' | 'paused';
  kanbanStage?: string;
  scheduledDate: string | null; // YYYY-MM-DD
  scheduledTime: string | null; // HH:mm
  prManager: string;
  topic: string;
  notes: string;
  slotStage: SlotKanbanStage;
  isPublished: boolean;
  publishedUrl: string;
  publishedAt: string | null; // YYYY-MM-DD
  effectivePublishDate: string | null; // YYYY-MM-DD used for "По выходу" spend calculation
  slaStatus: SlotSlaStatus;
  daysDiff: number | null; // negative = overdue days, 0 = today, positive = days until scheduled
  integration: Integration;
}

const PLATFORM_BADGE_STYLES: Record<string, string> = {
  Instagram: 'bg-pink-50 text-pink-700 border-pink-200/80',
  Telegram: 'bg-sky-50 text-sky-700 border-sky-200/80',
  YouTube: 'bg-red-50 text-red-700 border-red-200/80',
  TikTok: 'bg-neutral-900 text-white border-neutral-800',
  MAX: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
};

const QUICK_TIMES = ['10:00', '12:00', '14:00', '16:00', '18:00', '19:00', '20:00', '21:00'];

const MONTH_NAMES: Record<Language, string[]> = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const WEEKDAYS_SHORT: Record<Language, string[]> = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  uz: ['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha', 'Yak'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

const MONTH_NAMES_RU = MONTH_NAMES.ru;
const WEEKDAYS_SHORT_RU = WEEKDAYS_SHORT.ru;

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return toLocalYmd(dt);
}

function diffDaysYmd(targetYmd: string, baseYmd: string): number {
  const [ty, tm, td] = targetYmd.split('-').map(Number);
  const [by, bm, bd] = baseYmd.split('-').map(Number);
  const tDate = new Date(ty, (tm || 1) - 1, td || 1);
  const bDate = new Date(by, (bm || 1) - 1, bd || 1);
  return Math.round((tDate.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24));
}

function formatReadableDateRu(ymd: string | null): string {
  if (!ymd) return 'Дата не назначена';
  const parts = ymd.slice(0, 10).split('-');
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts.map(Number);
  const monthsGenitive = [
    'янв',
    'фев',
    'мар',
    'апр',
    'мая',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ];
  return `${d} ${monthsGenitive[(m || 1) - 1] || ''} ${y}`;
}

function formatCompactMoney(val: number): string {
  if (!val || val === 0) return '0';
  if (val >= 1_000_000_000) {
    return `${(val / 1_000_000_000).toFixed(2).replace(/\.00$/, '')} млрд`;
  }
  if (val >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')} млн`;
  }
  if (val >= 1_000) {
    return `${Math.round(val / 1_000)} тыс`;
  }
  return val.toLocaleString('ru-RU');
}

export default function TimelineView({
  projects,
  integrations,
  submissions,
  bulkPurchases = [],
  reports = [],
  allowedUsers = [],
  currentUserName = '',
  userEmail = '',
  userRole,
  allowedMetrics = ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
  lang,
  setLang,
  onLogout,
  onUpdateSlotSchedule,
  onUpdateProject,
}: TimelineViewProps) {
  const todayYmd = useMemo(() => toLocalYmd(new Date()), []);

  const [internalLang, setInternalLang] = useState<Language>(() => {
    if (lang) return lang;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('ff_lang') as Language;
      if (cached && ['ru', 'uz', 'en'].includes(cached)) return cached;
    }
    return 'uz';
  });

  const activeLang: Language = lang || internalLang;

  const handleSelectLang = (newLang: Language) => {
    setInternalLang(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ff_lang', newLang);
      window.dispatchEvent(new Event('storage'));
    }
    setLang?.(newLang);
  };

  const monthNamesList = MONTH_NAMES[activeLang] || MONTH_NAMES.ru;
  const weekdaysList = WEEKDAYS_SHORT[activeLang] || WEEKDAYS_SHORT.ru;

  // Project & Filter State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<'active' | 'all'>('active');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [prManagerFilter, setPrManagerFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'published' | 'scheduled' | 'due_today' | 'overdue' | 'unscheduled'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBloggerDealId, setSelectedBloggerDealId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('integrationId') || 'all';
    }
    return 'all';
  });

  // View Mode: 'week' (Неделя) | 'month' (Месяц) | 'kanban' (Канбан слотов: Planned / Review / Published)
  const [viewMode, setViewModeState] = useState<'week' | 'month' | 'kanban'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view');
      if (v === 'kanban' || v === 'week' || v === 'month') return v;
    }
    return 'month';
  });

  const setViewMode = (nextMode: 'week' | 'month' | 'kanban') => {
    setViewModeState(nextMode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (nextMode === 'month') {
        url.searchParams.delete('view');
      } else {
        url.searchParams.set('view', nextMode);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const [focusedDayYmd, setFocusedDayYmd] = useState<string>(() => toLocalYmd(new Date()));
  const [nowTime, setNowTime] = useState<Date>(() => new Date());
  const weekScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  // Calendar Navigation State
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [weekStartDate, setWeekStartDate] = useState<string>(() => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sun, 1 = Mon
    const diffToMonday = day === 0 ? -6 : 1 - day;
    now.setDate(now.getDate() + diffToMonday);
    return toLocalYmd(now);
  });

  // Helper: Open a specific day from Month view directly in the Week Hourly Timeline
  const openDayInWeekTimeline = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const dayOfWeek = dt.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    dt.setDate(dt.getDate() + diffToMon);
    setWeekStartDate(toLocalYmd(dt));
    setFocusedDayYmd(ymd);
    setCalendarMonthDate(new Date(y, (m || 1) - 1, 1));
    setViewMode('week');
  };

  // Unscheduled Sidebar Drawer State
  const [isUnscheduledPanelOpen, setIsUnscheduledPanelOpen] = useState<boolean>(true);
  const [unscheduledSearch, setUnscheduledSearch] = useState<string>('');

  // Accounting Mode ("Касса (По оплате)" vs "По выходу (Факт)") synced with DashboardView
  const [accountingMode, setAccountingMode] = useState<'cash' | 'published_slots'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('accounting_view_mode');
      if (saved === 'published_slots' || saved === 'cash') return saved;
    }
    return 'published_slots';
  });

  const handleSetAccountingMode = (mode: 'cash' | 'published_slots') => {
    setAccountingMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('accounting_view_mode', mode);
      window.dispatchEvent(new Event('accounting_mode_changed'));
    }
  };

  useEffect(() => {
    const syncAccountingMode = () => {
      const saved = localStorage.getItem('accounting_view_mode');
      if (saved === 'published_slots' || saved === 'cash') {
        setAccountingMode(saved);
      }
    };
    window.addEventListener('accounting_mode_changed', syncAccountingMode);
    window.addEventListener('storage', syncAccountingMode);
    return () => {
      window.removeEventListener('accounting_mode_changed', syncAccountingMode);
      window.removeEventListener('storage', syncAccountingMode);
    };
  }, []);

  // Drag & Drop State
  const [draggedSlot, setDraggedSlot] = useState<{ integrationId: string; slotNumber: number } | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverHourCell, setDragOverHourCell] = useState<string | null>(null);
  const [dragOverKanbanStage, setDragOverKanbanStage] = useState<SlotKanbanStage | null>(null);

  // Edit Slot Schedule Modal State
  const [editingSlotKey, setEditingSlotKey] = useState<{
    integrationId: string;
    slotNumber: number;
  } | null>(null);
  const [modalScheduledDate, setModalScheduledDate] = useState<string>('');
  const [modalScheduledTime, setModalScheduledTime] = useState<string>('18:00');
  const [modalPrManager, setModalPrManager] = useState<string>('');
  const [modalPlatform, setModalPlatform] = useState<'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok'>('Instagram');
  const [modalFormat, setModalFormat] = useState<string>('Reels');
  const [modalProjectId, setModalProjectId] = useState<string>('');
  const [modalTopic, setModalTopic] = useState<string>('');
  const [modalNotes, setModalNotes] = useState<string>('');
  const [modalStage, setModalStage] = useState<SlotKanbanStage>('planned');
  const [modalIsPublished, setModalIsPublished] = useState<boolean>(false);
  const [modalPublishedUrl, setModalPublishedUrl] = useState<string>('');
  const [modalPublishedAt, setModalPublishedAt] = useState<string>('');
  const [isSavingSlot, setIsSavingSlot] = useState<boolean>(false);

  // Day Picker Modal for assigning an unscheduled slot to a clicked calendar day / hour
  const [assigningToDate, setAssigningToDate] = useState<string | null>(null);
  const [assigningToTime, setAssigningToTime] = useState<string>('18:00');

  // Monthly Limit Modal State
  const [isLimitModalOpen, setIsLimitModalOpen] = useState<boolean>(false);
  const [limitInput, setLimitInput] = useState<string>('');

  const canShowMetric = (metric: string) => {
    if (userRole === 'super_admin') return true;
    if (
      ['spend', 'budget', 'avg_price', 'set_limit'].includes(metric) &&
      allowedMetrics.includes('financial_metrics')
    ) {
      return true;
    }
    return allowedMetrics.includes(metric);
  };

  // Map project IDs to names
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(String(p.id), p));
    return map;
  }, [projects]);

  // Build normalized list of all slots across integrations
  const allSlots = useMemo<TimelineSlotItem[]>(() => {
    const list: TimelineSlotItem[] = [];

    integrations.forEach((integration) => {
      if (integration.kanbanStage === 'backlog') return;

      const count = Math.max(Number(integration.slotsCount) || 0, 1);
      const paidSlots = Number(integration.paidSlotsCount) || 0;
      const totalAmt = Number(integration.totalAmount) || 0;
      const pricePerSlot = totalAmt > 0 && count > 0 ? totalAmt / count : Number(integration.pricePerSlot) || 0;

      // Latest submission for this integration
      const sub = submissions.find((s) => String(s.integrationId) === String(integration.id));

      for (let i = 1; i <= count; i++) {
        const cfg: Partial<SlotConfig> = integration.slotsConfig?.[i - 1] || {};
        const slotKey = `slot_${i}`;
        const subUrl = sub?.data?.[slotKey] ? String(sub.data[slotKey]).trim() : '';
        const subSubmittedAt =
          sub?.data?.[`${slotKey}_submitted_at`] || sub?.submittedAt || null;
        const subScheduledDate = sub?.data?.[`${slotKey}_scheduled_date`] || null;
        const subScheduledTime = sub?.data?.[`${slotKey}_scheduled_time`] || null;

        const scheduledDateRaw = cfg.scheduledDate || subScheduledDate || null;
        const scheduledDate = scheduledDateRaw ? String(scheduledDateRaw).slice(0, 10) : null;
        const scheduledTimeRaw = cfg.scheduledTime || subScheduledTime || null;
        const scheduledTime = scheduledTimeRaw ? String(scheduledTimeRaw).slice(0, 5) : null;

        const publishedUrl = (cfg.publishedUrl || subUrl || '').trim();
        const isPublished = Boolean(cfg.isPublished || publishedUrl.length > 0 || cfg.stage === 'published');

        const slotStage: SlotKanbanStage = isPublished
          ? 'published'
          : cfg.stage === 'review'
            ? 'review'
            : 'planned';

        const rawPublishedAt = cfg.publishedAt || (isPublished ? subSubmittedAt : null) || null;
        const publishedAt = rawPublishedAt ? String(rawPublishedAt).slice(0, 10) : null;

        // Effective date for "По выходу (Факт)" financial indicator
        const effectivePublishDate = isPublished
          ? publishedAt || scheduledDate || (integration.startDate ? String(integration.startDate).slice(0, 10) : todayYmd)
          : null;

        const slotProjectId = String(cfg.projectId || integration.projectId || '');
        const projectObj = projectMap.get(slotProjectId);
        const projectName = projectObj?.name || 'Без проекта';

        const prManager = (cfg.prManager || integration.createdBy || 'Не назначен').trim();

        // Compute SLA status
        let slaStatus: SlotSlaStatus = 'unscheduled';
        let daysDiff: number | null = null;

        if (scheduledDate) {
          daysDiff = diffDaysYmd(scheduledDate, todayYmd);
        }

        if (isPublished) {
          if (scheduledDate && publishedAt) {
            slaStatus = publishedAt <= scheduledDate ? 'published_on_time' : 'published_late';
          } else {
            slaStatus = 'published';
          }
        } else if (!scheduledDate) {
          slaStatus = 'unscheduled';
        } else if (scheduledDate < todayYmd) {
          slaStatus = 'overdue';
        } else if (scheduledDate === todayYmd) {
          slaStatus = 'due_today';
        } else {
          slaStatus = 'scheduled';
        }

        list.push({
          key: `${integration.id}_slot_${i}`,
          integrationId: String(integration.id),
          slotNumber: i,
          totalSlotsInDeal: count,
          bloggerName: integration.bloggerName || 'Без имени',
          bloggerPageLink: integration.bloggerPageLink,
          telegramUsername: integration.telegramUsername,
          projectId: slotProjectId,
          projectName,
          platform: (cfg.platform || integration.platform || 'Instagram') as TimelineSlotItem['platform'],
          format: cfg.format || 'Reels',
          pricePerSlot,
          isSlotPaid: i <= paidSlots || (Number(integration.paidAmount) || 0) >= pricePerSlot * i,
          dealStatus: integration.status,
          kanbanStage: integration.kanbanStage,
          scheduledDate,
          scheduledTime,
          prManager,
          topic: cfg.topic || '',
          notes: cfg.notes || '',
          slotStage,
          isPublished,
          publishedUrl,
          publishedAt,
          effectivePublishDate,
          slaStatus,
          daysDiff,
          integration,
        });
      }
    });

    return list;
  }, [integrations, submissions, projectMap, todayYmd]);

  // Unique list of PR Managers for filter & dropdown
  const prManagersList = useMemo(() => {
    const set = new Set<string>();
    allowedUsers.forEach((u) => {
      if (u.name && (u.role === 'pr_manager' || u.role === 'super_admin' || u.role === 'product_manager')) {
        set.add(u.name.trim());
      }
    });
    if (currentUserName) set.add(currentUserName.trim());
    allSlots.forEach((s) => {
      if (s.prManager && s.prManager !== 'Не назначен') {
        set.add(s.prManager);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [allowedUsers, currentUserName, allSlots]);

  // Project-scoped & campaign-scoped slots:
  // In 'active' mode, deals on main Kanban only enter Slots Kanban & Timeline once they reach 'paid_in_progress' ("Оплачено / В работе") or have paid/scheduled slots
  const projectScopedSlots = useMemo(() => {
    const prePaymentStages = ['wishlist', 'negotiation', 'requisites_pending', 'ready_for_payment'];
    return allSlots.filter((slot) => {
      const matchesProject =
        selectedProjectId === 'all' ||
        String(slot.projectId) === String(selectedProjectId) ||
        String(slot.integration.projectId) === String(selectedProjectId);

      const isEnteredInWork =
        !slot.kanbanStage ||
        !prePaymentStages.includes(slot.kanbanStage) ||
        slot.isSlotPaid ||
        Boolean(slot.scheduledDate) ||
        slot.isPublished;

      const matchesCampaign =
        campaignFilter === 'all' || (slot.dealStatus === 'active' && isEnteredInWork);

      return matchesProject && matchesCampaign;
    });
  }, [allSlots, selectedProjectId, campaignFilter]);

  // Filtered slots applying Blogger Deal filter, PR Manager, Platform, Status, Search, and Date Filter
  const filteredSlots = useMemo(() => {
    return projectScopedSlots.filter((slot) => {
      if (selectedBloggerDealId !== 'all' && String(slot.integrationId) !== String(selectedBloggerDealId)) {
        return false;
      }

      if (prManagerFilter !== 'all') {
        if (prManagerFilter === 'unassigned') {
          if (slot.prManager !== 'Не назначен' && slot.prManager !== '') return false;
        } else if (slot.prManager !== prManagerFilter) {
          return false;
        }
      }

      if (platformFilter !== 'all' && slot.platform !== platformFilter) {
        return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'published' && !slot.isPublished) return false;
        if (statusFilter === 'scheduled' && !slot.scheduledDate) return false;
        if (statusFilter === 'due_today' && slot.slaStatus !== 'due_today') return false;
        if (statusFilter === 'overdue' && slot.slaStatus !== 'overdue') return false;
        if (statusFilter === 'unscheduled' && slot.slaStatus !== 'unscheduled') return false;
      }

      if (startDateFilter || endDateFilter) {
        const refDate = slot.scheduledDate || slot.effectivePublishDate || slot.integration.startDate || '';
        const ymd = refDate.slice(0, 10);
        if (!ymd) return false;
        if (startDateFilter && ymd < startDateFilter) return false;
        if (endDateFilter && ymd > endDateFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const hay = `${slot.bloggerName} ${slot.projectName} ${slot.prManager} ${slot.topic} ${slot.format} ${slot.platform}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    projectScopedSlots,
    selectedBloggerDealId,
    prManagerFilter,
    platformFilter,
    statusFilter,
    startDateFilter,
    endDateFilter,
    searchQuery,
  ]);

  // Active Month Prefix (YYYY-MM) for "Расход за месяц" indicator
  // Matches DashboardView logic: if startDateFilter is set, use its month; otherwise use calendarMonthDate or current month
  const activeMonthPrefix = useMemo(() => {
    if (startDateFilter) return startDateFilter.slice(0, 7);
    const y = calendarMonthDate.getFullYear();
    const m = String(calendarMonthDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [startDateFilter, calendarMonthDate]);

  const activeMonthLabel = useMemo(() => {
    const [y, m] = activeMonthPrefix.split('-').map(Number);
    return `${MONTH_NAMES_RU[(m || 1) - 1] || ''} ${y}`;
  }, [activeMonthPrefix]);

  // ============================================================================
  // FINANCIAL INDICATORS (100% SYNCHRONIZED WITH DASHBOARDVIEW "Касса" / "По выходу")
  // ============================================================================
  const financialIndicators = useMemo(() => {
    const prePaymentStages = ['wishlist', 'negotiation', 'requisites_pending', 'ready_for_payment'];
    // 1. Project-scoped integrations
    const scopedIntegrations = integrations.filter((item) => {
      if (item.kanbanStage === 'backlog') return false;
      const matchesProject =
        selectedProjectId === 'all' ||
        String(item.projectId) === String(selectedProjectId) ||
        (item.slotsConfig && item.slotsConfig.some((s) => String(s.projectId) === String(selectedProjectId)));
      const isEnteredInWork =
        !item.kanbanStage ||
        !prePaymentStages.includes(item.kanbanStage) ||
        (Number(item.paidSlotsCount) || 0) > 0 ||
        (Number(item.paidAmount) || 0) > 0;
      const matchesCampaign = campaignFilter === 'all' || (item.status === 'active' && isEnteredInWork);
      return matchesProject && matchesCampaign;
    });

    // Helper for deal actual paid amount (matches DashboardView getIntegrationSpend)
    const getDealCashSpend = (item: Integration) => {
      const paidAmt = Number(item.paidAmount) || 0;
      const paidSlotsAmt = (Number(item.paidSlotsCount) || 0) * (Number(item.pricePerSlot) || 0);
      return Math.max(paidAmt, paidSlotsAmt);
    };

    // Unallocated Bulk Purchases (only included in 'all' projects cash mode, identical to DashboardView)
    const filteredUnallocatedSpend =
      selectedProjectId === 'all'
        ? bulkPurchases
          .filter((bp) => {
            if (!startDateFilter && !endDateFilter) return true;
            const pDate = (bp.purchaseDate || '').slice(0, 10);
            if (!pDate) return false;
            if (startDateFilter && pDate < startDateFilter) return false;
            if (endDateFilter && pDate > endDateFilter) return false;
            return true;
          })
          .reduce((sum, bp) => {
            const allocatedValue = (Number(bp.allocatedSlots) || 0) * (Number(bp.pricePerSlot) || 0);
            const unallocatedPaid = Math.max(0, (Number(bp.paidAmount) || 0) - allocatedValue);
            return sum + unallocatedPaid;
          }, 0)
        : 0;

    const monthlyUnallocatedSpend =
      selectedProjectId === 'all'
        ? bulkPurchases
          .filter((bp) => (bp.purchaseDate || '').startsWith(activeMonthPrefix))
          .reduce((sum, bp) => {
            const allocatedValue = (Number(bp.allocatedSlots) || 0) * (Number(bp.pricePerSlot) || 0);
            const unallocatedPaid = Math.max(0, (Number(bp.paidAmount) || 0) - allocatedValue);
            return sum + unallocatedPaid;
          }, 0)
        : 0;

    // Non-blogger other expenses from reports
    const isOtherExpenseReport = (r: Report) => !r.slotsCount || Number(r.slotsCount) === 0;

    const filteredOtherExpenses = reports
      .filter((r) => {
        if (!isOtherExpenseReport(r)) return false;
        const matchesProject = selectedProjectId === 'all' || String(r.projectId) === String(selectedProjectId);
        if (!matchesProject) return false;
        if (!startDateFilter && !endDateFilter) return true;
        const rDate = (r.date || '').slice(0, 10);
        if (startDateFilter && rDate < startDateFilter) return false;
        if (endDateFilter && rDate > endDateFilter) return false;
        return true;
      })
      .reduce((sum, r) => sum + (Number(r.paidAmount) || Number(r.totalAmount) || 0), 0);

    const monthlyOtherExpenses = reports
      .filter((r) => {
        if (!isOtherExpenseReport(r)) return false;
        const matchesProject = selectedProjectId === 'all' || String(r.projectId) === String(selectedProjectId);
        return matchesProject && (r.date || '').startsWith(activeMonthPrefix);
      })
      .reduce((sum, r) => sum + (Number(r.paidAmount) || Number(r.totalAmount) || 0), 0);

    // Cash Spend (Касса - По оплате)
    const cashFilteredSpend =
      scopedIntegrations
        .filter((item) => {
          if (!startDateFilter && !endDateFilter) return true;
          const sDate = (item.startDate || '').slice(0, 10);
          if (!sDate) return false;
          if (startDateFilter && sDate < startDateFilter) return false;
          if (endDateFilter && sDate > endDateFilter) return false;
          return true;
        })
        .reduce((sum, item) => sum + getDealCashSpend(item), 0) +
      filteredUnallocatedSpend +
      filteredOtherExpenses;

    const cashMonthlySpend =
      scopedIntegrations
        .filter((item) => (item.startDate || '').startsWith(activeMonthPrefix))
        .reduce((sum, item) => sum + getDealCashSpend(item), 0) +
      monthlyUnallocatedSpend +
      monthlyOtherExpenses;

    // Published Slots Spend (По выходу - Факт опубликованных слотов)
    let publishedFilteredSpend = 0;
    let publishedMonthlySpend = 0;
    let scheduledFilteredBudget = 0;
    let scheduledMonthlyBudget = 0;

    projectScopedSlots.forEach((slot) => {
      const price = Number(slot.pricePerSlot) || 0;

      // Scheduled budget (slots that have a scheduledDate or effectivePublishDate)
      const planDate = slot.scheduledDate || slot.effectivePublishDate;
      if (planDate) {
        const matchesRange =
          (!startDateFilter || planDate >= startDateFilter) &&
          (!endDateFilter || planDate <= endDateFilter);
        if (matchesRange) {
          scheduledFilteredBudget += price;
        }
        if (planDate.startsWith(activeMonthPrefix)) {
          scheduledMonthlyBudget += price;
        }
      }

      // Published (Факт по выходу)
      if (slot.isPublished && slot.effectivePublishDate) {
        const pubDate = slot.effectivePublishDate.slice(0, 10);
        const matchesRange =
          (!startDateFilter || pubDate >= startDateFilter) &&
          (!endDateFilter || pubDate <= endDateFilter);
        if (matchesRange) {
          publishedFilteredSpend += price;
        }
        if (pubDate.startsWith(activeMonthPrefix)) {
          publishedMonthlySpend += price;
        }
      }
    });

    publishedFilteredSpend += filteredOtherExpenses;
    publishedMonthlySpend += monthlyOtherExpenses;

    const hasDateFilter = Boolean(startDateFilter || endDateFilter);
    const totalSpend = hasDateFilter && accountingMode === 'published_slots' ? publishedFilteredSpend : cashFilteredSpend;
    const monthlySpend = accountingMode === 'published_slots' ? publishedMonthlySpend : cashMonthlySpend;

    const pendingAdvanceFiltered = Math.max(0, cashFilteredSpend - publishedFilteredSpend);
    const pendingAdvanceMonthly = Math.max(0, cashMonthlySpend - publishedMonthlySpend);

    // Monthly Limit & Remaining Limit
    const selectedProject = projects.find((p) => String(p.id) === String(selectedProjectId));
    const totalAllProjectsLimit = projects.reduce((sum, p) => sum + (Number(p.monthlyLimit) || 0), 0);
    const monthlyLimit =
      selectedProjectId === 'all'
        ? totalAllProjectsLimit > 0
          ? totalAllProjectsLimit
          : null
        : selectedProject?.monthlyLimit ?? null;

    const remainingLimit = monthlyLimit !== null ? monthlyLimit - monthlySpend : null;

    return {
      dealsCount: scopedIntegrations.length,
      totalSpend,
      monthlySpend,
      cashFilteredSpend,
      cashMonthlySpend,
      publishedFilteredSpend,
      publishedMonthlySpend,
      scheduledFilteredBudget,
      scheduledMonthlyBudget,
      pendingAdvanceFiltered,
      pendingAdvanceMonthly,
      monthlyLimit,
      remainingLimit,
    };
  }, [
    integrations,
    projectScopedSlots,
    bulkPurchases,
    reports,
    selectedProjectId,
    campaignFilter,
    startDateFilter,
    endDateFilter,
    activeMonthPrefix,
    accountingMode,
    projects,
  ]);

  // SLA & Slot Counters
  const slotMetrics = useMemo(() => {
    const total = filteredSlots.length;
    let scheduled = 0;
    let unscheduled = 0;
    let published = 0;
    let publishedOnTime = 0;
    let publishedLate = 0;
    let overdue = 0;
    let dueToday = 0;

    filteredSlots.forEach((s) => {
      if (s.scheduledDate) scheduled++;
      else unscheduled++;

      if (s.isPublished) {
        published++;
        if (s.slaStatus === 'published_late') publishedLate++;
        else publishedOnTime++;
      } else {
        if (s.slaStatus === 'overdue') overdue++;
        if (s.slaStatus === 'due_today') dueToday++;
      }
    });

    const onTimeRate = published > 0 ? Math.round((publishedOnTime / published) * 100) : 100;
    const scheduleCoverageRate = total > 0 ? Math.round((scheduled / total) * 100) : 0;

    return {
      total,
      scheduled,
      unscheduled,
      published,
      publishedOnTime,
      publishedLate,
      overdue,
      dueToday,
      onTimeRate,
      scheduleCoverageRate,
    };
  }, [filteredSlots]);

  // PR Manager SLA Breakdown Table
  const prManagerStats = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        totalSlots: number;
        scheduledSlots: number;
        unscheduledSlots: number;
        publishedSlots: number;
        onTimeSlots: number;
        lateSlots: number;
        overdueSlots: number;
        dueTodaySlots: number;
        totalBudget: number;
        publishedBudget: number;
      }
    >();

    projectScopedSlots.forEach((s) => {
      const name = s.prManager || 'Не назначен';
      if (!map.has(name)) {
        map.set(name, {
          name,
          totalSlots: 0,
          scheduledSlots: 0,
          unscheduledSlots: 0,
          publishedSlots: 0,
          onTimeSlots: 0,
          lateSlots: 0,
          overdueSlots: 0,
          dueTodaySlots: 0,
          totalBudget: 0,
          publishedBudget: 0,
        });
      }
      const stat = map.get(name)!;
      stat.totalSlots += 1;
      stat.totalBudget += Number(s.pricePerSlot) || 0;
      if (s.scheduledDate) stat.scheduledSlots += 1;
      else stat.unscheduledSlots += 1;

      if (s.isPublished) {
        stat.publishedSlots += 1;
        stat.publishedBudget += Number(s.pricePerSlot) || 0;
        if (s.slaStatus === 'published_late') stat.lateSlots += 1;
        else stat.onTimeSlots += 1;
      } else {
        if (s.slaStatus === 'overdue') stat.overdueSlots += 1;
        if (s.slaStatus === 'due_today') stat.dueTodaySlots += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.name === 'Не назначен') return 1;
      if (b.name === 'Не назначен') return -1;
      return b.totalSlots - a.totalSlots;
    });
  }, [projectScopedSlots]);

  // Unscheduled slots list for right-hand queue
  const unscheduledSlots = useMemo(() => {
    return projectScopedSlots
      .filter((s) => !s.scheduledDate && !s.isPublished)
      .filter((s) => {
        if (!unscheduledSearch.trim()) return true;
        const q = unscheduledSearch.toLowerCase().trim();
        return `${s.bloggerName} ${s.projectName} ${s.prManager} ${s.platform} ${s.format}`
          .toLowerCase()
          .includes(q);
      });
  }, [projectScopedSlots, unscheduledSearch]);

  // Month Calendar Grid Days (42 cells, Monday-first)
  const calendarDays = useMemo(() => {
    const year = calendarMonthDate.getFullYear();
    const month = calendarMonthDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // 0 = Sun, 1 = Mon ... 6 = Sat -> convert to 0 = Mon ... 6 = Sun
    const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = lastDayOfMonth.getDate();

    const cells: {
      ymd: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isInFilterRange: boolean;
      slots: TimelineSlotItem[];
      dayTotalAmount: number;
      dayPublishedAmount: number;
    }[] = [];

    // Map slots by date (scheduledDate or effectivePublishDate)
    const slotsByDate = new Map<string, TimelineSlotItem[]>();
    filteredSlots.forEach((slot) => {
      const dateKey = slot.scheduledDate || slot.effectivePublishDate;
      if (!dateKey) return;
      if (!slotsByDate.has(dateKey)) {
        slotsByDate.set(dateKey, []);
      }
      slotsByDate.get(dateKey)!.push(slot);
    });

    // Sort slots inside each day by scheduledTime
    slotsByDate.forEach((daySlots) => {
      daySlots.sort((a, b) => {
        const tA = a.scheduledTime || '23:59';
        const tB = b.scheduledTime || '23:59';
        return tA.localeCompare(tB);
      });
    });

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const cellDate = new Date(year, month, 1 - startWeekday + i);
      const ymd = toLocalYmd(cellDate);
      const isCurrentMonth = cellDate.getMonth() === month;
      const isToday = ymd === todayYmd;
      const isInFilterRange =
        Boolean(startDateFilter || endDateFilter) &&
        (!startDateFilter || ymd >= startDateFilter) &&
        (!endDateFilter || ymd <= endDateFilter);

      const daySlots = slotsByDate.get(ymd) || [];
      const dayTotalAmount = daySlots.reduce((sum, s) => sum + (Number(s.pricePerSlot) || 0), 0);
      const dayPublishedAmount = daySlots
        .filter((s) => s.isPublished)
        .reduce((sum, s) => sum + (Number(s.pricePerSlot) || 0), 0);

      cells.push({
        ymd,
        dayNumber: cellDate.getDate(),
        isCurrentMonth,
        isToday,
        isInFilterRange,
        slots: daySlots,
        dayTotalAmount,
        dayPublishedAmount,
      });
    }

    return cells;
  }, [calendarMonthDate, filteredSlots, todayYmd, startDateFilter, endDateFilter]);

  const HOUR_HEIGHT = 64;
  const HOURS_24 = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  // Week Hourly View Columns (7 days starting from weekStartDate, Apple Calendar style)
  const weekColumns = useMemo(() => {
    const cols: {
      ymd: string;
      weekdayShort: string;
      dayNumber: number;
      dayLabel: string;
      isToday: boolean;
      isFocused: boolean;
      isWeekend: boolean;
      slots: TimelineSlotItem[];
      allDaySlots: TimelineSlotItem[];
      timedSlots: (TimelineSlotItem & {
        hour: number;
        minute: number;
        topPx: number;
        colIdx: number;
        colCount: number;
      })[];
      totalAmount: number;
    }[] = [];

    for (let i = 0; i < 7; i++) {
      const ymd = addDaysYmd(weekStartDate, i);
      const [, m, d] = ymd.split('-').map(Number);
      const daySlots = filteredSlots
        .filter((s) => (s.scheduledDate || s.effectivePublishDate) === ymd)
        .sort((a, b) => (a.scheduledTime || '23:59').localeCompare(b.scheduledTime || '23:59'));

      const allDaySlots: TimelineSlotItem[] = [];
      const rawTimed: (TimelineSlotItem & { hour: number; minute: number; topPx: number })[] = [];

      daySlots.forEach((slot) => {
        if (slot.scheduledTime && /^\d{1,2}:\d{2}$/.test(slot.scheduledTime)) {
          const [hh, mm] = slot.scheduledTime.split(':').map(Number);
          const hour = Math.max(0, Math.min(23, hh || 0));
          const minute = Math.max(0, Math.min(59, mm || 0));
          const topPx = (hour + minute / 60) * HOUR_HEIGHT;
          rawTimed.push({ ...slot, hour, minute, topPx });
        } else {
          allDaySlots.push(slot);
        }
      });

      // Group overlapping timed slots within the same hour so they sit side-by-side cleanly
      const timedByHour = new Map<number, typeof rawTimed>();
      rawTimed.forEach((item) => {
        if (!timedByHour.has(item.hour)) {
          timedByHour.set(item.hour, []);
        }
        timedByHour.get(item.hour)!.push(item);
      });

      const timedSlots: (TimelineSlotItem & {
        hour: number;
        minute: number;
        topPx: number;
        colIdx: number;
        colCount: number;
      })[] = [];

      timedByHour.forEach((group) => {
        group.forEach((item, idx) => {
          timedSlots.push({
            ...item,
            colIdx: idx,
            colCount: group.length,
          });
        });
      });

      cols.push({
        ymd,
        weekdayShort: weekdaysList[i] || WEEKDAYS_SHORT_RU[i],
        dayNumber: d || 1,
        dayLabel: `${d}.${String(m).padStart(2, '0')}`,
        isToday: ymd === todayYmd,
        isFocused: ymd === focusedDayYmd,
        isWeekend: i >= 5,
        slots: daySlots,
        allDaySlots,
        timedSlots,
        totalAmount: daySlots.reduce((sum, s) => sum + (Number(s.pricePerSlot) || 0), 0),
      });
    }
    return cols;
  }, [weekStartDate, filteredSlots, todayYmd, focusedDayYmd, weekdaysList]);

  // Auto-scroll 24h week timeline to active hours (e.g. 07:00 or first slot of focused day)
  useEffect(() => {
    if (viewMode !== 'week' || !weekScrollRef.current) return;
    const focusedCol = weekColumns.find((c) => c.ymd === focusedDayYmd);
    let targetHour = 7;
    if (focusedCol && focusedCol.timedSlots.length > 0) {
      targetHour = Math.max(0, focusedCol.timedSlots[0].hour - 1);
    } else {
      const currentH = new Date().getHours();
      targetHour = Math.max(0, Math.min(18, currentH - 3));
    }
    weekScrollRef.current.scrollTo({
      top: targetHour * HOUR_HEIGHT,
      behavior: 'smooth',
    });
  }, [viewMode, weekStartDate, focusedDayYmd]);

  // Open Modal for a specific slot
  const openSlotModal = (slot: TimelineSlotItem, overrideDate?: string, overrideTime?: string) => {
    setEditingSlotKey({
      integrationId: slot.integrationId,
      slotNumber: slot.slotNumber,
    });
    setModalScheduledDate(overrideDate ?? slot.scheduledDate ?? todayYmd);
    setModalScheduledTime(overrideTime ?? slot.scheduledTime ?? '18:00');
    setModalPrManager(
      slot.prManager && slot.prManager !== 'Не назначен'
        ? slot.prManager
        : currentUserName || ''
    );
    setModalPlatform(slot.platform || 'Instagram');
    setModalFormat(slot.format || 'Reels');
    setModalProjectId(slot.projectId || slot.integration.projectId || '');
    setModalTopic(slot.topic || '');
    setModalNotes(slot.notes || '');
    setModalStage(slot.slotStage || (slot.isPublished ? 'published' : 'planned'));
    setModalIsPublished(slot.isPublished);
    setModalPublishedUrl(slot.publishedUrl || '');
    setModalPublishedAt(slot.publishedAt || overrideDate || slot.scheduledDate || todayYmd);
  };

  const currentlyEditingSlot = useMemo(() => {
    if (!editingSlotKey) return null;
    return (
      allSlots.find(
        (s) =>
          String(s.integrationId) === String(editingSlotKey.integrationId) &&
          s.slotNumber === editingSlotKey.slotNumber
      ) || null
    );
  }, [editingSlotKey, allSlots]);

  const siblingSlotsOfEditingDeal = useMemo(() => {
    if (!editingSlotKey) return [];
    return allSlots
      .filter((s) => String(s.integrationId) === String(editingSlotKey.integrationId))
      .sort((a, b) => a.slotNumber - b.slotNumber);
  }, [editingSlotKey, allSlots]);

  const handleSaveSlotSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlotKey) return;
    setIsSavingSlot(true);
    const effectiveStage: SlotKanbanStage = modalIsPublished ? 'published' : modalStage === 'published' ? 'planned' : modalStage;
    try {
      await onUpdateSlotSchedule(editingSlotKey.integrationId, editingSlotKey.slotNumber, {
        scheduledDate: modalScheduledDate || null,
        scheduledTime: modalScheduledTime || null,
        prManager: modalPrManager.trim() || null,
        platform: modalPlatform,
        format: modalFormat.trim() || 'Reels',
        projectId: modalProjectId || null,
        topic: modalTopic.trim() || null,
        notes: modalNotes.trim() || null,
        stage: effectiveStage,
        isPublished: modalIsPublished,
        publishedUrl: modalIsPublished ? modalPublishedUrl.trim() || null : null,
        publishedAt: modalIsPublished ? modalPublishedAt || modalScheduledDate || todayYmd : null,
      });
      setEditingSlotKey(null);
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleQuickClearDate = async () => {
    if (!editingSlotKey) return;
    setIsSavingSlot(true);
    try {
      await onUpdateSlotSchedule(editingSlotKey.integrationId, editingSlotKey.slotNumber, {
        scheduledDate: null,
        scheduledTime: null,
      });
      setEditingSlotKey(null);
    } finally {
      setIsSavingSlot(false);
    }
  };

  // Drag & Drop Handlers (Calendar + Slots Kanban)
  const handleDropOnDate = async (targetYmd: string, targetTime?: string) => {
    setDragOverDate(null);
    setDragOverHourCell(null);
    if (!draggedSlot) return;
    const slotObj = allSlots.find(
      (s) =>
        String(s.integrationId) === String(draggedSlot.integrationId) &&
        s.slotNumber === draggedSlot.slotNumber
    );
    setDraggedSlot(null);
    if (!slotObj) return;

    await onUpdateSlotSchedule(slotObj.integrationId, slotObj.slotNumber, {
      scheduledDate: targetYmd,
      scheduledTime: targetTime || slotObj.scheduledTime || '18:00',
      prManager:
        slotObj.prManager && slotObj.prManager !== 'Не назначен'
          ? slotObj.prManager
          : currentUserName || null,
    });
  };

  const handleMoveSlotToKanbanStage = async (
    slotObj: TimelineSlotItem,
    targetStage: SlotKanbanStage
  ) => {
    if (slotObj.slotStage === targetStage) return;
    const isPub = targetStage === 'published';
    await onUpdateSlotSchedule(slotObj.integrationId, slotObj.slotNumber, {
      stage: targetStage,
      isPublished: isPub,
      publishedAt: isPub ? slotObj.publishedAt || slotObj.scheduledDate || todayYmd : null,
      prManager:
        slotObj.prManager && slotObj.prManager !== 'Не назначен'
          ? slotObj.prManager
          : currentUserName || null,
    });
  };

  const handleDropOnKanbanStage = async (targetStage: SlotKanbanStage) => {
    setDragOverKanbanStage(null);
    if (!draggedSlot) return;
    const slotObj = allSlots.find(
      (s) =>
        String(s.integrationId) === String(draggedSlot.integrationId) &&
        s.slotNumber === draggedSlot.slotNumber
    );
    setDraggedSlot(null);
    if (!slotObj) return;
    await handleMoveSlotToKanbanStage(slotObj, targetStage);
  };

  // Blogger deals summary in current project scope (for Blogger Deal filter pills on Slots Kanban)
  const bloggerDealsInScope = useMemo(() => {
    const map = new Map<
      string,
      {
        integrationId: string;
        bloggerName: string;
        projectName: string;
        platform: string;
        slotsCount: number;
        pricePerSlot: number;
        totalDealBudget: number;
        plannedCount: number;
        reviewCount: number;
        publishedCount: number;
      }
    >();

    projectScopedSlots.forEach((s) => {
      if (!map.has(s.integrationId)) {
        map.set(s.integrationId, {
          integrationId: s.integrationId,
          bloggerName: s.bloggerName,
          projectName: s.projectName,
          platform: s.platform,
          slotsCount: 0,
          pricePerSlot: s.pricePerSlot,
          totalDealBudget: 0,
          plannedCount: 0,
          reviewCount: 0,
          publishedCount: 0,
        });
      }
      const d = map.get(s.integrationId)!;
      d.slotsCount += 1;
      d.totalDealBudget += Number(s.pricePerSlot) || 0;
      if (s.slotStage === 'published') d.publishedCount += 1;
      else if (s.slotStage === 'review') d.reviewCount += 1;
      else d.plannedCount += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.slotsCount - a.slotsCount);
  }, [projectScopedSlots]);

  // Date Preset Helpers
  const applyDatePreset = (preset: 'today' | 'week' | 'month' | 'clear') => {
    const now = new Date();
    if (preset === 'clear') {
      setStartDateFilter('');
      setEndDateFilter('');
      return;
    }
    if (preset === 'today') {
      const ymd = toLocalYmd(now);
      setStartDateFilter(ymd);
      setEndDateFilter(ymd);
      setCalendarMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
      return;
    }
    if (preset === 'week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      setStartDateFilter(toLocalYmd(mon));
      setEndDateFilter(toLocalYmd(sun));
      setWeekStartDate(toLocalYmd(mon));
      return;
    }
    if (preset === 'month') {
      const y = calendarMonthDate.getFullYear();
      const m = calendarMonthDate.getMonth();
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      setStartDateFilter(toLocalYmd(first));
      setEndDateFilter(toLocalYmd(last));
    }
  };

  // Export Schedule to CSV
  const handleExportCsv = () => {
    const headers = [
      'Дата выхода',
      'Время',
      'Блогер',
      'Слот',
      'Проект',
      'Платформа',
      'Формат',
      'PR-менеджер',
      'Стоимость слота (UZS)',
      'Статус SLA',
      'Дата фактической публикации',
      'Ссылка на публикацию',
      'Тема / Заметка',
    ];

    const statusLabelMap: Record<SlotSlaStatus, string> = {
      published_on_time: 'Опубликовано вовремя',
      published_late: 'Опубликовано с опозданием',
      published: 'Опубликовано',
      due_today: 'Выход сегодня',
      overdue: 'Просрочено (SLA)',
      scheduled: 'В графике',
      unscheduled: 'Без даты',
    };

    const rows = filteredSlots.map((s) => [
      s.scheduledDate || 'Не назначена',
      s.scheduledTime || '—',
      `"${(s.bloggerName || '').replace(/"/g, '""')}"`,
      `Слот #${s.slotNumber}/${s.totalSlotsInDeal}`,
      `"${(s.projectName || '').replace(/"/g, '""')}"`,
      s.platform,
      s.format,
      `"${(s.prManager || '').replace(/"/g, '""')}"`,
      s.pricePerSlot,
      statusLabelMap[s.slaStatus],
      s.publishedAt || '—',
      s.publishedUrl || '—',
      `"${(s.topic || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline_slots_${activeMonthPrefix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render SLA Badge
  const renderSlaBadge = (slot: TimelineSlotItem, compact = false) => {
    switch (slot.slaStatus) {
      case 'published_on_time':
      case 'published':
        return (
          <span
            className={`inline-flex items-center gap-1 font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
              }`}
          >
            <CheckCircle2 className={compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />
            {compact ? 'Вышло' : 'Опубликовано вовремя'}
          </span>
        );
      case 'published_late':
        return (
          <span
            className={`inline-flex items-center gap-1 font-semibold rounded-md bg-teal-50 text-teal-800 border border-teal-200/80 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
              }`}
          >
            <CheckCircle2 className={compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />
            {compact ? 'Вышло (опозд.)' : 'Вышло с опозданием'}
          </span>
        );
      case 'due_today':
        return (
          <span
            className={`inline-flex items-center gap-1 font-semibold rounded-md bg-amber-50 text-amber-800 border border-amber-300 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
              }`}
          >
            <Clock className={compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />
            {compact ? 'Сегодня' : `Выход сегодня ${slot.scheduledTime ? `в ${slot.scheduledTime}` : ''}`}
          </span>
        );
      case 'overdue':
        return (
          <span
            className={`inline-flex items-center gap-1 font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
              }`}
          >
            <AlertTriangle className={compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />
            {compact
              ? 'Просрочено'
              : `Просрочен выход (${Math.abs(slot.daysDiff || 1)} дн.)`}
          </span>
        );
      case 'scheduled':
        return (
          <span
            className={`inline-flex items-center gap-1 font-medium rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
              }`}
          >
            <CalendarClock className={compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />
            {compact ? 'В графике' : `В графике (${slot.daysDiff} дн.)`}
          </span>
        );
      default:
        return (
          <span
            className={`inline-flex items-center gap-1 font-medium rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
              }`}
          >
            <AlertCircle className={compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />
            {compact ? 'Без даты' : 'Дата не назначена'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 pb-8 max-w-[1920px] mx-auto w-full">
      {/* 1. UNIFIED COMMAND TOOLBAR & CONTROLS */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs divide-y divide-neutral-100">
        {/* Tier 1: Primary Navigation, Project Scope & Key Utilities */}
        <div className="p-3 sm:px-4.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Left: View Mode Switcher + Projects */}
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar min-w-0">
            {/* 3 View Modes: Неделя | Месяц | Канбан слотов */}
            <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200/70 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'week'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                  }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Неделя</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'month'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                  }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Месяц</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'kanban'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                  }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>Канбан слотов</span>
              </button>
            </div>

            <div className="h-5 w-[1px] bg-neutral-200/80 shrink-0" />

            {/* Projects Switcher */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedProjectId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${selectedProjectId === 'all'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100/80 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70'
                  }`}
              >
                Все проекты
                <span
                  className={`ml-1.5 px-1.5 py-0.2 rounded text-[10px] tabular-nums font-bold ${selectedProjectId === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-neutral-200/80 text-neutral-700'
                    }`}
                >
                  {allSlots.filter((s) => campaignFilter === 'all' || s.dealStatus === 'active').length}
                </span>
              </button>

              {projects.map((project) => {
                const isSelected = String(selectedProjectId) === String(project.id);
                const projectSlotCount = allSlots.filter(
                  (s) =>
                    (String(s.projectId) === String(project.id) ||
                      String(s.integration.projectId) === String(project.id)) &&
                    (campaignFilter === 'all' || s.dealStatus === 'active')
                ).length;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(String(project.id))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${isSelected
                        ? 'bg-neutral-900 text-white shadow-2xs'
                        : 'bg-neutral-100/80 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70'
                      }`}
                  >
                    <span>{project.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] tabular-nums font-bold ${isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-neutral-200/80 text-neutral-700'
                        }`}
                    >
                      {projectSlotCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Accounting Toggle + Campaign Toggle + Limits + Utilities */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canShowMetric('spend') && (
              <div
                className="flex items-center bg-neutral-100/90 p-0.5 rounded-xl border border-neutral-200/70"
                title="Переключение расчета расходов: Касса (по дате оплаты сделки) или По выходу (по дате фактического выхода слота)"
              >
                <button
                  type="button"
                  onClick={() => handleSetAccountingMode('cash')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${accountingMode === 'cash'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                >
                  Касса
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAccountingMode('published_slots')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${accountingMode === 'published_slots'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>По выходу (Факт)</span>
                </button>
              </div>
            )}

            <div className="flex items-center bg-neutral-100/90 p-0.5 rounded-xl border border-neutral-200/70">
              <button
                type="button"
                onClick={() => setCampaignFilter('active')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${campaignFilter === 'active'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                  }`}
              >
                Активные
              </button>
              <button
                type="button"
                onClick={() => setCampaignFilter('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${campaignFilter === 'all'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                  }`}
              >
                Все
              </button>
            </div>

            {canShowMetric('spend') && financialIndicators.monthlyLimit !== null && (
              <div className="hidden 2xl:flex items-center gap-1.5 bg-neutral-50 border border-neutral-200/80 px-2.5 py-1 rounded-xl text-xs">
                <span className="text-neutral-500 font-medium">Лимит:</span>
                <span className="font-bold text-neutral-900 tabular-nums">
                  {formatCompactMoney(financialIndicators.monthlyLimit)}
                </span>
                <span className="text-neutral-300">|</span>
                <span className="text-neutral-500 font-medium">Остаток:</span>
                <span
                  className={`font-bold tabular-nums ${(financialIndicators.remainingLimit || 0) < 0
                      ? 'text-rose-600'
                      : 'text-emerald-600'
                    }`}
                >
                  {formatCompactMoney(financialIndicators.remainingLimit || 0)}
                </span>
              </div>
            )}

            {selectedProjectId !== 'all' &&
              onUpdateProject &&
              (userRole === 'super_admin' ||
                userRole === 'executive' ||
                allowedMetrics.includes('set_limit') ||
                allowedMetrics.includes('financial_metrics')) && (
                <button
                  type="button"
                  onClick={() => {
                    const p = projects.find((proj) => String(proj.id) === String(selectedProjectId));
                    setLimitInput(p?.monthlyLimit ? String(p.monthlyLimit) : '');
                    setIsLimitModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  title="Настроить лимит бюджета"
                >
                  <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Лимит</span>
                </button>
              )}

            {viewMode !== 'kanban' && (
              <button
                type="button"
                onClick={() => setIsUnscheduledPanelOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${isUnscheduledPanelOpen
                    ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                title="Очередь слотов без назначенной даты выхода"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Без даты:</span>
                <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-white text-[10px] font-bold tabular-nums">
                  {unscheduledSlots.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer"
              title="Скачать график выходов в CSV (Excel)"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden xl:inline">CSV</span>
            </button>

            {/* Language Switcher */}
            <div className="flex items-center bg-neutral-100 p-0.5 rounded-xl border border-neutral-200/80">
              {(['ru', 'uz', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => handleSelectLang(l)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${activeLang === l
                      ? 'bg-neutral-900 text-white shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  title={l === 'ru' ? 'Русский' : l === 'uz' ? "O'zbekcha" : 'English'}
                >
                  {l}
                </button>
              ))}
            </div>

            {(currentUserName || userEmail) && (
              <div className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-xl bg-neutral-50 border border-neutral-200/80 text-xs">
                <div className="w-5 h-5 rounded-md bg-neutral-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  {(currentUserName || userEmail || 'U').slice(0, 1).toUpperCase()}
                </div>
                <span className="font-semibold text-neutral-800 max-w-[100px] truncate hidden md:inline">
                  {currentUserName || userEmail}
                </span>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-0.5 rounded text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Выйти"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tier 2: Search, Micro-Filters & Date Picker (Slim, Clean, Inline) */}
        <div className="p-3 sm:px-4.5 bg-neutral-50/40 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск блогера, темы, PR..."
                className="w-full pl-8.5 pr-7 py-1 bg-white border border-neutral-200/80 rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* PR Manager Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200/80 rounded-xl px-2.5 py-1">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-xs text-neutral-400 font-medium">PR:</span>
              <select
                value={prManagerFilter}
                onChange={(e) => setPrManagerFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold text-neutral-900 focus:ring-0 p-0 pr-4 cursor-pointer"
              >
                <option value="all">Все PR-менеджеры</option>
                <option value="unassigned">Не назначен</option>
                {prManagersList.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200/80 rounded-xl px-2.5 py-1">
              <Layers className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold text-neutral-900 focus:ring-0 p-0 pr-4 cursor-pointer"
              >
                <option value="all">Все платформы</option>
                <option value="Instagram">Instagram</option>
                <option value="Telegram">Telegram</option>
                <option value="YouTube">YouTube</option>
                <option value="TikTok">TikTok</option>
                <option value="MAX">MAX</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200/80 rounded-xl px-2.5 py-1">
              <Filter className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent border-none text-xs font-semibold text-neutral-900 focus:ring-0 p-0 pr-4 cursor-pointer"
              >
                <option value="all">Все слоты ({projectScopedSlots.length})</option>
                <option value="due_today">Выход сегодня ({slotMetrics.dueToday})</option>
                <option value="scheduled">В графике ({slotMetrics.scheduled})</option>
                <option value="published">Опубликованы ({slotMetrics.published})</option>
                <option value="overdue">Просрочены ({slotMetrics.overdue})</option>
                <option value="unscheduled">Без даты ({slotMetrics.unscheduled})</option>
              </select>
            </div>

            {/* Blogger Deal Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200/80 rounded-xl px-2.5 py-1">
              <Users className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <select
                value={selectedBloggerDealId}
                onChange={(e) => setSelectedBloggerDealId(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold text-neutral-900 focus:ring-0 p-0 pr-4 cursor-pointer max-w-[180px] truncate"
              >
                <option value="all">Все блогеры ({bloggerDealsInScope.length})</option>
                {bloggerDealsInScope.map((deal) => (
                  <option key={deal.integrationId} value={deal.integrationId}>
                    {deal.bloggerName} ({deal.slotsCount} сл.)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Picker & Quick Presets (Aligned Right) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-neutral-200/80 text-xs">
              <CalendarIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="bg-transparent border-none text-neutral-900 font-medium focus:ring-0 p-0 text-xs cursor-pointer tabular-nums"
                title="Начало периода"
              />
              <span className="text-neutral-300">—</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="bg-transparent border-none text-neutral-900 font-medium focus:ring-0 p-0 text-xs cursor-pointer tabular-nums"
                title="Конец периода"
              />
              {(startDateFilter || endDateFilter) && (
                <button
                  type="button"
                  onClick={() => applyDatePreset('clear')}
                  className="ml-1 text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-0.5 bg-neutral-100 p-0.5 rounded-xl border border-neutral-200/60 text-xs">
              <button
                type="button"
                onClick={() => applyDatePreset('today')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${startDateFilter === todayYmd && endDateFilter === todayYmd
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                  }`}
              >
                Сегодня
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('week')}
                className="px-2 py-0.5 rounded-lg text-[11px] font-medium text-neutral-600 hover:text-neutral-900 transition-all cursor-pointer"
              >
                Неделя
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('month')}
                className="px-2 py-0.5 rounded-lg text-[11px] font-medium text-neutral-600 hover:text-neutral-900 transition-all cursor-pointer"
              >
                Месяц
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PRECISION FINANCIAL & SLA KPI CARDS (UX-UI MASTERY: TABULAR-NUMS, SEMANTIC ACCENTS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
        {/* Card 1: Deals Count */}
        {canShowMetric('deals') && (
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-neutral-500">Сделки с блогерами</span>
              <span className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
                {financialIndicators.dealsCount}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Активных интеграций в выборке
              </p>
            </div>
          </div>
        )}

        {/* Card 2: Total / Filtered Spend ("По выходу" vs "Касса") */}
        {canShowMetric('spend') && (
          <div
            className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between transition-colors ${(startDateFilter || endDateFilter) && accountingMode === 'published_slots'
                ? 'bg-indigo-50/35 border-indigo-200/90'
                : 'bg-white border-neutral-200/80'
              }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-medium text-neutral-600">
                {startDateFilter || endDateFilter ? 'Расход за период' : 'Общий расход'}
              </span>
              {(startDateFilter || endDateFilter) && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${accountingMode === 'published_slots'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-neutral-100 text-neutral-600'
                    }`}
                >
                  {accountingMode === 'published_slots' ? 'По выходу' : 'Касса'}
                </span>
              )}
            </div>
            <div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 tabular-nums leading-snug">
                {financialIndicators.totalSpend.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-medium text-neutral-500">сум</span>
              </div>
              <div className="mt-2 pt-2 border-t border-neutral-200/60 flex items-center justify-between text-[11px]">
                <span className="text-neutral-500">План в графике:</span>
                <span className="font-semibold text-indigo-700 tabular-nums">
                  {formatCompactMoney(financialIndicators.scheduledFilteredBudget)} сум
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Card 3: Monthly Spend ("Расход за месяц / По выходу") */}
        {canShowMetric('spend') && (
          <div
            className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between transition-colors ${accountingMode === 'published_slots'
                ? 'bg-indigo-50/45 border-indigo-300/90 ring-1 ring-indigo-500/10'
                : 'bg-white border-neutral-200/80'
              }`}
          >
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
              <span className="text-xs font-semibold text-neutral-700 truncate">
                Расход ({activeMonthLabel})
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${accountingMode === 'published_slots'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
              >
                {accountingMode === 'published_slots' ? 'По выходу' : 'Касса'}
              </span>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 tabular-nums leading-snug">
                {financialIndicators.monthlySpend.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-medium text-neutral-500">сум</span>
              </div>
              {accountingMode === 'published_slots' ? (
                <div className="mt-2 pt-2 border-t border-indigo-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-amber-700 font-medium">Ждет выхода (аванс):</span>
                  <span className="font-bold text-amber-800 tabular-nums">
                    {formatCompactMoney(financialIndicators.pendingAdvanceMonthly)} сум
                  </span>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-neutral-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-neutral-500">Вышло по факту:</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">
                    {formatCompactMoney(financialIndicators.publishedMonthlySpend)} сум
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Card 4: Total Slots */}
        {canShowMetric('total_slots') && (
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-neutral-500">Всего слотов</span>
              <span className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
                {slotMetrics.total}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Оплачено слотов:{' '}
                <span className="font-semibold text-neutral-700 tabular-nums">
                  {filteredSlots.filter((s) => s.isSlotPaid).length}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Card 5: Scheduled in Calendar */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-neutral-500">Назначено в график</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 tabular-nums">
              {slotMetrics.scheduleCoverageRate}%
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-indigo-600 tabular-nums">
                {slotMetrics.scheduled}
              </span>
              <span className="text-xs text-neutral-400 tabular-nums">
                из {slotMetrics.total}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Выход сегодня:{' '}
              <span className="font-bold text-amber-600 tabular-nums">
                {slotMetrics.dueToday}
              </span>
            </p>
          </div>
        </div>

        {/* Card 6: Published & On-Time SLA */}
        {canShowMetric('slots_published') && (
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-neutral-500">Опубликовано</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/70 tabular-nums">
                {slotMetrics.onTimeRate}% вовремя
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-emerald-600 tabular-nums">
                {slotMetrics.published}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Вовремя: <b className="text-emerald-700 tabular-nums">{slotMetrics.publishedOnTime}</b> · С опозд.:{' '}
                <b className="text-amber-700 tabular-nums">{slotMetrics.publishedLate}</b>
              </p>
            </div>
          </div>
        )}

        {/* Card 7: SLA Control (Overdue & Unscheduled) */}
        {canShowMetric('slots_remaining') && (
          <div
            className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${slotMetrics.overdue > 0
                ? 'bg-rose-50/40 border-rose-200'
                : 'bg-white border-neutral-200/80'
              }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-neutral-600">Контроль SLA</span>
              <AlertTriangle
                className={`w-4 h-4 ${slotMetrics.overdue > 0 ? 'text-rose-600' : 'text-amber-500'
                  }`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() =>
                  setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')
                }
                className={`text-left p-2 rounded-xl border transition-colors cursor-pointer ${
                  statusFilter === 'overdue'
                    ? 'bg-rose-100 border-rose-300 ring-2 ring-rose-400/40 shadow-2xs'
                    : 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-200/60'
                }`}
              >
                <div className="text-base font-bold text-rose-600 tabular-nums leading-none">
                  {slotMetrics.overdue}
                </div>
                <div className="text-[10px] font-semibold text-rose-800 mt-1">
                  Просрочено
                </div>
              </button>
              <button
                type="button"
                onClick={() =>
                  setStatusFilter(statusFilter === 'unscheduled' ? 'all' : 'unscheduled')
                }
                className={`text-left p-2 rounded-xl border transition-colors cursor-pointer ${
                  statusFilter === 'unscheduled'
                    ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-400/40 shadow-2xs'
                    : 'bg-amber-50/80 hover:bg-amber-100/80 border-amber-200/60'
                }`}
              >
                <div className="text-base font-bold text-amber-700 tabular-nums leading-none">
                  {slotMetrics.unscheduled}
                </div>
                <div className="text-[10px] font-semibold text-amber-800 mt-1">
                  Без даты
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. MAIN WORKSPACE: APPLE CALENDAR (НЕДЕЛЯ / МЕСЯЦ) + UNSCHEDULED DRAWER */}
      <div className="flex flex-col xl:flex-row items-start gap-5">
        {/* LEFT / MAIN PANEL */}
        <div className="w-full flex-1 min-w-0">
          {/* ====================================================================
              VIEW MODE 1: MONTH CALENDAR ("Месяц" — Click on any day opens Week Timeline)
             ==================================================================== */}
          {viewMode === 'month' && (
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
              {/* Apple Calendar Style Header Bar */}
              <div className="p-4 sm:px-6 border-b border-neutral-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left: Large Month & Year Title */}
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
                    {monthNamesList[calendarMonthDate.getMonth()]}{' '}
                    <span className="font-normal text-neutral-600">
                      {calendarMonthDate.getFullYear()} г.
                    </span>
                  </h2>
                  <span className="hidden sm:inline-flex items-center gap-1 ml-2 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-200/60">
                    Нажмите на день → откроется почасовой таймлайн недели
                  </span>
                </div>

                {/* Center: Segmented Switcher (Неделя | Месяц) */}
                <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200/80 self-start lg:self-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode('week')}
                    className="px-4 py-1 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-all cursor-pointer"
                  >
                    Неделя
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('month')}
                    className="px-4 py-1 rounded-lg text-xs font-semibold bg-white text-neutral-900 shadow-2xs transition-all cursor-pointer"
                  >
                    Месяц
                  </button>
                </div>

                {/* Right: Apple Navigation (< Сегодня >) + Legend */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
                  <div className="hidden 2xl:flex items-center gap-2.5 text-[11px] text-neutral-500 mr-1">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Вышло
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Сегодня
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      В графике
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Просрочено
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonthDate(
                          new Date(
                            calendarMonthDate.getFullYear(),
                            calendarMonthDate.getMonth() - 1,
                            1
                          )
                        )
                      }
                      className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                      title="Предыдущий месяц"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDayInWeekTimeline(todayYmd)}
                      className="px-3.5 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs font-semibold transition-colors cursor-pointer"
                      title="Перейти на недельный вид сегодняшнего дня"
                    >
                      Сегодня
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonthDate(
                          new Date(
                            calendarMonthDate.getFullYear(),
                            calendarMonthDate.getMonth() + 1,
                            1
                          )
                        )
                      }
                      className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                      title="Следующий месяц"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-b border-neutral-200/80 bg-neutral-50/70">
                {weekdaysList.map((dayName, idx) => (
                  <div
                    key={dayName}
                    className={`py-2.5 px-3 text-right text-xs font-semibold ${idx >= 5 ? 'text-neutral-400' : 'text-neutral-600'
                      }`}
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* 7-Column Month Grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-neutral-200/70">
                {calendarDays.map((cell) => {
                  const isDragTarget = dragOverDate === cell.ymd;
                  return (
                    <div
                      key={cell.ymd}
                      onClick={() => openDayInWeekTimeline(cell.ymd)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverDate !== cell.ymd) setDragOverDate(cell.ymd);
                      }}
                      onDragLeave={() => {
                        if (dragOverDate === cell.ymd) setDragOverDate(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnDate(cell.ymd);
                      }}
                      className={`min-h-[150px] sm:min-h-[175px] p-2 flex flex-col justify-between transition-colors group relative cursor-pointer ${!cell.isCurrentMonth
                          ? 'bg-neutral-50/60 text-neutral-400 hover:bg-neutral-100/60'
                          : cell.isToday
                            ? 'bg-rose-50/15 hover:bg-indigo-50/25'
                            : cell.isInFilterRange
                              ? 'bg-amber-50/20 hover:bg-amber-50/40'
                              : 'bg-white hover:bg-neutral-50/80'
                        } ${isDragTarget
                          ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50/50'
                          : ''
                        }`}
                      title={`Нажмите, чтобы открыть ${formatReadableDateRu(cell.ymd)} в недельном таймлайне`}
                    >
                      {/* Top of Day Cell: Date Number + Daily Spend + Add Slot Button */}
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDayInWeekTimeline(cell.ymd);
                              }}
                              className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center tabular-nums transition-transform group-hover:scale-105 cursor-pointer ${cell.isToday
                                  ? 'bg-[#FF3B30] text-white shadow-xs'
                                  : cell.isCurrentMonth
                                    ? 'text-neutral-900 group-hover:bg-neutral-900 group-hover:text-white'
                                    : 'text-neutral-400 group-hover:bg-neutral-200 group-hover:text-neutral-700'
                                }`}
                            >
                              {cell.dayNumber}
                            </button>
                            {cell.slots.length > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-600 tabular-nums">
                                {cell.slots.length} сл.
                              </span>
                            )}
                            <span className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-indigo-600 transition-opacity hidden sm:inline">
                              Неделя →
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {canShowMetric('spend') && cell.dayTotalAmount > 0 && (
                              <span
                                className="text-[10px] font-bold text-neutral-600 bg-neutral-100/90 px-1.5 py-0.5 rounded-md tabular-nums"
                                title={`Объем выходов за ${cell.ymd}: ${cell.dayTotalAmount.toLocaleString('ru-RU')} сум`}
                              >
                                {formatCompactMoney(cell.dayTotalAmount)}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssigningToTime('18:00');
                                setAssigningToDate(cell.ymd);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                              title={`Назначить слот на ${formatReadableDateRu(cell.ymd)}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Day's Scheduled / Published Slot Cards */}
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5 custom-scrollbar">
                          {cell.slots.map((slot) => {
                            const cardColors =
                              slot.slaStatus === 'published_on_time' || slot.slaStatus === 'published'
                                ? 'bg-emerald-50/90 border-emerald-200/90 hover:border-emerald-400 text-emerald-950'
                                : slot.slaStatus === 'published_late'
                                  ? 'bg-teal-50/90 border-teal-200/90 hover:border-teal-400 text-teal-950'
                                  : slot.slaStatus === 'overdue'
                                    ? 'bg-rose-50/95 border-rose-300 hover:border-rose-500 text-rose-950'
                                    : slot.slaStatus === 'due_today'
                                      ? 'bg-amber-50/95 border-amber-300 hover:border-amber-500 text-amber-950'
                                      : 'bg-indigo-50/70 border-indigo-200/90 hover:border-indigo-400 text-neutral-900';

                            return (
                              <div
                                key={slot.key}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  setDraggedSlot({
                                    integrationId: slot.integrationId,
                                    slotNumber: slot.slotNumber,
                                  });
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSlotModal(slot);
                                }}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer shadow-2xs hover:shadow-xs ${cardColors}`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded bg-white/80 text-neutral-800 border border-black/5">
                                    <Clock className="w-2.5 h-2.5 text-indigo-600" />
                                    {slot.scheduledTime || 'Весь день'}
                                  </span>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/70 text-neutral-700 truncate max-w-[85px]">
                                    {slot.projectName}
                                  </span>
                                </div>

                                <div className="font-bold text-xs truncate leading-tight">
                                  {slot.bloggerName}
                                </div>

                                <div className="mt-1 flex items-center justify-between gap-1 text-[10px] opacity-85">
                                  <span className="truncate">
                                    #{slot.slotNumber} · {slot.platform} ({slot.format})
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {slot.slotStage === 'review' && !slot.isPublished && (
                                      <span className="px-1 py-0.2 rounded bg-violet-100 text-violet-700 font-bold text-[9px] border border-violet-200">
                                        Review
                                      </span>
                                    )}
                                    {slot.isPublished && (
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    )}
                                    {slot.slaStatus === 'overdue' && (
                                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                    )}
                                  </div>
                                </div>

                                <div className="mt-1 pt-1 border-t border-black/5 flex items-center justify-between gap-1 text-[10px]">
                                  <span className="truncate font-medium text-neutral-600">
                                    PR: {slot.prManager}
                                  </span>
                                  {canShowMetric('spend') && slot.pricePerSlot > 0 && (
                                    <span className="font-bold tabular-nums shrink-0">
                                      {formatCompactMoney(slot.pricePerSlot)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ====================================================================
              VIEW MODE 2: APPLE CALENDAR WEEK TIMELINE ("Неделя" — 24h Grid + Red Time Line)
             ==================================================================== */}
          {viewMode === 'week' && (
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
              {/* 1. Apple Calendar Week Top Bar */}
              <div className="p-4 sm:px-6 border-b border-neutral-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left: Month & Year Title (Apple style: "Октябрь 2026 г.") */}
                <div className="flex flex-wrap items-baseline gap-2.5">
                  {(() => {
                    const refYmd = focusedDayYmd || weekStartDate;
                    const [ry, rm] = refYmd.split('-').map(Number);
                    const monthTitle = monthNamesList[(rm || 1) - 1] || '';
                    return (
                      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
                        {monthTitle}{' '}
                        <span className="font-normal text-neutral-600">{ry} г.</span>
                      </h2>
                    );
                  })()}
                  {focusedDayYmd && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200/70">
                      <span>Выбран день: {formatReadableDateRu(focusedDayYmd)}</span>
                    </span>
                  )}
                </div>

                {/* Center: Segmented Switcher (Неделя | Месяц) */}
                <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200/80 self-start lg:self-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode('week')}
                    className="px-4 py-1 rounded-lg text-xs font-semibold bg-white text-neutral-900 shadow-2xs transition-all cursor-pointer"
                  >
                    Неделя
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('month')}
                    className="px-4 py-1 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-all cursor-pointer"
                  >
                    Месяц
                  </button>
                </div>

                {/* Right: Apple Navigation (< Сегодня >) */}
                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const prevWeek = addDaysYmd(weekStartDate, -7);
                        setWeekStartDate(prevWeek);
                        setFocusedDayYmd(addDaysYmd(focusedDayYmd || weekStartDate, -7));
                      }}
                      className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                      title="Предыдущая неделя"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const todayStr = toLocalYmd(now);
                        const day = now.getDay();
                        const diff = day === 0 ? -6 : 1 - day;
                        now.setDate(now.getDate() + diff);
                        setWeekStartDate(toLocalYmd(now));
                        setFocusedDayYmd(todayStr);
                      }}
                      className="px-3.5 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Сегодня
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextWeek = addDaysYmd(weekStartDate, 7);
                        setWeekStartDate(nextWeek);
                        setFocusedDayYmd(addDaysYmd(focusedDayYmd || weekStartDate, 7));
                      }}
                      className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                      title="Следующая неделя"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Apple Calendar 7-Day Header ("Пн, 26", "Вт, 27", "Ср, 28" with Red Circle on Today) */}
              <div className="flex border-b border-neutral-200/80 bg-neutral-50/50">
                {/* Left Time Gutter Spacer */}
                <div className="w-16 sm:w-20 shrink-0 border-r border-neutral-200/80" />

                {/* 7 Day Column Headers */}
                <div className="flex-1 grid grid-cols-7 divide-x divide-neutral-200/80">
                  {weekColumns.map((col) => (
                    <button
                      key={col.ymd}
                      type="button"
                      onClick={() => setFocusedDayYmd(col.ymd)}
                      className={`py-2.5 px-1 sm:px-2 flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors cursor-pointer ${col.isFocused && !col.isToday
                          ? 'bg-indigo-50/70'
                          : col.isToday
                            ? 'bg-rose-50/20'
                            : 'hover:bg-neutral-100/70'
                        }`}
                    >
                      <span
                        className={`text-xs sm:text-sm font-medium ${col.isToday
                            ? 'text-neutral-900 font-semibold'
                            : col.isFocused
                              ? 'text-indigo-700 font-semibold'
                              : col.isWeekend
                                ? 'text-neutral-400'
                                : 'text-neutral-600'
                          }`}
                      >
                        {col.weekdayShort},
                      </span>
                      <span
                        className={`w-7 h-7 rounded-full text-xs sm:text-sm font-bold inline-flex items-center justify-center tabular-nums transition-all ${col.isToday
                            ? 'bg-[#FF3B30] text-white shadow-xs'
                            : col.isFocused
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : col.isWeekend
                                ? 'text-neutral-400'
                                : 'text-neutral-900'
                          }`}
                      >
                        {col.dayNumber}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. "весь день" (All-Day / Daily Summary Row) */}
              <div className="flex border-b border-neutral-200/90 bg-neutral-50/30">
                <div className="w-16 sm:w-20 shrink-0 border-r border-neutral-200/80 py-2 px-1.5 flex items-start justify-end">
                  <span className="text-[10px] sm:text-[11px] font-medium text-neutral-400 leading-tight text-right">
                    весь день
                  </span>
                </div>

                <div className="flex-1 grid grid-cols-7 divide-x divide-neutral-200/80">
                  {weekColumns.map((col) => (
                    <div
                      key={col.ymd}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverDate(col.ymd);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnDate(col.ymd);
                      }}
                      className={`p-1.5 min-h-[42px] flex flex-col gap-1 transition-colors ${col.isFocused && !col.isToday ? 'bg-indigo-50/25' : ''
                        } ${dragOverDate === col.ymd ? 'bg-indigo-50/60' : ''}`}
                    >
                      {/* Daily Summary + Quick Add Button */}
                      <div className="flex items-center justify-between gap-1">
                        {col.slots.length > 0 ? (
                          <span className="text-[10px] font-semibold text-neutral-500 tabular-nums truncate">
                            {col.slots.length} сл.
                            {canShowMetric('spend') && col.totalAmount > 0
                              ? ` · ${formatCompactMoney(col.totalAmount)}`
                              : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-300">—</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningToTime('18:00');
                            setAssigningToDate(col.ymd);
                          }}
                          className="p-0.5 rounded text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title={`Назначить слот на ${formatReadableDateRu(col.ymd)}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Slots without a specific HH:mm time */}
                      {col.allDaySlots.map((slot) => (
                        <div
                          key={slot.key}
                          draggable
                          onDragStart={() =>
                            setDraggedSlot({
                              integrationId: slot.integrationId,
                              slotNumber: slot.slotNumber,
                            })
                          }
                          onClick={() => openSlotModal(slot)}
                          className="px-1.5 py-1 rounded-md bg-indigo-50 border border-indigo-200/90 hover:border-indigo-400 text-[10px] font-semibold text-indigo-950 truncate cursor-pointer"
                          title={`${slot.bloggerName} (${slot.projectName}) — время не указано`}
                        >
                          {slot.bloggerName}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Scrollable 24-Hour Vertical Timeline Grid (Apple Calendar Style) */}
              <div
                ref={weekScrollRef}
                className="relative overflow-y-auto max-h-[680px] custom-scrollbar select-none"
              >
                <div
                  className="flex relative"
                  style={{ height: `${24 * HOUR_HEIGHT}px` }}
                >
                  {/* Left Time Gutter (00:00 .. 23:00 + Red Current-Time Pill) */}
                  <div className="w-16 sm:w-20 shrink-0 border-r border-neutral-200/80 bg-neutral-50/40 relative">
                    {HOURS_24.map((hour) => (
                      <div
                        key={hour}
                        style={{ height: `${HOUR_HEIGHT}px` }}
                        className="relative pr-2 flex justify-end"
                      >
                        <span className="text-[11px] font-medium text-neutral-400 tabular-nums -translate-y-2">
                          {hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
                        </span>
                      </div>
                    ))}

                    {/* Live Red Current-Time Pill in Gutter (e.g. "12:58") */}
                    {(() => {
                      const mins = nowTime.getHours() * 60 + nowTime.getMinutes();
                      const topPx = (mins / 60) * HOUR_HEIGHT;
                      const hh = String(nowTime.getHours()).padStart(2, '0');
                      const mm = String(nowTime.getMinutes()).padStart(2, '0');
                      return (
                        <div
                          style={{ top: `${topPx}px` }}
                          className="absolute right-1.5 -translate-y-1/2 z-30 px-1.5 py-0.5 rounded-full bg-[#FF3B30] text-white text-[10px] font-bold tabular-nums shadow-xs pointer-events-none"
                        >
                          {hh}:{mm}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 7 Day Columns with 24 Hour Cells + Positioned Slot Cards + Red Current-Time Line */}
                  <div className="flex-1 grid grid-cols-7 divide-x divide-neutral-200/80 relative">
                    {weekColumns.map((col) => (
                      <div
                        key={col.ymd}
                        className={`relative ${col.isFocused && !col.isToday
                            ? 'bg-indigo-50/20'
                            : col.isWeekend
                              ? 'bg-neutral-50/30'
                              : 'bg-white'
                          }`}
                      >
                        {/* 24 Hour Background Cells (Click or Drop on any hour) */}
                        {HOURS_24.map((hour) => {
                          const hourStr = `${String(hour).padStart(2, '0')}:00`;
                          const cellKey = `${col.ymd}-${hour}`;
                          const isCellDragOver = dragOverHourCell === cellKey;
                          return (
                            <div
                              key={hour}
                              style={{ height: `${HOUR_HEIGHT}px` }}
                              onClick={() => {
                                setFocusedDayYmd(col.ymd);
                                setAssigningToTime(hourStr);
                                setAssigningToDate(col.ymd);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (dragOverHourCell !== cellKey) {
                                  setDragOverHourCell(cellKey);
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverHourCell === cellKey) {
                                  setDragOverHourCell(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleDropOnDate(col.ymd, hourStr);
                              }}
                              className={`border-b border-neutral-100 transition-colors group/hour relative cursor-pointer ${isCellDragOver
                                  ? 'bg-indigo-100/70 ring-1 ring-inset ring-indigo-500'
                                  : 'hover:bg-neutral-50/90'
                                }`}
                              title={`${formatReadableDateRu(col.ymd)}, ${hourStr} — нажмите, чтобы назначить выход`}
                            >
                              <span className="opacity-0 group-hover/hour:opacity-100 absolute right-1.5 top-1 text-[10px] font-semibold text-neutral-400 pointer-events-none">
                                + {hourStr}
                              </span>
                            </div>
                          );
                        })}

                        {/* Positioned Timed Slot Cards */}
                        {col.timedSlots.map((slot) => {
                          const cardColors =
                            slot.slaStatus === 'published_on_time' || slot.slaStatus === 'published'
                              ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950 hover:border-emerald-500'
                              : slot.slaStatus === 'published_late'
                                ? 'bg-teal-50/95 border-teal-300 text-teal-950 hover:border-teal-500'
                                : slot.slaStatus === 'overdue'
                                  ? 'bg-rose-50/95 border-rose-300 text-rose-950 hover:border-rose-500'
                                  : slot.slaStatus === 'due_today'
                                    ? 'bg-amber-50/95 border-amber-300 text-amber-950 hover:border-amber-500'
                                    : 'bg-indigo-50/95 border-indigo-300 text-indigo-950 hover:border-indigo-500';

                          const widthPct = 100 / slot.colCount;
                          const leftPct = slot.colIdx * widthPct;

                          return (
                            <div
                              key={slot.key}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setDraggedSlot({
                                  integrationId: slot.integrationId,
                                  slotNumber: slot.slotNumber,
                                });
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openSlotModal(slot);
                              }}
                              style={{
                                top: `${slot.topPx + 1}px`,
                                minHeight: `${HOUR_HEIGHT - 4}px`,
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${widthPct}% - 4px)`,
                              }}
                              className={`absolute z-10 p-1.5 rounded-xl border-l-4 border shadow-xs hover:shadow-md hover:z-20 transition-all cursor-pointer overflow-hidden flex flex-col justify-between ${cardColors}`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-extrabold tabular-nums">
                                    {slot.scheduledTime}
                                  </span>
                                  <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-white/80 text-neutral-700 truncate max-w-[65px]">
                                    {slot.projectName}
                                  </span>
                                </div>
                                <div className="font-bold text-[11px] leading-tight truncate mt-0.5">
                                  {slot.bloggerName}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-1 text-[9px] opacity-85 pt-0.5 border-t border-black/5">
                                <span className="truncate">
                                  #{slot.slotNumber} · {slot.platform}
                                </span>
                                {canShowMetric('spend') && slot.pricePerSlot > 0 && (
                                  <span className="font-bold tabular-nums shrink-0">
                                    {formatCompactMoney(slot.pricePerSlot)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Apple Calendar Red Current-Time Line & Dot inside Today's Column */}
                        {col.isToday &&
                          (() => {
                            const mins = nowTime.getHours() * 60 + nowTime.getMinutes();
                            const topPx = (mins / 60) * HOUR_HEIGHT;
                            return (
                              <div
                                style={{ top: `${topPx}px` }}
                                className="absolute inset-x-0 z-20 pointer-events-none flex items-center"
                              >
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B30] -ml-[5px] shadow-xs shrink-0" />
                                <div className="h-[2px] w-full bg-[#FF3B30]" />
                              </div>
                            );
                          })()}
                      </div>
                    ))}

                    {/* Subtle full-week horizontal red hair-line at current time (Apple Calendar style) */}
                    {(() => {
                      const mins = nowTime.getHours() * 60 + nowTime.getMinutes();
                      const topPx = (mins / 60) * HOUR_HEIGHT;
                      return (
                        <div
                          style={{ top: `${topPx}px` }}
                          className="absolute inset-x-0 border-t border-[#FF3B30]/35 z-15 pointer-events-none"
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              VIEW MODE 3: SLOTS KANBAN BOARD ("Канбан слотов": Planned | Review | Published)
             ==================================================================== */}
          {viewMode === 'kanban' && (
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
              {/* 1. Slots Kanban Top Bar */}
              <div className="p-4 sm:px-6 border-b border-neutral-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                    <Columns3 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-neutral-900">
                        Канбан-доска слотов
                      </h2>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-200/70">
                        Авто-пополнение из «Оплачено / В работе» · 100% синхронизация с Таймлайном
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Перетаскивайте слоты блогеров между <b className="text-neutral-700">Planned</b>,{' '}
                      <b className="text-violet-700">Review</b> и{' '}
                      <b className="text-emerald-700">Published</b>. При переходе в Published стоимость слота сразу учитывается в расходе «По выходу (Факт)».
                    </p>
                  </div>
                </div>

                {/* Center/Right: Segmented Switcher (Неделя | Месяц | Канбан слотов) */}
                <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200/80 self-start lg:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('week')}
                    className="px-3.5 py-1 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-all cursor-pointer"
                  >
                    Неделя
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('month')}
                    className="px-3.5 py-1 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-all cursor-pointer"
                  >
                    Месяц
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('kanban')}
                    className="px-3.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-2xs transition-all cursor-pointer"
                  >
                    Канбан слотов
                  </button>
                </div>
              </div>

              {/* 2. Blogger Deal Quick Filter Pills (e.g. 20 slots = 20 mln UZS -> 1 mln per slot) */}
              {bloggerDealsInScope.length > 0 && (
                <div className="px-4 sm:px-6 py-3 bg-neutral-50/70 border-b border-neutral-200/70 flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider shrink-0 mr-1">
                    Блогеры в работе:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedBloggerDealId('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${selectedBloggerDealId === 'all'
                        ? 'bg-neutral-900 text-white shadow-2xs'
                        : 'bg-white text-neutral-700 border border-neutral-200/80 hover:border-neutral-300'
                      }`}
                  >
                    <span>Все блогеры</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${selectedBloggerDealId === 'all'
                          ? 'bg-white/20 text-white'
                          : 'bg-neutral-100 text-neutral-600'
                        }`}
                    >
                      {projectScopedSlots.length} сл.
                    </span>
                  </button>

                  {bloggerDealsInScope.map((deal) => {
                    const isActive = String(selectedBloggerDealId) === String(deal.integrationId);
                    return (
                      <button
                        key={deal.integrationId}
                        type="button"
                        onClick={() =>
                          setSelectedBloggerDealId(isActive ? 'all' : String(deal.integrationId))
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-2 ${isActive
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-neutral-700 border border-neutral-200/80 hover:border-indigo-300'
                          }`}
                        title={`${deal.bloggerName} (${deal.projectName}) — ${deal.slotsCount} слотов по ${deal.pricePerSlot.toLocaleString('ru-RU')} сум (Всего: ${deal.totalDealBudget.toLocaleString('ru-RU')} сум)`}
                      >
                        <span className="truncate max-w-[140px]">{deal.bloggerName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-indigo-50 text-indigo-700'
                            }`}
                        >
                          {deal.publishedCount}/{deal.slotsCount} сл.
                        </span>
                        {canShowMetric('spend') && deal.pricePerSlot > 0 && (
                          <span
                            className={`text-[10px] tabular-nums ${isActive ? 'text-indigo-100' : 'text-neutral-400'
                              }`}
                          >
                            по {formatCompactMoney(deal.pricePerSlot)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 3. Three Containers Grid: Planned | Review | Published */}
              <div className="p-4 sm:p-6 bg-neutral-50/40 grid grid-cols-1 lg:grid-cols-3 gap-5">
                {(
                  [
                    {
                      stage: 'planned' as SlotKanbanStage,
                      title: 'Planned',
                      subtitle: 'Запланировано · В очереди на подготовку и выход',
                      badgeBg: 'bg-indigo-600 text-white',
                      headerBg: 'bg-indigo-50/70 border-indigo-200/80',
                      ringActive: 'ring-2 ring-indigo-500 bg-indigo-50/40',
                      dotColor: 'bg-indigo-600',
                    },
                    {
                      stage: 'review' as SlotKanbanStage,
                      title: 'Review',
                      subtitle: 'На ревью · Проверка ТЗ, черновика и креатива PR-менеджером',
                      badgeBg: 'bg-violet-600 text-white',
                      headerBg: 'bg-violet-50/70 border-violet-200/80',
                      ringActive: 'ring-2 ring-violet-500 bg-violet-50/40',
                      dotColor: 'bg-violet-600',
                    },
                    {
                      stage: 'published' as SlotKanbanStage,
                      title: 'Published',
                      subtitle: 'Опубликовано · Вышло у блогера (учитывается «По выходу»)',
                      badgeBg: 'bg-emerald-600 text-white',
                      headerBg: 'bg-emerald-50/70 border-emerald-200/80',
                      ringActive: 'ring-2 ring-emerald-500 bg-emerald-50/40',
                      dotColor: 'bg-emerald-600',
                    },
                  ] as const
                ).map((col) => {
                  const colSlots = filteredSlots
                    .filter((s) => s.slotStage === col.stage)
                    .sort((a, b) => {
                      const dA = a.scheduledDate || '9999-12-31';
                      const dB = b.scheduledDate || '9999-12-31';
                      if (dA !== dB) return dA.localeCompare(dB);
                      if (a.bloggerName !== b.bloggerName) {
                        return a.bloggerName.localeCompare(b.bloggerName, 'ru');
                      }
                      return a.slotNumber - b.slotNumber;
                    });

                  const colBudget = colSlots.reduce(
                    (sum, s) => sum + (Number(s.pricePerSlot) || 0),
                    0
                  );
                  const isDragOverCol = dragOverKanbanStage === col.stage;

                  return (
                    <div
                      key={col.stage}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverKanbanStage !== col.stage) {
                          setDragOverKanbanStage(col.stage);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverKanbanStage === col.stage) {
                          setDragOverKanbanStage(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnKanbanStage(col.stage);
                      }}
                      className={`rounded-2xl border border-neutral-200/90 bg-neutral-100/60 flex flex-col min-h-[640px] transition-all ${isDragOverCol ? col.ringActive : ''
                        }`}
                    >
                      {/* Container Header */}
                      <div className={`p-4 rounded-t-2xl border-b ${col.headerBg}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                            <h3 className="text-base font-extrabold tracking-tight text-neutral-900">
                              {col.title}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${col.badgeBg}`}
                            >
                              {colSlots.length}
                            </span>
                          </div>

                          {canShowMetric('spend') && (
                            <span
                              className="px-2.5 py-1 rounded-lg bg-white/90 border border-black/5 text-xs font-bold text-neutral-800 tabular-nums shadow-2xs"
                              title={`Сумма слотов в контейнере ${col.title}: ${colBudget.toLocaleString('ru-RU')} сум`}
                            >
                              {colBudget.toLocaleString('ru-RU')} сум
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-1">{col.subtitle}</p>
                      </div>

                      {/* Container Cards List */}
                      <div className="p-3 space-y-2.5 flex-1 max-h-[780px] overflow-y-auto custom-scrollbar">
                        {colSlots.length === 0 ? (
                          <div className="h-56 rounded-xl border-2 border-dashed border-neutral-200/90 flex flex-col items-center justify-center p-6 text-center text-neutral-400">
                            <Columns3 className="w-7 h-7 mb-2 opacity-50" />
                            <div className="text-xs font-bold text-neutral-600">
                              В контейнере {col.title} пока нет слотов
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-1">
                              Перетащите карточку слота сюда или измените этап внутри карточки
                            </p>
                          </div>
                        ) : (
                          colSlots.map((slot) => (
                            <div
                              key={slot.key}
                              draggable
                              onDragStart={() =>
                                setDraggedSlot({
                                  integrationId: slot.integrationId,
                                  slotNumber: slot.slotNumber,
                                })
                              }
                              onClick={() => openSlotModal(slot)}
                              className="p-3.5 rounded-xl bg-white border border-neutral-200/80 hover:border-neutral-300 hover:shadow-xs transition-all duration-150 cursor-pointer group flex flex-col justify-between gap-2.5"
                            >
                              <div>
                                {/* Top Row: Blogger Name + Slot #X/N */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-[13px] text-neutral-900 group-hover:text-indigo-600 transition-colors truncate">
                                      {slot.bloggerName}
                                    </div>
                                    <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5 truncate">
                                      <span className="font-medium text-neutral-700 truncate max-w-[130px]">
                                        {slot.projectName}
                                      </span>
                                      <span className="text-neutral-300">·</span>
                                      <span className="text-neutral-500 truncate">PR: {slot.prManager}</span>
                                    </div>
                                  </div>

                                  <span className="px-2 py-0.5 rounded-md bg-neutral-100/90 text-neutral-600 border border-neutral-200/60 font-semibold text-[10.5px] tabular-nums shrink-0">
                                    #{slot.slotNumber}/{slot.totalSlotsInDeal}
                                  </span>
                                </div>

                                {/* Meta Row: Price + Platform/Format + SLA Badge */}
                                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium border ${PLATFORM_BADGE_STYLES[slot.platform] ||
                                        'bg-neutral-50 text-neutral-700 border-neutral-200'
                                        }`}
                                    >
                                      {slot.platform} · {slot.format}
                                    </span>
                                    {renderSlaBadge(slot, true)}
                                  </div>

                                  {canShowMetric('spend') && slot.pricePerSlot > 0 && (
                                    <span
                                      className="text-xs font-bold text-neutral-900 tabular-nums"
                                      title={`Стоимость слота #${slot.slotNumber}: ${slot.pricePerSlot.toLocaleString('ru-RU')} сум`}
                                    >
                                      {slot.pricePerSlot.toLocaleString('ru-RU')}{' '}
                                      <span className="text-[10px] font-normal text-neutral-500">сум</span>
                                    </span>
                                  )}
                                </div>

                                {/* Optional Topic / Brief */}
                                {slot.topic && (
                                  <div className="mt-2 pl-2 border-l-2 border-neutral-200 text-[11px] text-neutral-600 line-clamp-1 italic">
                                    {slot.topic}
                                  </div>
                                )}
                              </div>

                              <div>
                                {/* Timeline Sync Row: Scheduled Date & Time + Post Link */}
                                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2 text-[11px]">
                                  {slot.scheduledDate ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDayInWeekTimeline(slot.scheduledDate!);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-50 hover:bg-indigo-50 text-neutral-700 hover:text-indigo-700 border border-neutral-200/60 font-medium transition-colors cursor-pointer tabular-nums"
                                      title="Открыть этот день и час в недельном таймлайне"
                                    >
                                      <CalendarIcon className="w-3 h-3 text-neutral-400 group-hover:text-indigo-500" />
                                      <span>
                                        {formatReadableDateRu(slot.scheduledDate)}
                                        {slot.scheduledTime ? ` · ${slot.scheduledTime}` : ''}
                                      </span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openSlotModal(slot);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50/70 hover:bg-amber-100/80 text-amber-800 border border-amber-200/60 font-medium transition-colors cursor-pointer"
                                    >
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      <span>Назначить дату</span>
                                    </button>
                                  )}

                                  {slot.publishedUrl && (
                                    <a
                                      href={slot.publishedUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                                    >
                                      <span>Пост</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>

                                {/* Quick 1-Click Stage Transition Buttons */}
                                <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between gap-1.5">
                                  {col.stage !== 'planned' ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveSlotToKanbanStage(slot, 'planned');
                                      }}
                                      className="text-[11px] text-neutral-500 hover:text-neutral-900 font-medium px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer"
                                    >
                                      ← В Planned
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-neutral-400 font-medium">
                                      Этап 1/3
                                    </span>
                                  )}

                                  <div className="flex items-center gap-1.5">
                                    {col.stage !== 'review' && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveSlotToKanbanStage(slot, 'review');
                                        }}
                                        className="text-[11px] text-violet-700 hover:text-violet-800 font-medium px-2 py-1 rounded-md bg-violet-50/70 hover:bg-violet-100 border border-violet-200/70 transition-colors cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span>На Review</span>
                                      </button>
                                    )}

                                    {col.stage !== 'published' && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveSlotToKanbanStage(slot, 'published');
                                        }}
                                        className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Published ✓</span>
                                      </button>
                                    )}

                                    {col.stage === 'published' && (
                                      <span className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Готово</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: UNSCHEDULED SLOTS QUEUE ("Ожидают назначения даты") — Shown in Calendar views */}
        {isUnscheduledPanelOpen && viewMode !== 'kanban' && (
          <div className="w-full xl:w-84 shrink-0 bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden sticky top-4">
            <div className="p-4 bg-amber-50/60 border-b border-amber-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Ожидают назначения даты
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Перетащите на календарь или нажмите
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold tabular-nums">
                {unscheduledSlots.length}
              </span>
            </div>

            <div className="p-3 border-b border-neutral-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={unscheduledSearch}
                  onChange={(e) => setUnscheduledSearch(e.target.value)}
                  placeholder="Найти слот без даты..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-indigo-500 focus:ring-0"
                />
              </div>
            </div>

            <div className="p-3 space-y-2.5 max-h-[620px] overflow-y-auto custom-scrollbar">
              {unscheduledSlots.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-neutral-800">
                    Все слоты распределены!
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    У каждого активного слота назначена дата выхода.
                  </p>
                </div>
              ) : (
                unscheduledSlots.map((slot) => (
                  <div
                    key={slot.key}
                    draggable
                    onDragStart={() =>
                      setDraggedSlot({
                        integrationId: slot.integrationId,
                        slotNumber: slot.slotNumber,
                      })
                    }
                    onClick={() => openSlotModal(slot)}
                    className="p-3 rounded-xl border border-neutral-200/90 bg-white hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs text-neutral-900 group-hover:text-indigo-600 transition-colors">
                        {slot.bloggerName}
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-bold text-[10px] shrink-0 tabular-nums">
                        Слот #{slot.slotNumber}/{slot.totalSlotsInDeal}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span
                        className={`px-1.5 py-0.5 rounded border font-semibold ${PLATFORM_BADGE_STYLES[slot.platform] ||
                          'bg-neutral-100 text-neutral-700 border-neutral-200'
                          }`}
                      >
                        {slot.platform} · {slot.format}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-medium">
                        {slot.projectName}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                      <span className="text-neutral-500 truncate">
                        PR: <b className="text-neutral-700">{slot.prManager}</b>
                      </span>
                      <span className="text-indigo-600 font-semibold inline-flex items-center gap-0.5">
                        <span>Назначить</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================
          MODAL 1: ASSIGN SLOT TO SPECIFIC CALENDAR DATE (WHEN CLICKING '+' ON DAY)
         ======================================================================== */}
      {assigningToDate && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Назначить выход на {formatReadableDateRu(assigningToDate)}{' '}
                  <span className="text-indigo-600 tabular-nums">в {assigningToTime}</span>
                </h3>
                <p className="text-xs text-neutral-500">
                  Выберите слот блогера для постановки в график на это время
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningToDate(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-[420px] overflow-y-auto space-y-2">
              {projectScopedSlots.filter((s) => !s.isPublished).length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-500">
                  Нет доступных неопубликованных слотов.
                </div>
              ) : (
                projectScopedSlots
                  .filter((s) => !s.isPublished)
                  .sort((a, b) => {
                    if (!a.scheduledDate && b.scheduledDate) return -1;
                    if (a.scheduledDate && !b.scheduledDate) return 1;
                    return a.bloggerName.localeCompare(b.bloggerName, 'ru');
                  })
                  .map((slot) => (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() => {
                        const targetDate = assigningToDate;
                        const targetTime = assigningToTime;
                        setAssigningToDate(null);
                        openSlotModal(slot, targetDate, targetTime);
                      }}
                      className="w-full p-3 rounded-xl border border-neutral-200 hover:border-indigo-400 hover:bg-indigo-50/20 text-left flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-xs text-neutral-900">
                          {slot.bloggerName}{' '}
                          <span className="text-neutral-500 font-normal">
                            (Слот #{slot.slotNumber}/{slot.totalSlotsInDeal})
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          {slot.projectName} · {slot.platform} ({slot.format}) · PR:{' '}
                          {slot.prManager}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold shrink-0">
                        Выбрать
                      </span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 2: SLOT SCHEDULE & PUBLICATION EDITOR (PR MANAGER WORKSTATION)
         ======================================================================== */}
      {editingSlotKey && currentlyEditingSlot && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-xl w-full overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-5 sm:px-6 border-b border-neutral-100 bg-neutral-50/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-xs font-bold">
                      Слот #{currentlyEditingSlot.slotNumber} из{' '}
                      {currentlyEditingSlot.totalSlotsInDeal}
                    </span>
                    <span className="text-xs font-semibold text-neutral-500">
                      {currentlyEditingSlot.projectName}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900 mt-1">
                    {currentlyEditingSlot.bloggerName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSlotKey(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Switcher between Sibling Slots of the same Blogger Deal */}
              {siblingSlotsOfEditingDeal.length > 1 && (
                <div className="mt-3 pt-3 border-t border-neutral-200/70 flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[11px] font-semibold text-neutral-400 mr-1 shrink-0">
                    Слоты сделки:
                  </span>
                  {siblingSlotsOfEditingDeal.map((sib) => {
                    const active = sib.slotNumber === currentlyEditingSlot.slotNumber;
                    return (
                      <button
                        key={sib.key}
                        type="button"
                        onClick={() => openSlotModal(sib)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${active
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                          }`}
                      >
                        Слот #{sib.slotNumber}
                        {sib.scheduledDate ? ` (${sib.scheduledDate.slice(8, 10)}.${sib.scheduledDate.slice(5, 7)})` : ''}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveSlotSchedule} className="p-5 sm:p-6 space-y-5">
              {/* Row 1: Scheduled Date & Exact Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                    Плановая дата публикации *
                  </label>
                  <input
                    type="date"
                    value={modalScheduledDate}
                    onChange={(e) => setModalScheduledDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 tabular-nums"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {[
                      { label: 'Сегодня', ymd: todayYmd },
                      { label: 'Завтра', ymd: addDaysYmd(todayYmd, 1) },
                      { label: '+2 дня', ymd: addDaysYmd(todayYmd, 2) },
                      { label: '+3 дня', ymd: addDaysYmd(todayYmd, 3) },
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setModalScheduledDate(chip.ymd)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${modalScheduledDate === chip.ymd
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                            : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                          }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                    Точное время выхода (ЧЧ:ММ) *
                  </label>
                  <input
                    type="time"
                    value={modalScheduledTime}
                    onChange={(e) => setModalScheduledTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 tabular-nums"
                  />
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {QUICK_TIMES.map((tVal) => (
                      <button
                        key={tVal}
                        type="button"
                        onClick={() => setModalScheduledTime(tVal)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border tabular-nums transition-colors cursor-pointer ${modalScheduledTime === tVal
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                          }`}
                      >
                        {tVal}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Responsible PR Manager */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-neutral-700">
                    Ответственный PR-менеджер (отвечает за выход вовремя)
                  </label>
                  {currentUserName && modalPrManager !== currentUserName && (
                    <button
                      type="button"
                      onClick={() => setModalPrManager(currentUserName)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                    >
                      Назначить меня ({currentUserName})
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={prManagersList.includes(modalPrManager) ? modalPrManager : ''}
                    onChange={(e) => {
                      if (e.target.value) setModalPrManager(e.target.value);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-neutral-300 text-sm text-neutral-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  >
                    <option value="">Выберите из команды...</option>
                    {prManagersList.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={modalPrManager}
                    onChange={(e) => setModalPrManager(e.target.value)}
                    placeholder="Или введите имя PR-менеджера"
                    className="px-3.5 py-2 rounded-xl border border-neutral-300 text-sm text-neutral-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Row 3: Project, Platform & Format */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                    Проект слота
                  </label>
                  <select
                    value={modalProjectId}
                    onChange={(e) => setModalProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 bg-white"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                    Платформа
                  </label>
                  <select
                    value={modalPlatform}
                    onChange={(e) => setModalPlatform(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 bg-white"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Telegram">Telegram</option>
                    <option value="YouTube">YouTube</option>
                    <option value="TikTok">TikTok</option>
                    <option value="MAX">MAX</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                    Формат выхода
                  </label>
                  <input
                    type="text"
                    value={modalFormat}
                    onChange={(e) => setModalFormat(e.target.value)}
                    placeholder="Reels, Stories, Post..."
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900"
                  />
                </div>
              </div>

              {/* Row 4: Topic / Brief Note */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  Тема интеграции / комментарий к слоту
                </label>
                <input
                  type="text"
                  value={modalTopic}
                  onChange={(e) => setModalTopic(e.target.value)}
                  placeholder="Например: Промокод на скидку, анонс акции, обзор приложения..."
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm text-neutral-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              {/* Row 5: Slot Kanban Stage (Planned | Review | Published) + Fact Verification */}
              <div
                className={`p-4 rounded-2xl border transition-colors ${modalIsPublished
                    ? 'bg-emerald-50/60 border-emerald-300'
                    : modalStage === 'review'
                      ? 'bg-violet-50/60 border-violet-300'
                      : 'bg-neutral-50 border-neutral-200'
                  }`}
              >
                <div className="mb-3">
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                    Этап слота на Канбан-доске (Planned / Review / Published)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setModalStage('planned');
                        setModalIsPublished(false);
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${!modalIsPublished && modalStage === 'planned'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:border-indigo-300'
                        }`}
                    >
                      1. Planned
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalStage('review');
                        setModalIsPublished(false);
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${!modalIsPublished && modalStage === 'review'
                          ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:border-violet-300'
                        }`}
                    >
                      2. Review
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalStage('published');
                        setModalIsPublished(true);
                        if (!modalPublishedAt) {
                          setModalPublishedAt(modalScheduledDate || todayYmd);
                        }
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${modalIsPublished
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:border-emerald-300'
                        }`}
                    >
                      3. Published ✓
                    </button>
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-black/5">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={modalIsPublished}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setModalIsPublished(checked);
                        setModalStage(checked ? 'published' : 'planned');
                        if (checked && !modalPublishedAt) {
                          setModalPublishedAt(modalScheduledDate || todayYmd);
                        }
                      }}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-sm font-bold text-neutral-900">
                        Интеграция опубликована блогером (Факт выхода)
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        При включении сумма слота ({currentlyEditingSlot.pricePerSlot.toLocaleString('ru-RU')} сум) учитывается в расходе «По выходу»
                      </div>
                    </div>
                  </div>
                </label>

                {modalIsPublished && (
                  <div className="mt-4 pt-3 border-t border-emerald-200/70 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-emerald-900 mb-1">
                        Ссылка на вышедший пост / Reels / ролик
                      </label>
                      <input
                        type="url"
                        value={modalPublishedUrl}
                        onChange={(e) => setModalPublishedUrl(e.target.value)}
                        placeholder="https://instagram.com/reel/..."
                        className="w-full px-3 py-1.5 rounded-xl border border-emerald-300 bg-white text-xs sm:text-sm text-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-900 mb-1">
                        Дата выхода (Факт)
                      </label>
                      <input
                        type="date"
                        value={modalPublishedAt}
                        onChange={(e) => setModalPublishedAt(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-emerald-300 bg-white text-xs sm:text-sm text-neutral-900 tabular-nums"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                {currentlyEditingSlot.scheduledDate ? (
                  <button
                    type="button"
                    onClick={handleQuickClearDate}
                    disabled={isSavingSlot}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Убрать из календаря
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSlotKey(null)}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSlot}
                    className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingSlot ? 'Сохранение...' : 'Сохранить график слота'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 3: SET PROJECT MONTHLY LIMIT
         ======================================================================== */}
      {isLimitModalOpen && selectedProjectId !== 'all' && onUpdateProject && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">
                Лимит бюджета на месяц
              </h3>
              <button
                type="button"
                onClick={() => setIsLimitModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Сумма лимита (UZS)
              </label>
              <input
                type="number"
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                placeholder="Например: 50000000"
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm font-semibold tabular-nums"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLimitModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={async () => {
                  const p = projects.find(
                    (proj) => String(proj.id) === String(selectedProjectId)
                  );
                  if (p) {
                    const num = limitInput.trim() ? Number(limitInput) : null;
                    await onUpdateProject(p.id, p.name, p.description || '', num);
                  }
                  setIsLimitModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 cursor-pointer"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
