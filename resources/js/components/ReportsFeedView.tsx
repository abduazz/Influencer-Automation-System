import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Search, Trash2, X, ExternalLink, Link, LayoutGrid, Table, FileText, FileSpreadsheet, Send, FolderKanban, Edit3, User, Receipt, ArrowRight, Filter, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Project, Report, Integration, SlotConfig } from '../data/mockData';
import { Language, translations } from '../translations';
import { getCabinetUrl } from '../utils/url';
import { copyToClipboard } from '../utils/clipboard';
import { getPlatformBadgeClasses } from '../utils/platform';

interface ReportsFeedViewProps {
  projects: Project[];
  integrations: Integration[];
  reports: Report[];
  lang: Language;
  userRole?: string | null;
  currentUserName?: string | null;
  currentUserEmail?: string | null;
  onDeleteReport?: (id: string) => void | Promise<void>;
  onEditIntegration?: (id: string, updatedFields: Partial<Integration>) => void | Promise<void>;
  onDeleteIntegration?: (id: string) => void | Promise<void>;
  onEditReport?: (id: string, updatedFields: Partial<Report> & { amount?: number }) => void | Promise<void>;
  title?: string;
  description?: string;
  onNavigateToOtherExpenses?: () => void;
  onNavigateToReportsFeed?: () => void;
}

const findMatchingIntegration = (rep: Report, integrations: Integration[]): Integration | null => {
  if (rep.paymentType === 'other' || !rep.channelBlogger) return null;
  const cleanRepName = rep.channelBlogger.replace(/[@#]/g, '').trim().toLowerCase();
  
  return (
    integrations.find(i => 
      String(i.projectId) === String(rep.projectId) &&
      i.bloggerName.replace(/[@#]/g, '').trim().toLowerCase() === cleanRepName &&
      i.platform?.toLowerCase() === rep.platform?.toLowerCase()
    ) ||
    integrations.find(i => 
      i.bloggerName.replace(/[@#]/g, '').trim().toLowerCase() === cleanRepName
    ) ||
    null
  );
};

const getDefaultFormat = (plat: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok') => {
  if (plat === 'Instagram') return 'Stories';
  if (plat === 'Telegram') return 'Post';
  if (plat === 'YouTube') return 'Shorts';
  if (plat === 'TikTok') return 'VideoPost';
  return 'Post';
};

const groupSlots = (flatConfigs: SlotConfig[]): { quantity: number; platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok'; format: string }[] => {
  const groups: { quantity: number; platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok'; format: string }[] = [];
  flatConfigs.forEach(slot => {
    const existing = groups.find(g => g.platform === slot.platform && g.format === slot.format);
    if (existing) {
      existing.quantity += 1;
    } else {
      groups.push({ quantity: 1, platform: slot.platform, format: slot.format });
    }
  });
  return groups;
};

const getReportReceipts = (rep: Report | null | undefined): string[] => {
  if (!rep) return [];
  if (Array.isArray(rep.receipts) && rep.receipts.length > 0) {
    return rep.receipts.filter(Boolean);
  }
  if (rep.receipt) {
    const trimmed = rep.receipt.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean);
        }
      } catch {}
    }
    return [rep.receipt];
  }
  return [];
};

const getTelegramReportUrl = (rep: Report | null | undefined, projects: Project[]): string => {
  if (!rep) return 'https://t.me/c/4329107459';
  if (rep.telegramMessageUrl) {
    return rep.telegramMessageUrl;
  }

  let threadId: string | undefined;
  if (rep.projectId) {
    const p = projects.find(proj => String(proj.id) === String(rep.projectId));
    threadId = p?.telegramThreadId;
  } else if (rep.slotsConfig && rep.slotsConfig.length > 0) {
    for (const s of rep.slotsConfig) {
      if (s.projectId) {
        const p = projects.find(proj => String(proj.id) === String(s.projectId));
        if (p?.telegramThreadId) {
          threadId = p.telegramThreadId;
          break;
        }
      }
    }
  }

  if (threadId) {
    return threadId.startsWith('http') ? threadId : `https://t.me/c/4329107459/${threadId}`;
  }

  return 'https://t.me/c/4329107459';
};

export default function ReportsFeedView({
  projects,
  integrations,
  reports,
  lang,
  userRole,
  currentUserName,
  currentUserEmail,
  onDeleteReport,
  onEditIntegration,
  onDeleteIntegration,
  onEditReport,
  title,
  description,
  onNavigateToOtherExpenses,
  onNavigateToReportsFeed
}: ReportsFeedViewProps) {
  const t = translations[lang];
  const [copiedCabinetRepId, setCopiedCabinetRepId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlProj = params.get('project') || params.get('projectId');
      if (urlProj) return urlProj;
      const saved = localStorage.getItem('reports_feed_selected_project_id');
      if (saved) return saved;
    }
    return 'all';
  });
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [activeReceiptIndex, setActiveReceiptIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    const saved = localStorage.getItem('reports_feed_view_mode');
    return (saved === 'grid' || saved === 'table') ? saved : 'table';
  });
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // State for editing integration modal
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [bloggerName, setBloggerName] = useState('');
  const [bloggerPageLink, setBloggerPageLink] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [platform, setPlatform] = useState<'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok'>('Telegram');
  const [referralLink, setReferralLink] = useState('');
  const [pricePerSlot, setPricePerSlot] = useState<number>(150);
  const [slotsCount, setSlotsCount] = useState<number>(1);
  const [calculatedTotal, setCalculatedTotal] = useState<number>(150);
  const [customizeSlots, setCustomizeSlots] = useState<boolean>(false);
  const [slotGroups, setSlotGroups] = useState<{ quantity: number; platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok'; format: string }[]>([]);

  // State for editing "other" expense report
  const [editingOtherReport, setEditingOtherReport] = useState<Report | null>(null);
  const [editOtherDestination, setEditOtherDestination] = useState('');
  const [editOtherAmount, setEditOtherAmount] = useState<number>(0);
  const [editOtherDate, setEditOtherDate] = useState('');
  const [editOtherProjectId, setEditOtherProjectId] = useState<string>('');
  const [editOtherComments, setEditOtherComments] = useState('');
  const [reportComments, setReportComments] = useState('');

  useEffect(() => {
    setCalculatedTotal(pricePerSlot * slotsCount);
  }, [pricePerSlot, slotsCount]);

  const openEditForReport = (rep: Report) => {
    setSelectedReport(null);

    if (rep.paymentType === 'other') {
      setEditingOtherReport(rep);
      setEditOtherDestination(rep.destination || '');
      setEditOtherAmount(rep.totalAmount || rep.paidAmount || 0);
      setEditOtherDate(rep.date || '');
      setEditOtherProjectId(rep.projectId ? String(rep.projectId) : '');
      setEditOtherComments(rep.comments || '');
      return;
    }

    const matching = findMatchingIntegration(rep, integrations);
    setEditingReport(rep);
    setEditingIntegration(matching);

    // CRITICAL FIX: The user is editing this specific REPORT.
    // The report has its own slots count (e.g. 5) and price per slot.
    // The integration holds cumulative totals across all reports (e.g. 17).
    // Always initialize the form strictly from the report's own slots and pricing!
    const repSlotsCount = Number(rep.slotsCount) > 0 ? Number(rep.slotsCount) : 1;
    const repPricePerSlot = Number(rep.pricePerSlot) || (matching ? Number(matching.pricePerSlot) : 0);

    setBloggerName(rep.channelBlogger || matching?.bloggerName || '');
    setBloggerPageLink(rep.bloggerPageLink || matching?.bloggerPageLink || '');
    setTelegramUsername(matching?.telegramUsername || '');
    setStartDate(rep.date || matching?.startDate || '');
    setEndDate(matching?.endDate || rep.date || '');
    setPlatform((rep.platform as any) || matching?.platform || 'Telegram');
    setReferralLink(rep.destination || matching?.referralLink || '');
    setPricePerSlot(repPricePerSlot);
    setSlotsCount(repSlotsCount);
    setCalculatedTotal(repPricePerSlot * repSlotsCount);
    setReportComments(rep.comments || '');

    // Configure slot groups strictly from the REPORT's slotsConfig
    if (rep.slotsConfig && rep.slotsConfig.length > 0) {
      setCustomizeSlots(true);
      setSlotGroups(groupSlots(rep.slotsConfig));
    } else {
      setCustomizeSlots(false);
      setSlotGroups([]);
    }
  };

  const handleDeleteReportOrIntegration = async (rep: Report) => {
    const confirmMsg = rep.paymentType === 'other'
      ? (lang === 'ru' ? 'Вы уверены, что хотите удалить этот расход?' : lang === 'uz' ? 'Ushbu xarajatni o‘chirishni xohlaysizmi?' : 'Are you sure you want to delete this expense?')
      : (lang === 'ru' ? 'Вы уверены, что хотите удалить этот отчет?' : lang === 'uz' ? 'Ushbu hisobotni o‘chirishni xohlaysizmi?' : 'Are you sure you want to delete this report?');

    if (!window.confirm(confirmMsg)) return;

    if (onDeleteReport) {
      await onDeleteReport(rep.id);
    } else {
      const matching = findMatchingIntegration(rep, integrations);
      if (matching && onDeleteIntegration) {
        await onDeleteIntegration(matching.id);
      }
    }
    setSelectedReport(null);
  };

  const handleSaveIntegrationEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bloggerName.trim()) return;

    let finalSlotsConfig: SlotConfig[] = [];
    const targetProjId = editingReport?.projectId || editingIntegration?.projectId || null;

    if (customizeSlots && slotGroups.length > 0) {
      for (const group of slotGroups) {
        for (let i = 0; i < group.quantity; i++) {
          finalSlotsConfig.push({
            platform: group.platform,
            format: group.format,
            projectId: targetProjId,
          });
        }
      }
    } else if (editingReport?.slotsConfig && editingReport.slotsConfig.length > 0) {
      finalSlotsConfig = [...editingReport.slotsConfig];
      if (finalSlotsConfig.length < slotsCount) {
        for (let i = finalSlotsConfig.length; i < slotsCount; i++) {
          finalSlotsConfig.push({
            platform: platform,
            format: getDefaultFormat(platform),
            projectId: targetProjId,
          });
        }
      } else if (finalSlotsConfig.length > slotsCount) {
        finalSlotsConfig = finalSlotsConfig.slice(0, slotsCount);
      }
    }

    // 1. Update the Report itself
    if (editingReport && onEditReport) {
      await onEditReport(editingReport.id, {
        channelBlogger: bloggerName,
        bloggerPageLink,
        platform,
        destination: referralLink,
        date: startDate || editingReport.date,
        pricePerSlot,
        slotsCount,
        paidSlotsCount: slotsCount,
        totalAmount: pricePerSlot * slotsCount,
        paidAmount: pricePerSlot * slotsCount,
        comments: reportComments,
        slotsConfig: finalSlotsConfig,
      });
    }

    // 2. If an integration exists, update only blogger profile fields (name, links, etc.)
    // Do NOT overwrite the integration's cumulative slotsCount! The backend automatically syncs integration slots and totals.
    if (editingIntegration && onEditIntegration) {
      const integrationUpdate: Partial<Integration> = {
        bloggerName,
        bloggerPageLink,
        telegramUsername: telegramUsername.trim() || undefined,
        platform,
        referralLink,
        pricePerSlot,
      };
      await onEditIntegration(editingIntegration.id, integrationUpdate);
    }

    setEditingIntegration(null);
    setEditingReport(null);
  };

  const handleSaveOtherExpenseEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOtherReport || !onEditReport) return;

    await onEditReport(editingOtherReport.id, {
      destination: editOtherDestination,
      amount: editOtherAmount,
      date: editOtherDate,
      projectId: editOtherProjectId || undefined,
      comments: editOtherComments,
    });

    setEditingOtherReport(null);
  };

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    if (typeof window !== 'undefined') {
      if (projId === 'all') {
        localStorage.removeItem('reports_feed_selected_project_id');
      } else {
        localStorage.setItem('reports_feed_selected_project_id', projId);
      }
    }
  };

  const toggleViewMode = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('reports_feed_view_mode', mode);
  };

  const selectedProject = useMemo(() => {
    if (selectedProjectId === 'all') return null;
    return projects.find(p => String(p.id) === String(selectedProjectId)) || null;
  }, [projects, selectedProjectId]);

  const hasActiveFilters = selectedProjectId !== 'all' || Boolean(filterStartDate) || Boolean(filterEndDate);
  const activeFiltersCount = (selectedProjectId !== 'all' ? 1 : 0) + (filterStartDate || filterEndDate ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedProjectId('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setSearchQuery('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('reports_feed_selected_project_id');
    }
  };

  // Filtering reports based on search query, project filter, and date period
  const filteredReports = useMemo(() => {
    return reports.filter(rep => {
      const resolvedProject = projects.find(p => String(p.id) === String(rep.projectId));
      const multiProjectNames = rep.slotsConfig
        ? rep.slotsConfig.map(s => s.projectId ? projects.find(p => String(p.id) === String(s.projectId))?.name : '').filter(Boolean).join(' ')
        : '';
      const projectName = (resolvedProject?.name || rep.projectName || '') + ' ' + multiProjectNames;
      const blogger = rep.channelBlogger || '';
      const destination = rep.destination || '';
      const comments = rep.comments || '';
      const createdBy = rep.createdBy || '';
      const searchLower = searchQuery.toLowerCase().trim();

      const matchesSearch = !searchLower || (
        (rep.id != null && String(rep.id).includes(searchLower.replace(/^#/, ''))) ||
        projectName.toLowerCase().includes(searchLower) ||
        blogger.toLowerCase().includes(searchLower) ||
        destination.toLowerCase().includes(searchLower) ||
        comments.toLowerCase().includes(searchLower) ||
        createdBy.toLowerCase().includes(searchLower)
      );

      const matchesDate = (!filterStartDate || rep.date >= filterStartDate) &&
                          (!filterEndDate || rep.date <= filterEndDate);

      const matchesProject = selectedProjectId === 'all' ||
        (rep.projectId && String(rep.projectId) === String(selectedProjectId)) ||
        (Array.isArray(rep.slotsConfig) && rep.slotsConfig.some(s => s.projectId && String(s.projectId) === String(selectedProjectId))) ||
        (Boolean(selectedProject && rep.projectName && rep.projectName.trim().toLowerCase() === selectedProject.name.trim().toLowerCase()));

      return matchesSearch && matchesDate && matchesProject;
    });
  }, [reports, projects, searchQuery, filterStartDate, filterEndDate, selectedProjectId, selectedProject]);

  const handleExportExcel = () => {
    if (filteredReports.length === 0) {
      alert(
        lang === 'ru' ? 'Нет записей для экспорта по выбранным фильтрам.' :
        lang === 'uz' ? 'Tanlangan filtrlar bo‘yicha eksport qilish uchun yozuvlar yo‘q.' :
        'No records to export matching the selected filters.'
      );
      return;
    }

    const hasOther = filteredReports.some(r => r.paymentType === 'other');
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (hasOther) {
      // Other expenses columns
      headers = [
        '№',
        'ID',
        lang === 'ru' ? 'Назначение' : lang === 'uz' ? 'Vazifasi' : 'Purpose / Destination',
        lang === 'ru' ? 'Получатель / Расход' : lang === 'uz' ? 'Qabul qiluvchi / Xarajat' : 'Recipient / Expense Type',
        lang === 'ru' ? 'Платформа' : lang === 'uz' ? 'Platforma' : 'Platform',
        lang === 'ru' ? 'Сумма (UZS)' : lang === 'uz' ? 'Summa (UZS)' : 'Amount (UZS)',
        lang === 'ru' ? 'Дата' : lang === 'uz' ? 'Sana' : 'Date',
        lang === 'ru' ? 'Комментарии' : lang === 'uz' ? 'Izohlar' : 'Comments',
        lang === 'ru' ? 'Проект' : lang === 'uz' ? 'Loyiha' : 'Project',
        lang === 'ru' ? 'Создан кем' : lang === 'uz' ? 'Kim tomonidan' : 'Created By'
      ];

      rows = filteredReports.map((rep, idx) => {
        const resolvedProject = projects.find(p => String(p.id) === String(rep.projectId));
        const projName = resolvedProject ? resolvedProject.name : (rep.projectName || '—');
        return [
          idx + 1,
          `#${rep.id}`,
          rep.destination || '—',
          rep.channelBlogger || '—',
          '—',
          Number(rep.totalAmount) || 0,
          rep.date,
          rep.comments || '',
          projName,
          rep.createdBy || ''
        ];
      });
    } else {
      // Blogger integrations columns
      headers = [
        '№',
        'ID',
        lang === 'ru' ? 'Назначение / Реф. ссылка' : lang === 'uz' ? 'Vazifasi / Referal havola' : 'Purpose / Referral Link',
        lang === 'ru' ? 'Канал / Блогер' : lang === 'uz' ? 'Kanal / Blogger' : 'Channel / Blogger',
        lang === 'ru' ? 'Платформа' : lang === 'uz' ? 'Platforma' : 'Platform',
        lang === 'ru' ? 'Сумма (UZS)' : lang === 'uz' ? 'Jami summa (UZS)' : 'Total Amount (UZS)',
        lang === 'ru' ? 'Дата отчета' : lang === 'uz' ? 'Hisobot sanasi' : 'Report Date',
        lang === 'ru' ? 'Комментарии' : lang === 'uz' ? 'Izohlar' : 'Comments',
        lang === 'ru' ? 'Проект' : lang === 'uz' ? 'Loyiha' : 'Project',
        lang === 'ru' ? 'Тип оплаты' : lang === 'uz' ? 'To\'lov turi' : 'Payment Type',
        lang === 'ru' ? 'Всего слотов' : lang === 'uz' ? 'Jami slotlar' : 'Total Slots',
        lang === 'ru' ? 'Оплачено слотов' : lang === 'uz' ? 'To\'langan slotlar' : 'Paid Slots',
        lang === 'ru' ? 'Цена за слот (UZS)' : lang === 'uz' ? 'Slot narxi (UZS)' : 'Price per Slot (UZS)',
        lang === 'ru' ? 'Оплачено (UZS)' : lang === 'uz' ? 'To\'langan summa (UZS)' : 'Paid Amount (UZS)',
        lang === 'ru' ? 'Создан кем' : lang === 'uz' ? 'Kim tomonidan' : 'Created By',
        lang === 'ru' ? 'Ссылка на кабинет' : lang === 'uz' ? 'Kabinet havolasi' : 'Cabinet Link'
      ];

      rows = filteredReports.map((rep, idx) => {
        let projName = '—';
        if (rep.projectId) {
          const p = projects.find(proj => String(proj.id) === String(rep.projectId));
          projName = p ? p.name : (rep.projectName || '—');
        } else if (rep.slotsConfig && rep.slotsConfig.length > 0) {
          const counts: { [name: string]: number } = {};
          rep.slotsConfig.forEach((s) => {
            if (s.projectId) {
              const p = projects.find(proj => String(proj.id) === String(s.projectId));
              const name = p ? p.name : `Proj #${s.projectId}`;
              counts[name] = (counts[name] || 0) + 1;
            }
          });
          projName = Object.entries(counts).map(([name, cnt]) => `${name}: ${cnt}`).join(', ');
        } else if (rep.projectName) {
          projName = rep.projectName;
        }

        const isOther = rep.paymentType === 'other';
        const paymentTypeText = rep.paymentType === 'prepaid' ? (lang === 'ru' ? 'Предоплата' : lang === 'uz' ? 'Bo\'nak' : 'Prepayment')
          : rep.paymentType === 'full' ? (lang === 'ru' ? 'Полная оплата' : lang === 'uz' ? 'To\'liq to\'lov' : 'Full Payment')
          : rep.paymentType === 'remaining' ? (lang === 'ru' ? 'Доплата' : lang === 'uz' ? 'Qoldiq to\'lov' : 'Remaining Pay')
          : (lang === 'ru' ? 'Прочее' : lang === 'uz' ? 'Boshqa' : 'Other');

        const matchingInt = isOther ? null : (
          integrations.find(i => 
            String(i.projectId) === String(rep.projectId) &&
            i.bloggerName.toLowerCase() === rep.channelBlogger?.toLowerCase() &&
            i.platform.toLowerCase() === rep.platform?.toLowerCase()
          ) || integrations.find(i => 
            i.bloggerName.toLowerCase() === rep.channelBlogger?.toLowerCase()
          )
        );
        const token = matchingInt?.bloggerCabinetToken || matchingInt?.id;
        const cabinetUrl = token ? getCabinetUrl(token) : '';

        return [
          idx + 1,
          `#${rep.id}`,
          rep.destination || '—',
          rep.channelBlogger || '—',
          rep.platform || '—',
          Number(rep.totalAmount) || 0,
          rep.date,
          rep.comments || '',
          projName,
          paymentTypeText,
          Number(rep.slotsCount) || 0,
          Number(rep.paidSlotsCount) || 0,
          Number(rep.pricePerSlot) || 0,
          Number(rep.paidAmount) || 0,
          rep.createdBy || '—',
          cabinetUrl || '—'
        ];
      });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const projectSlug = selectedProject ? `_${selectedProject.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_')}` : '';
    const fileTitle = hasOther ? `Other_Expenses_Report${projectSlug}_${dateStr}` : `Blogger_Integrations_Report${projectSlug}_${dateStr}`;
    const reportHeading = hasOther 
      ? (lang === 'ru' ? 'Отчет по прочим расходам' : lang === 'uz' ? 'Boshqa xarajatlar hisoboti' : 'Other Expenses Report') 
      : (lang === 'ru' ? 'Отчет по интеграциям с блогерами' : lang === 'uz' ? 'Blogger integratsiyalari hisoboti' : 'Blogger Integrations Report');
    const projectHeadingPart = selectedProject ? ` (${selectedProject.name})` : '';

    const filterInfo = [
      selectedProject ? `${lang === 'ru' ? 'Проект' : lang === 'uz' ? 'Loyiha' : 'Project'}: ${selectedProject.name}` : null,
      (filterStartDate || filterEndDate) ? `${lang === 'ru' ? 'Период' : lang === 'uz' ? 'Davr' : 'Period'}: ${filterStartDate || '...'} — ${filterEndDate || '...'}` : null,
      searchQuery ? `${lang === 'ru' ? 'Поиск' : lang === 'uz' ? 'Qidiruv' : 'Search'}: "${searchQuery}"` : null,
      `${lang === 'ru' ? 'Экспортировано записей' : lang === 'uz' ? 'Eksport qilingan yozuvlar' : 'Exported records'}: ${filteredReports.length}`
    ].filter(Boolean).join(' | ');

    // Build worksheet data
    const aoa: (string | number)[][] = [
      [`${reportHeading}${projectHeadingPart} (${dateStr})`],
      ...(filterInfo ? [[filterInfo]] : []),
      [],
      headers,
      ...rows
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-fit column widths
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      rows.forEach(r => {
        const val = r[i] != null ? String(r[i]) : '';
        if (val.length > maxLen) maxLen = Math.min(val.length, 60);
      });
      return { wch: Math.max(maxLen + 3, 10) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, hasOther ? 'Expenses' : 'Reports');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileTitle}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderProjectCell = (rep: Report) => {
    if (rep.projectId) {
      const p = projects.find(proj => String(proj.id) === String(rep.projectId));
      return p ? p.name : (rep.projectName || '—');
    }

    if (rep.slotsConfig && rep.slotsConfig.length > 0) {
      const counts: { [name: string]: number } = {};
      let reserve = 0;

      rep.slotsConfig.forEach((s) => {
        if (s.projectId) {
          const p = projects.find(proj => String(proj.id) === String(s.projectId));
          const name = p ? p.name : `Proj #${s.projectId}`;
          counts[name] = (counts[name] || 0) + 1;
        } else {
          reserve++;
        }
      });

      const entries = Object.entries(counts);
      if (entries.length > 0 || reserve > 0) {
        return (
          <div className="flex flex-wrap gap-1 items-center">
            {entries.map(([pName, cnt]) => (
              <span key={pName} className="px-1.5 py-0.5 text-[9px] font-bold bg-neutral-100 border border-neutral-200 rounded text-neutral-800">
                {pName}: {cnt}
              </span>
            ))}
            {reserve > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 border border-amber-200 rounded text-amber-800">
                {lang === 'ru' ? 'Резерв' : lang === 'uz' ? 'Zahira' : 'Reserve'}: {reserve}
              </span>
            )}
          </div>
        );
      }
    }

    return rep.projectName || '—';
  };

  return (
    <div className="space-y-3 md:space-y-4 max-w-7xl mx-auto text-neutral-900">
      {/* Top Action Bar (Clean button to navigate to other expenses / reports feed) */}
      {(onNavigateToOtherExpenses || onNavigateToReportsFeed) && (
        <div className="flex items-center justify-end gap-2 pt-0.5">

          <div className="flex items-center gap-1.5">
            {onNavigateToOtherExpenses && (
              <button
                type="button"
                onClick={onNavigateToOtherExpenses}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 border border-amber-200 rounded-xl text-[11px] font-bold transition shadow-3xs cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-amber-700" />
                <span>{lang === 'ru' ? 'Прочие расходы' : lang === 'uz' ? 'Boshqa xarajatlar' : 'Other Expenses'}</span>
                <ArrowRight className="w-3 h-3 text-amber-600" />
              </button>
            )}

            {onNavigateToReportsFeed && (
              <button
                type="button"
                onClick={onNavigateToReportsFeed}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 border border-neutral-200 rounded-xl text-[11px] font-bold transition shadow-3xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-neutral-700" />
                <span>{lang === 'ru' ? 'Лента отчетов' : lang === 'uz' ? 'Hisobotlar tasmasi' : 'Reports Feed'}</span>
                <ArrowRight className="w-3 h-3 text-neutral-600" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="border-b border-neutral-200 pb-3 md:pb-5 text-left flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Search Bar + Mobile Filter Toggle Button */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-neutral-400" />
            </span>
            <input
              type="text"
              placeholder={lang === 'ru' ? 'Поиск отчетов (ID, блогер, проект)...' : lang === 'uz' ? 'Qidirish (ID, blogger, loyiha)...' : 'Search reports (ID, blogger, project)...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-2 bg-white border border-neutral-200 focus:bg-white rounded-xl text-xs focus:outline-none focus:border-black text-black shadow-3xs transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-neutral-400 hover:text-black cursor-pointer"
                title={lang === 'ru' ? 'Очистить поиск' : 'Clear search'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={`md:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition shadow-3xs cursor-pointer shrink-0 ${
              hasActiveFilters || showMobileFilters
                ? 'bg-black text-white border-black'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100'
            }`}
            title={lang === 'ru' ? 'Фильтры' : lang === 'uz' ? 'Filtrlar' : 'Filters'}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{lang === 'ru' ? 'Фильтры' : lang === 'uz' ? 'Filtrlar' : 'Filters'}</span>
            {hasActiveFilters && (
              <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                showMobileFilters ? 'bg-white text-black' : 'bg-black text-white'
              }`}>
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Collapsible Filter Panel on Mobile / Always visible on Desktop */}
        <div className={`${showMobileFilters ? 'flex flex-col gap-2.5 p-3 bg-neutral-50 border border-neutral-200 rounded-2xl md:p-0 md:bg-transparent md:border-none' : 'hidden'} md:flex md:flex-row md:items-center md:gap-3 w-full md:w-auto`}>
          {/* Project Filter Dropdown */}
          <div className="flex items-center justify-between gap-1.5 bg-white md:bg-neutral-50 px-2.5 py-1.5 rounded-xl border border-neutral-200 text-xs text-neutral-600 shadow-3xs w-full md:w-auto">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <FolderKanban className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">
                {lang === 'ru' ? 'Проект:' : lang === 'uz' ? 'Loyiha:' : 'Project:'}
              </span>
              <select
                value={selectedProjectId}
                onChange={(e) => handleSelectProject(e.target.value)}
                className="bg-transparent border-none p-0 text-xs font-semibold text-neutral-700 focus:outline-none cursor-pointer w-full md:max-w-[140px] lg:max-w-[180px] truncate"
                title={lang === 'ru' ? 'Фильтр по проекту' : lang === 'uz' ? 'Loyiha bo\'yicha filter' : 'Filter by project'}
              >
                <option value="all">
                  {t.kanbanAllProjects || (lang === 'ru' ? 'Все проекты' : lang === 'uz' ? 'Barcha loyihalar' : 'All Projects')}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedProjectId !== 'all' && (
              <button
                type="button"
                onClick={() => handleSelectProject('all')}
                className="p-0.5 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-black transition cursor-pointer shrink-0"
                title={lang === 'ru' ? 'Сбросить проект' : lang === 'uz' ? 'Loyihani tozalash' : 'Clear project'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date range filters */}
          <div className="flex items-center justify-between gap-1.5 bg-white md:bg-neutral-50 px-2.5 py-1.5 rounded-xl border border-neutral-200 text-xs text-neutral-600 shadow-3xs w-full md:w-auto">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0 md:hidden" />
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">
                {lang === 'ru' ? 'Период:' : lang === 'uz' ? 'Davr:' : 'Period:'}
              </span>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="bg-transparent border-none p-0 text-[11px] font-medium w-full md:w-[95px] text-neutral-700 focus:outline-none"
                  title={t.startDateColumn}
                />
                <span className="text-neutral-300 select-none text-[10px] shrink-0">—</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="bg-transparent border-none p-0 text-[11px] font-medium w-full md:w-[95px] text-neutral-700 focus:outline-none"
                  title={t.endDateColumn}
                />
              </div>
            </div>
            {(filterStartDate || filterEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setFilterStartDate('');
                  setFilterEndDate('');
                }}
                className="p-0.5 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-black transition cursor-pointer shrink-0"
                title={lang === 'ru' ? 'Сбросить даты' : lang === 'uz' ? 'Sanalarni tozalash' : 'Clear dates'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Export to Excel & Reset button on Mobile */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleExportExcel}
              disabled={filteredReports.length === 0}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition shadow-3xs hover:shadow-2xs shrink-0 ${
                filteredReports.length === 0
                  ? 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed opacity-60'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 hover:text-emerald-800 cursor-pointer'
              }`}
              title={`${t.exportExcel} (${filteredReports.length})`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.exportExcel}</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                filteredReports.length === 0 ? 'bg-neutral-200 text-neutral-500' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {filteredReports.length}
              </span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="md:hidden px-3 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
              >
                {lang === 'ru' ? 'Сбросить' : lang === 'uz' ? 'Tozalash' : 'Reset'}
              </button>
            )}
          </div>

          {/* Table / Grid view switcher (desktop only) */}
          <div className="hidden md:flex bg-neutral-100 p-0.5 rounded-xl border border-neutral-200 shrink-0">
            <button
              onClick={() => toggleViewMode('table')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-black shadow-3xs border border-neutral-200'
                  : 'text-neutral-500 hover:text-black'
              }`}
              title={t.viewTable}
            >
              <Table className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleViewMode('grid')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-black shadow-3xs border border-neutral-200'
                  : 'text-neutral-500 hover:text-black'
              }`}
              title={t.viewGrid}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Table of Reports (Desktop only when viewMode is table) */}
      {viewMode === 'table' && filteredReports.length > 0 && (
        <div className="hidden md:block overflow-hidden bg-white border border-neutral-200 rounded-2xl shadow-3xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold text-neutral-500 uppercase tracking-wider select-none">
                  <th className="px-4 py-3 font-extrabold text-center w-16">{t.tableHeaderId || 'ID'}</th>
                  <th className="px-5 py-3 font-extrabold">{t.reportDateField}</th>
                  <th className="px-5 py-3 font-extrabold">{t.campaignTitleField}</th>
                  <th className="px-5 py-3 font-extrabold">{t.tableHeaderBlogger}</th>
                  <th className="px-5 py-3 font-extrabold">{t.platformColumn}</th>
                  <th className="px-5 py-3 font-extrabold">{t.tableHeaderDetails}</th>
                  <th className="px-5 py-3 font-extrabold">{t.createdByField}</th>
                  <th className="px-5 py-3 font-extrabold text-right">{t.totalSumColumn}</th>
                  <th className="px-5 py-3 text-center font-extrabold">{t.tableHeaderReceipt}</th>
                  <th className="px-5 py-3 text-center font-extrabold">{t.tableHeaderTelegram || 'Telegram'}</th>
                  {userRole !== 'executive' && (
                    <th className="px-5 py-3 text-center font-extrabold">{t.tableHeaderCabinet}</th>
                  )}
                  {(onDeleteReport || onEditIntegration || userRole === 'super_admin') && (
                    <th className="px-5 py-3 text-center font-extrabold">{t.tableHeaderActions}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {filteredReports.map((rep) => {
                  const isOther = rep.paymentType === 'other';

                  // Match report to integration for blogger link lookup
                  const matchingInt = findMatchingIntegration(rep, integrations);

                  const token = matchingInt?.bloggerCabinetToken || matchingInt?.id;
                  const cabinetUrl = token ? getCabinetUrl(token) : '';

                  return (
                    <tr
                      key={rep.id}
                      onClick={() => setSelectedReport(rep)}
                      className="hover:bg-neutral-50/80 transition-colors duration-150 cursor-pointer group"
                    >
                      {/* ID */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className="font-mono font-bold text-[11px] text-neutral-600 bg-neutral-100/90 px-2 py-0.5 rounded border border-neutral-200/80">
                          #{rep.id}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 whitespace-nowrap text-neutral-500 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          {rep.date}
                        </span>
                      </td>

                      {/* Project */}
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-neutral-700">
                        {renderProjectCell(rep)}
                      </td>

                      {/* Blogger / Expense */}
                      <td className="px-5 py-4 whitespace-nowrap font-extrabold text-black uppercase tracking-tight">
                        {isOther ? t.paymentOther : rep.channelBlogger}
                      </td>

                      {/* Platform */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isOther ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          <span className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider ${getPlatformBadgeClasses(rep.platform)}`}>
                            {rep.platform}
                          </span>
                        )}
                      </td>

                      {/* Details / Slots */}
                      <td className="px-5 py-4 max-w-xs truncate text-neutral-600 font-medium">
                        {isOther ? (
                          <span className="italic text-neutral-500">{rep.destination}</span>
                        ) : (
                          <span>
                            {rep.slotsCount} slots × {Number(rep.pricePerSlot).toLocaleString('ru-RU')}
                          </span>
                        )}
                      </td>

                      {/* Created By */}
                      <td className="px-5 py-4 whitespace-nowrap text-neutral-500 font-medium">
                        {rep.createdBy || '—'}
                      </td>

                      {/* Total Sum */}
                      <td className="px-5 py-4 whitespace-nowrap text-right font-black text-black">
                        {Number(rep.totalAmount).toLocaleString('ru-RU')} UZS
                      </td>

                      {/* Receipt */}
                      <td className="px-5 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const repReceipts = getReportReceipts(rep);
                          if (repReceipts.length === 0) {
                            return <span className="text-neutral-300">—</span>;
                          }
                          return (
                            <button
                              onClick={() => {
                                setSelectedReport(rep);
                                setActiveReceiptIndex(0);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-md transition cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-neutral-500" />
                              <span>
                                {lang === 'ru' 
                                  ? (repReceipts.length > 1 ? `Чеки (${repReceipts.length})` : 'Чек') 
                                  : lang === 'uz' 
                                    ? (repReceipts.length > 1 ? `Cheklar (${repReceipts.length})` : 'Chek') 
                                    : (repReceipts.length > 1 ? `Receipts (${repReceipts.length})` : 'View')}
                              </span>
                            </button>
                          );
                        })()}
                      </td>

                      {/* Telegram Quick Jump Link */}
                      <td className="px-5 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={getTelegramReportUrl(rep, projects)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md transition cursor-pointer shadow-2xs hover:shadow-xs"
                          title={lang === 'ru' ? 'Перейти к отчету в Telegram' : lang === 'uz' ? 'Telegram hisobotiga o‘tish' : 'Jump to report in Telegram'}
                        >
                          <Send className="w-3 h-3 text-sky-500" />
                          <span>Telegram</span>
                          <ExternalLink className="w-2.5 h-2.5 text-sky-400" />
                        </a>
                      </td>

                      {/* Cabinet (Hidden for executive role) */}
                      {userRole !== 'executive' && (
                        <td className="px-5 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          {cabinetUrl ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await copyToClipboard(cabinetUrl);
                                setCopiedCabinetRepId(rep.id);
                                setTimeout(() => setCopiedCabinetRepId(null), 2000);
                              }}
                              className={`inline-flex items-center justify-center p-1.5 border rounded-lg transition shadow-2xs cursor-pointer ${
                                copiedCabinetRepId === rep.id
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'text-black hover:bg-neutral-100 border-neutral-200'
                              }`}
                              title={copiedCabinetRepId === rep.id ? (lang === 'ru' ? 'Скопировано!' : 'Copied!') : (lang === 'ru' ? 'Копировать ссылку' : lang === 'uz' ? 'Havolani nusxalash' : 'Copy cabinet link')}
                            >
                              {copiedCabinetRepId === rep.id ? <Check className="w-3.5 h-3.5 text-white" /> : <Link className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                      )}

                      {/* Actions */}
                      {(onDeleteReport || onEditIntegration || userRole === 'super_admin') && (
                        <td className="px-5 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {onEditIntegration && (
                              <button
                                type="button"
                                onClick={() => openEditForReport(rep)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
                                title={lang === 'ru' ? 'Редактировать' : lang === 'uz' ? 'Tahrirlash' : 'Edit'}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            {userRole === 'super_admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteReportOrIntegration(rep)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                                title={lang === 'ru' ? 'Удалить' : lang === 'uz' ? 'O‘chirish' : 'Delete'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid of Report Cards (Visible on mobile, or when viewMode is grid) */}
      <div className={`${viewMode === 'table' ? 'md:hidden' : ''} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4`}>
        {filteredReports.map((rep) => {
          const isOther = rep.paymentType === 'other';

          // Match report to integration for blogger link lookup
          const matchingInt = findMatchingIntegration(rep, integrations);

          const token = matchingInt?.bloggerCabinetToken || matchingInt?.id;
          const cabinetUrl = token ? getCabinetUrl(token) : '';

          return (
            <div
              key={rep.id}
              onClick={() => setSelectedReport(rep)}
              className="p-4 bg-white border border-neutral-200/80 hover:border-black/50 rounded-2xl shadow-3xs hover:shadow-xs transition-all duration-150 flex flex-col justify-between gap-3 group cursor-pointer text-left"
            >
              <div>
                {/* Card Top: Badges, Date & Actions */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-mono font-bold text-[9px] text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200/80">
                      #{rep.id}
                    </span>
                    {!isOther ? (
                      <span className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wide ${getPlatformBadgeClasses(rep.platform)}`}>
                        {rep.platform}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wide bg-neutral-100 text-neutral-700">
                        {t.paymentOther}
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200/60 truncate max-w-[130px]">
                      {renderProjectCell(rep)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-medium text-neutral-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-neutral-400" />
                      {rep.date}
                    </span>
                    {onEditIntegration && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditForReport(rep);
                        }}
                        title={lang === 'ru' ? 'Редактировать' : lang === 'uz' ? 'Tahrirlash' : 'Edit'}
                        className="p-1 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {userRole === 'super_admin' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReportOrIntegration(rep);
                        }}
                        title={lang === 'ru' ? 'Удалить' : lang === 'uz' ? 'O‘chirish' : 'Delete'}
                        className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Blogger / Title */}
                <div>
                  <h4 className="font-black text-sm text-neutral-900 group-hover:text-black tracking-tight truncate">
                    {isOther ? (rep.destination || t.paymentOther) : rep.channelBlogger}
                  </h4>
                  {rep.createdBy && (
                    <p className="text-[10px] text-neutral-400 font-medium mt-0.5 truncate">
                      {t.createdByField}: <span className="text-neutral-600 font-semibold">{rep.createdBy}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Financial Box */}
              <div className="bg-neutral-50/90 border border-neutral-150/60 rounded-xl p-2.5 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
                    {t.totalSumColumn}
                  </span>
                  <div className="text-sm sm:text-base font-black text-neutral-950 tracking-tight">
                    {Number(rep.totalAmount).toLocaleString('ru-RU')} <span className="text-[10px] font-bold text-neutral-400">UZS</span>
                  </div>
                </div>
                {!isOther && (
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {t.slotsColumn}
                    </span>
                    <span className="text-xs font-extrabold text-neutral-700">
                      {rep.slotsCount} × {Number(rep.pricePerSlot).toLocaleString('ru-RU')}
                    </span>
                  </div>
                )}
              </div>

              {/* Footer: Attachments & Actions */}
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {(() => {
                    const repReceipts = getReportReceipts(rep);
                    if (repReceipts.length === 0) return null;
                    return (
                      <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0">
                        🖼️ {repReceipts.length > 1 ? repReceipts.length : ''}
                      </span>
                    );
                  })()}
                  {userRole !== 'executive' && cabinetUrl && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await copyToClipboard(cabinetUrl);
                        setCopiedCabinetRepId(rep.id);
                        setTimeout(() => setCopiedCabinetRepId(null), 2000);
                      }}
                      className={`text-[10px] font-bold rounded-lg px-2 py-1 transition shrink-0 flex items-center gap-1 cursor-pointer ${
                        copiedCabinetRepId === rep.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-neutral-600 hover:text-black bg-neutral-100 hover:bg-neutral-200'
                      }`}
                      title={copiedCabinetRepId === rep.id ? (lang === 'ru' ? 'Скопировано!' : 'Copied!') : (lang === 'ru' ? 'Копировать кабинет' : 'Copy cabinet')}
                    >
                      {copiedCabinetRepId === rep.id ? <Check className="w-2.5 h-2.5 text-white" /> : <Link className="w-2.5 h-2.5" />}
                      <span>{copiedCabinetRepId === rep.id ? (lang === 'ru' ? 'Скопировано!' : lang === 'uz' ? 'Nusxalandi!' : 'Copied!') : (lang === 'ru' ? 'Кабинет' : 'Cabinet')}</span>
                    </button>
                  )}
                </div>

                <a
                  href={getTelegramReportUrl(rep, projects)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 border border-sky-200/80 rounded-xl transition cursor-pointer shrink-0"
                  title={lang === 'ru' ? 'Перейти к отчету в Telegram' : 'Jump to report in Telegram'}
                >
                  <Send className="w-3 h-3 text-sky-500" />
                  <span>{t.telegramReportBtn || 'Отчет в Telegram'}</span>
                  <ExternalLink className="w-2.5 h-2.5 text-sky-400" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {filteredReports.length === 0 && (
        <div className="p-12 text-center bg-white border border-dashed border-neutral-200 rounded-2xl max-w-md mx-auto">
          <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-extrabold text-neutral-600">{t.noReportsTitle}</p>
          <p className="text-xs text-neutral-400 mt-1">
            {lang === 'ru' ? 'Отчеты не найдены. Попробуйте изменить параметры поиска.' : 
             lang === 'uz' ? 'Hisobotlar topilmadi. Qidiruv parametrlarini o‘zgartirib ko‘ring.' : 
             'No reports matching search query were found.'}
          </p>
          {(searchQuery || selectedProjectId !== 'all' || filterStartDate || filterEndDate) && (
            <button
              onClick={() => {
                setSearchQuery('');
                handleSelectProject('all');
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="mt-3 px-3 py-1.5 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition cursor-pointer"
            >
              {lang === 'ru' ? 'Сбросить все фильтры' : lang === 'uz' ? 'Barcha filtrlarni tozalash' : 'Reset all filters'}
            </button>
          )}
        </div>
      )}

      {/* Detailed Report Modal */}
      {selectedReport && (
        <div 
          onClick={() => setSelectedReport(null)}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 transition-all duration-200 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-left border border-neutral-200 animate-in zoom-in-95 duration-150"
          >
            {/* Mobile Drag Indicator */}
            <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden" />

            {/* Modal Header */}
            <div className="px-5 pt-3 sm:pt-4 pb-3 border-b border-neutral-100 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="font-mono font-bold text-[10px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                    #{selectedReport.id}
                  </span>
                  {selectedReport.paymentType === 'other' ? (
                    <span className="px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wide bg-neutral-100 text-neutral-700">
                      {t.paymentOther}
                    </span>
                  ) : (
                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wide ${getPlatformBadgeClasses(selectedReport.platform)}`}>
                      {selectedReport.platform}
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200/60 truncate max-w-[150px]">
                    {renderProjectCell(selectedReport)}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-500">
                    {selectedReport.paymentType === 'prepaid' ? t.paymentPrepaid : 
                     selectedReport.paymentType === 'full' ? t.paymentFull : 
                     t.paymentOther}
                  </span>
                </div>
                <h3 className="font-black text-base sm:text-lg text-black tracking-tight truncate">
                  {selectedReport.paymentType === 'other' ? (selectedReport.destination || t.paymentOther) : selectedReport.channelBlogger}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100 active:bg-neutral-200 text-neutral-400 hover:text-black transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
              {/* Financial Hero Card */}
              <div className="bg-neutral-50 border border-neutral-200/80 p-4 rounded-2xl text-left">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  {t.totalSumColumn}
                </span>
                <div className="text-2xl font-black tracking-tight text-neutral-900 flex items-baseline gap-1.5">
                  <span>{Number(selectedReport.totalAmount).toLocaleString('ru-RU')}</span>
                  <span className="text-xs font-bold text-neutral-400">UZS</span>
                </div>

                {selectedReport.paymentType !== 'other' && (
                  <div className="mt-3 pt-3 border-t border-neutral-200/70 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left">
                    <div>
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
                        {lang === 'ru' ? 'Всего слотов' : lang === 'uz' ? 'Jami slotlar' : 'Slots'}
                      </span>
                      <span className="text-xs font-extrabold text-neutral-900 mt-0.5 block">
                        {selectedReport.slotsCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
                        {lang === 'ru' ? 'Цена за слот' : lang === 'uz' ? 'Slot narxi' : 'Price / Slot'}
                      </span>
                      <span className="text-xs font-extrabold text-neutral-900 mt-0.5 block">
                        {Number(selectedReport.pricePerSlot).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
                        {lang === 'ru' ? 'Оплачено' : lang === 'uz' ? 'To‘langan' : 'Paid'}
                      </span>
                      <span className="text-xs font-extrabold text-emerald-600 mt-0.5 block">
                        {(Number(selectedReport.paidSlotsCount) * Number(selectedReport.pricePerSlot)).toLocaleString('ru-RU')} UZS
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Single Telegram Action Button */}
              <a
                href={getTelegramReportUrl(selectedReport, projects)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{lang === 'ru' ? 'Открыть отчет в Telegram' : lang === 'uz' ? 'Telegram hisobotini ochish' : 'Open Report in Telegram'}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              {/* Details Card */}
              <div className="bg-neutral-50 border border-neutral-200/70 rounded-xl p-3.5 space-y-2.5 text-left">
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-neutral-500 font-medium">{t.reportDateField}:</span>
                  <span className="font-bold text-neutral-800 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                    {selectedReport.date}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 py-0.5 border-t border-neutral-200/50 pt-2">
                  <span className="text-neutral-500 font-medium">{t.purposeField}:</span>
                  <span className="font-bold text-neutral-900 text-right truncate max-w-[220px]">
                    {selectedReport.paymentType === 'other' 
                      ? selectedReport.destination 
                      : `${selectedReport.platform} блогер интеграция`}
                  </span>
                </div>

                {selectedReport.createdBy && (
                  <div className="flex items-center justify-between gap-2 py-0.5 border-t border-neutral-200/50 pt-2">
                    <span className="text-neutral-500 font-medium">{t.createdByField}:</span>
                    <span className="font-bold text-neutral-800">{selectedReport.createdBy}</span>
                  </div>
                )}

                {/* Referral Link */}
                {selectedReport.paymentType !== 'other' && selectedReport.destination && (
                  <div className="border-t border-neutral-200/50 pt-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">
                      {lang === 'ru' ? 'Реферальная ссылка' : lang === 'uz' ? 'Referral havolasi' : 'Referral Link'}
                    </span>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-neutral-200">
                      <span className="font-mono text-black font-semibold text-[11px] break-all flex-1 select-all">
                        {selectedReport.destination}
                      </span>
                      {selectedReport.destination.startsWith('http') && (
                        <a
                          href={selectedReport.destination}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 hover:bg-neutral-100 rounded text-neutral-600 transition shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Comments */}
                {selectedReport.comments && (
                  <div className="border-t border-neutral-200/50 pt-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">
                      {lang === 'ru' ? 'Комментарии' : lang === 'uz' ? 'Izohlar' : 'Comments'}
                    </span>
                    <p className="bg-white p-2.5 rounded-lg border border-neutral-200 text-neutral-700 italic leading-relaxed text-[11px]">
                      "{selectedReport.comments}"
                    </p>
                  </div>
                )}
              </div>

              {/* Screenshot/Receipt */}
              {(() => {
                const modalReceipts = getReportReceipts(selectedReport);
                if (modalReceipts.length === 0) return null;
                const activeIndex = Math.min(activeReceiptIndex, modalReceipts.length - 1);
                const currentReceipt = modalReceipts[activeIndex];
                const isImage = currentReceipt.startsWith('data:image/') || currentReceipt.startsWith('http');

                return (
                  <div className="space-y-2 text-left border-t border-neutral-100 pt-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">
                          {lang === 'ru' 
                            ? (modalReceipts.length > 1 ? `Чеки / Скриншоты (${modalReceipts.length})` : 'Чек / Скриншот')
                            : lang === 'uz' 
                              ? (modalReceipts.length > 1 ? `Cheklar / Skrinshotlar (${modalReceipts.length})` : 'Chek / Skrinshot')
                              : (modalReceipts.length > 1 ? `Receipts / Screenshots (${modalReceipts.length})` : 'Receipt / Screenshot')}
                        </p>
                        {modalReceipts.length > 1 && (
                          <span className="text-[10px] font-extrabold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                            {activeIndex + 1} / {modalReceipts.length}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const w = window.open();
                          if (w) {
                            if (currentReceipt.startsWith('data:image/')) {
                              w.document.write(`<img src="${currentReceipt}" style="max-width:100%; height:auto;" />`);
                            } else {
                              w.location.href = currentReceipt;
                            }
                          }
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:underline uppercase flex items-center gap-0.5 cursor-pointer"
                      >
                        {lang === 'ru' ? 'Открыть оригинал' : lang === 'uz' ? 'Originalini ochish' : 'Open Original'} ↗
                      </button>
                    </div>

                    {/* Main Receipt Viewer with Navigation */}
                    <div className="relative border border-neutral-200 rounded-xl overflow-hidden bg-neutral-900/5 flex items-center justify-center p-2 min-h-[160px] max-h-72">
                      {isImage ? (
                        <img 
                          src={currentReceipt} 
                          alt={`Receipt proof ${activeIndex + 1}`} 
                          className="max-w-full max-h-68 object-contain rounded cursor-pointer hover:opacity-95 transition" 
                          onClick={() => {
                            const w = window.open();
                            if (w) w.document.write(`<img src="${currentReceipt}" style="max-width:100%; height:auto;" />`);
                          }}
                          title={lang === 'ru' ? 'Нажмите для открытия в новом окне' : 'Click to open in new tab'}
                        />
                      ) : (
                        <div className="py-6 text-center text-neutral-500 font-medium">
                          <FileText className="w-8 h-8 text-neutral-400 mx-auto mb-1.5" />
                          <p className="text-xs font-bold text-neutral-700">
                            {lang === 'ru' ? 'Прикрепленный документ (PDF/Файл)' : lang === 'uz' ? 'Biriktirilgan hujjat (PDF/Fayl)' : 'Attached Document (PDF/File)'}
                          </p>
                          <a 
                            href={currentReceipt} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-blue-600 font-bold hover:underline mt-1.5 text-xs inline-block"
                          >
                            Download / View File
                          </a>
                        </div>
                      )}

                      {/* Navigation arrows if multiple receipts */}
                      {modalReceipts.length > 1 && (
                        <>
                          <button
                            type="button"
                            disabled={activeIndex === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReceiptIndex(prev => Math.max(0, prev - 1));
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center text-xs font-bold shadow-md disabled:opacity-20 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            disabled={activeIndex === modalReceipts.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReceiptIndex(prev => Math.min(modalReceipts.length - 1, prev + 1));
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center text-xs font-bold shadow-md disabled:opacity-20 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            ›
                          </button>
                        </>
                      )}
                    </div>

                    {/* Thumbnail strip if multiple receipts */}
                    {modalReceipts.length > 1 && (
                      <div className="flex gap-1.5 overflow-x-auto py-1">
                        {modalReceipts.map((thumb, tIdx) => (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={() => setActiveReceiptIndex(tIdx)}
                            className={`relative flex-shrink-0 w-12 h-12 rounded-lg border-2 overflow-hidden transition cursor-pointer ${
                              tIdx === activeIndex ? 'border-black ring-2 ring-black/20' : 'border-neutral-200 opacity-60 hover:opacity-100'
                            }`}
                          >
                            {thumb.startsWith('data:image/') || thumb.startsWith('http') ? (
                              <img src={thumb} alt={`Thumb ${tIdx + 1}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-[9px] font-black text-red-600">PDF</div>
                            )}
                            <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[7px] font-bold px-1 rounded">
                              {tIdx + 1}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/60 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                {onEditIntegration && (
                  <button
                    type="button"
                    onClick={() => {
                      const rep = selectedReport;
                      if (!rep) return;
                      openEditForReport(rep);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-neutral-100 text-neutral-800 font-bold text-xs rounded-xl border border-neutral-200 transition shadow-3xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-neutral-600" />
                    <span>{lang === 'ru' ? 'Редактировать' : lang === 'uz' ? 'Tahrirlash' : 'Edit'}</span>
                  </button>
                )}
                {userRole === 'super_admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      const rep = selectedReport;
                      if (!rep) return;
                      handleDeleteReportOrIntegration(rep);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl border border-rose-200 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>{lang === 'ru' ? 'Удалить' : lang === 'uz' ? 'O‘chirish' : 'Delete'}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {lang === 'ru' ? 'Закрыть' : lang === 'uz' ? 'Yopish' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Integration Modal */}
      {(editingIntegration || editingReport) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-[110]">
          <div className="bg-white rounded-xl shadow-lg border border-neutral-200 w-full max-w-2xl overflow-hidden animate-in fade-in duration-100">
            <div className="bg-white px-6 py-4 flex justify-between items-center text-black border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-sm uppercase tracking-wider">
                  {editingReport ? (lang === 'ru' ? 'Редактировать отчет' : lang === 'uz' ? 'Hisobotni tahrirlash' : 'Edit Report') : (t.editIntegration || 'Редактировать интеграцию')}
                </h3>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-neutral-100 border border-neutral-200/80 rounded-lg text-[10px] text-neutral-600 font-medium">
                  <User className="w-3 h-3 text-neutral-500 shrink-0" />
                  <span>
                    {t.kanbanCreatedByLabel || 'Создал:'}{' '}
                    <strong className="text-black font-bold">
                      {editingReport?.createdBy || editingIntegration?.createdBy || currentUserName || currentUserEmail || (t.kanbanNotSpecified || 'Не указан')}
                    </strong>
                  </span>
                </div>
              </div>
              <button 
                onClick={() => {
                  setEditingIntegration(null);
                  setEditingReport(null);
                }}
                className="text-neutral-400 hover:text-black font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveIntegrationEdit} className="p-6 space-y-4 text-left max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.bloggerColumn} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Alex Fitness Hub"
                    value={bloggerName}
                    onChange={(e) => setBloggerName(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.platformColumn} *
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as any)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  >
                    <option value="Telegram">Telegram</option>
                    <option value="Instagram">Instagram</option>
                    <option value="YouTube">YouTube</option>
                    <option value="MAX">MAX</option>
                    <option value="TikTok">TikTok</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.bloggerPageLinkLabel || (lang === 'ru' ? 'Ссылка на страницу блогера *' : lang === 'uz' ? 'Blogger sahifasi havolasi *' : 'Blogger Page Link *')}
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://instagram.com/alex_fit"
                    value={bloggerPageLink}
                    onChange={(e) => setBloggerPageLink(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.referralLinkField}
                  </label>
                  <input
                    type="url"
                    placeholder="https://saas-ai.com/join?utm_source=alex_fit"
                    value={referralLink}
                    onChange={(e) => setReferralLink(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {lang === 'ru' ? 'Личный Telegram блогера' : lang === 'uz' ? 'Blogger shaxsiy Telegrami' : 'Personal Telegram'}
                  </label>
                  <input
                    type="text"
                    placeholder="@username или https://t.me/..."
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.reportDateField || (lang === 'ru' ? 'Дата отчета *' : lang === 'uz' ? 'Hisobot sanasi *' : 'Report Date *')}
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {lang === 'ru' ? 'Комментарий / Назначение' : lang === 'uz' ? 'Izoh / Maqsad' : 'Comments / Purpose'}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === 'ru' ? 'e.g., Telegram блогер интеграция' : 'e.g., Integration note'}
                    value={reportComments}
                    onChange={(e) => setReportComments(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.pricePerSlotField} *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={pricePerSlot}
                    onChange={(e) => setPricePerSlot(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150 font-bold text-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.slotsCountField} *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={slotsCount}
                    onChange={(e) => setSlotsCount(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150 font-bold text-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1.5">
                    {t.totalSumField}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={calculatedTotal.toLocaleString('ru-RU')}
                    className="w-full px-4 py-2 bg-neutral-100 border border-neutral-200 rounded-lg text-xs font-bold text-black select-none"
                  />
                </div>
              </div>

              {/* Checkbox to Toggle Individual Slots Configuration */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="feed-customize-slots-checkbox"
                  checked={customizeSlots}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setCustomizeSlots(checked);
                    if (checked && slotGroups.length === 0) {
                      setSlotGroups([{ quantity: slotsCount, platform: platform, format: getDefaultFormat(platform) }]);
                    }
                  }}
                  className="w-3.5 h-3.5 accent-black rounded border-neutral-300 focus:ring-black cursor-pointer"
                />
                <label htmlFor="feed-customize-slots-checkbox" className="text-[10px] font-bold text-neutral-600 select-none cursor-pointer">
                  {t.customizeSlotsLabel}
                </label>
              </div>

              {/* Grouped Slots Configurer */}
              {customizeSlots && (
                <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-left space-y-2">
                  <div className="flex justify-between items-center border-b border-neutral-200 pb-1.5">
                    <label className="block text-[9px] font-black text-neutral-500 uppercase tracking-wide">
                      {t.configureSlotsTitle}
                    </label>
                    <span className="text-[9px] font-bold text-neutral-400">
                      {slotGroups.reduce((acc, g) => acc + g.quantity, 0)} / {slotsCount}
                    </span>
                  </div>
                  
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {slotGroups.map((group, index) => (
                      <div key={index} className="flex items-center gap-1.5 p-1.5 bg-white border border-neutral-150 rounded-lg text-xs">
                        <input
                          type="number"
                          required
                          min={1}
                          max={slotsCount}
                          value={group.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value));
                            const otherSum = slotGroups.reduce((acc, g, idx) => idx === index ? acc : acc + g.quantity, 0);
                            if (otherSum + val > slotsCount) {
                              alert(lang === 'ru' 
                                ? `Количество настроенных слотов не должно превышать общее количество (${slotsCount})!` 
                                : lang === 'uz' 
                                ? `Sozlangan slotlar soni umumiy slotlar sonidan (${slotsCount}) oshib ketmasligi kerak!` 
                                : `Configured slots count cannot exceed total slots count (${slotsCount})!`
                              );
                              return;
                            }
                            const nextGroups = [...slotGroups];
                            nextGroups[index].quantity = val;
                            setSlotGroups(nextGroups);
                          }}
                          className="w-12 bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-[10px] font-bold text-black focus:outline-none text-center"
                          title="Quantity"
                        />

                        <select
                          value={group.platform}
                          onChange={(e) => {
                            const platVal = e.target.value as 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok';
                            const nextGroups = [...slotGroups];
                            nextGroups[index] = {
                              ...nextGroups[index],
                              platform: platVal,
                              format: getDefaultFormat(platVal)
                            };
                            setSlotGroups(nextGroups);
                          }}
                          className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-[10px] font-bold text-black focus:outline-none"
                        >
                          <option value="Telegram">Telegram</option>
                          <option value="Instagram">Instagram</option>
                          <option value="YouTube">YouTube</option>
                          <option value="MAX">MAX</option>
                          <option value="TikTok">TikTok</option>
                        </select>

                        <select
                          value={group.format}
                          onChange={(e) => {
                            const nextGroups = [...slotGroups];
                            nextGroups[index].format = e.target.value;
                            setSlotGroups(nextGroups);
                          }}
                          className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-[10px] font-bold text-black focus:outline-none flex-1"
                        >
                          {group.platform === 'Instagram' && (
                            <>
                              <option value="Stories">Instagram Stories</option>
                              <option value="Reels">Instagram Reels</option>
                              <option value="VideoBadge">{lang === 'ru' ? 'Плашка на видео' : lang === 'uz' ? 'Videodagi plashka' : 'Video badge'}</option>
                            </>
                          )}
                          {group.platform === 'Telegram' && (
                            <>
                              <option value="Post">Telegram Post</option>
                              <option value="Stories">Telegram Stories</option>
                            </>
                          )}
                          {group.platform === 'YouTube' && (
                            <>
                              <option value="Shorts">YouTube Shorts</option>
                              <option value="Integration">YouTube Integration</option>
                            </>
                          )}
                          {group.platform === 'MAX' && (
                            <option value="Post">MAX Post</option>
                          )}
                          {group.platform === 'TikTok' && (
                            <option value="VideoPost">{lang === 'ru' ? 'TikTok Видео-Пост' : lang === 'uz' ? 'TikTok Video-Post' : 'TikTok Video Post'}</option>
                          )}
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            setSlotGroups(slotGroups.filter((_, idx) => idx !== index));
                          }}
                          className="text-red-500 hover:bg-neutral-100 p-1 rounded text-xs font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const currentSum = slotGroups.reduce((acc, g) => acc + g.quantity, 0);
                      if (currentSum + 1 > slotsCount) {
                        alert(lang === 'ru' 
                          ? `Количество настроенных слотов не должно превышать общее количество (${slotsCount})!` 
                          : lang === 'uz' 
                          ? `Sozlangan slotlar soni umumiy slotlar sonidan (${slotsCount}) oshib ketmasligi kerak!` 
                          : `Configured slots count cannot exceed total slots count (${slotsCount})!`
                        );
                        return;
                      }
                      setSlotGroups([...slotGroups, { quantity: 1, platform: platform, format: getDefaultFormat(platform) }]);
                    }}
                    className="w-full py-1.5 text-[10px] font-extrabold text-neutral-600 hover:text-black border border-dashed border-neutral-300 rounded hover:border-neutral-400 bg-white transition cursor-pointer"
                  >
                    + {lang === 'ru' ? 'Добавить группу слотов' : lang === 'uz' ? 'Slotlar guruhini qo‘shish' : 'Add Slot Group'}
                  </button>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingIntegration(null);
                    setEditingReport(null);
                  }}
                  className="flex-1 py-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold text-xs rounded-lg transition duration-150 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-lg transition duration-150 cursor-pointer"
                >
                  {t.saveChangesBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Other Expense Modal */}
      {editingOtherReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-[110]">
          <div className="bg-white rounded-xl shadow-lg border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-100">
            <div className="bg-white px-6 py-4 flex justify-between items-center text-black border-b border-neutral-200">
              <h3 className="font-bold text-sm uppercase tracking-wider">
                {lang === 'ru' ? 'Редактировать расход' : lang === 'uz' ? 'Xarajatni tahrirlash' : 'Edit Expense'}
              </h3>
              <button 
                onClick={() => setEditingOtherReport(null)}
                className="text-neutral-400 hover:text-black font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOtherExpenseEdit} className="p-6 space-y-4 text-left max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  {t.purposeField} *
                </label>
                <input
                  type="text"
                  required
                  value={editOtherDestination}
                  onChange={(e) => setEditOtherDestination(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  placeholder={lang === 'ru' ? 'Назначение расхода' : 'Expense purpose'}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.sumField} (UZS) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editOtherAmount}
                    onChange={(e) => setEditOtherAmount(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs font-bold text-black focus:outline-none transition duration-150"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.reportDateField} *
                  </label>
                  <input
                    type="date"
                    required
                    value={editOtherDate}
                    onChange={(e) => setEditOtherDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  {t.campaignTitleField}
                </label>
                <select
                  value={editOtherProjectId}
                  onChange={(e) => setEditOtherProjectId(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                >
                  <option value="">{lang === 'ru' ? '— Не привязано к проекту —' : '— No project —'}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  {t.commentsField}
                </label>
                <textarea
                  rows={3}
                  value={editOtherComments}
                  onChange={(e) => setEditOtherComments(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150 resize-none"
                  placeholder={lang === 'ru' ? 'Дополнительные примечания...' : 'Notes...'}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingOtherReport(null)}
                  className="flex-1 py-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold text-xs rounded-lg transition duration-150 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-lg transition duration-150 cursor-pointer"
                >
                  {t.saveChangesBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
