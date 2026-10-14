/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Integration, Project, KanbanColumn, INITIAL_KANBAN_COLUMNS, DealComment, BloggerRequisites } from '../data/mockData';
import { Language, translations } from '../translations';
import { getCabinetUrl } from '../utils/url';
import { copyToClipboard } from '../utils/clipboard';
import { getPlatformBadgeClasses, formatTelegramLink } from '../utils/platform';
import { 
  Search, 
  Plus, 
  Copy, 
  Check, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  Settings2,
  GripVertical,
  Layers,
  FileText,
  CreditCard,
  User,
  Users,
  FileCheck,
  ZoomIn,
  X,
  ExternalLink,
  MessageSquare,
  Send,
  FilePlus,
  Eye,
  EyeOff,
  Lock,
  ChevronUp,
  ChevronDown,
  QrCode,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import BloggerAudienceCard from './BloggerAudienceCard';
import BloggerTelegramChat from './BloggerTelegramChat';
import TelegramGatewayModal from './TelegramGatewayModal';
import { fetchTelegramGatewayStatus, TelegramGatewayStatus, updateIntegrationChatSettings } from '../services/api';

interface KanbanViewProps {
  projects: Project[];
  integrations: Integration[];
  columns?: KanbanColumn[];
  onUpdateColumns?: (columns: KanbanColumn[]) => void;
  onUpdateIntegrationStage: (integrationId: string, newStage: string) => void;
  onAddIntegration: (integration: Omit<Integration, 'id' | 'totalAmount'>) => void;
  onEditIntegration?: (integrationId: string, updatedFields: Partial<Integration>) => void | Promise<void>;
  onDeleteIntegration?: (integrationId: string) => void;
  lang: Language;
  userRole?: string | null;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
  bloggerRequisitesList?: BloggerRequisites[];
  onOpenRequisitesDirectory?: () => void;
  onClearStage?: (stageId: string) => void | Promise<void>;
  onRefreshSubscribers?: (integrationId: string, overrides?: any) => Promise<any>;
  onResetSubscribersHistory?: (integrationId: string) => Promise<any>;
  onAddManualSnapshot?: (integrationId: string, date: string, count: number, note?: string) => Promise<void>;
  onNavigateToReports?: (deal: Integration) => void;
  loading?: boolean;
}

// Column titles should remain as named and not react to language switching
export function getLocalizedColumnTitle(col: { id: string; title: string }, _currentLang?: Language): string {
  return col.title;
}

export default function KanbanView({
  projects = [],
  integrations = [],
  columns: initialColumns,
  onUpdateColumns,
  onUpdateIntegrationStage,
  onAddIntegration,
  onEditIntegration,
  onDeleteIntegration,
  lang = 'ru',
  userRole,
  currentUserEmail,
  currentUserName,
  bloggerRequisitesList = [],
  onOpenRequisitesDirectory,
  onClearStage,
  onRefreshSubscribers,
  onResetSubscribersHistory,
  onAddManualSnapshot,
  onNavigateToReports,
  loading = false
}: KanbanViewProps) {
  const t = translations[lang] || translations['ru'];

  // Helper to parse comments array
  const parseComments = (raw: string | DealComment[] | undefined): DealComment[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      if (raw.trim()) {
        return [{
          id: 'legacy-1',
          author: t.kanbanNotePrefix || 'Заметка',
          text: raw,
          createdAt: new Date().toISOString()
        }];
      }
    }
    return [];
  };

  // System stages that are permanently linked to automated workflows in the ecosystem
  const SYSTEM_STAGE_IDS = ['backlog', 'ready_for_payment', 'paid_in_progress'];

  const ensureSystemColumns = (cols: KanbanColumn[]): KanbanColumn[] => {
    const backlog = cols.find(c => c.id === 'backlog') || { id: 'backlog', title: 'Backlog', color: 'slate', hidden: true };
    let rest = cols.filter(c => c.id !== 'backlog');

    // Ensure 'ready_for_payment' exists
    if (!rest.some(c => c.id === 'ready_for_payment')) {
      const defaultReady = INITIAL_KANBAN_COLUMNS.find(c => c.id === 'ready_for_payment') || {
        id: 'ready_for_payment',
        title: 'Готов к оплате',
        color: 'indigo'
      };
      const completedIdx = rest.findIndex(c => c.id === 'completed');
      if (completedIdx !== -1) {
        rest.splice(completedIdx, 0, defaultReady);
      } else {
        rest.push(defaultReady);
      }
    }

    // Ensure 'paid_in_progress' exists
    if (!rest.some(c => c.id === 'paid_in_progress')) {
      const defaultPaid = INITIAL_KANBAN_COLUMNS.find(c => c.id === 'paid_in_progress') || {
        id: 'paid_in_progress',
        title: 'Оплачено / В работе',
        color: 'emerald'
      };
      const completedIdx = rest.findIndex(c => c.id === 'completed');
      if (completedIdx !== -1) {
        rest.splice(completedIdx, 0, defaultPaid);
      } else {
        rest.push(defaultPaid);
      }
    }

    return [backlog, ...rest];
  };

  // Columns State (Synchronized with server, defaults to INITIAL_KANBAN_COLUMNS)
  const [columns, setColumns] = useState<KanbanColumn[]>(() => {
    if (initialColumns && initialColumns.length > 0) return ensureSystemColumns(initialColumns);
    try {
      const saved = localStorage.getItem('kanban_custom_columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return ensureSystemColumns(parsed);
      }
    } catch {}
    return INITIAL_KANBAN_COLUMNS;
  });

  React.useEffect(() => {
    if (initialColumns && initialColumns.length > 0) {
      setColumns(ensureSystemColumns(initialColumns));
    }
  }, [initialColumns]);

  const updateAndSaveColumns = (newCols: KanbanColumn[]) => {
    const finalized = ensureSystemColumns(newCols);
    setColumns(finalized);
    try {
      localStorage.setItem('kanban_custom_columns', JSON.stringify(finalized));
    } catch {}
    if (onUpdateColumns) onUpdateColumns(finalized);
  };

  const handleToggleColumnVisibility = (colId: string) => {
    const updated = columns.map(col => {
      if (col.id === colId) {
        return { ...col, hidden: !col.hidden };
      }
      return col;
    });
    updateAndSaveColumns(updated);
  };

  const visibleColumns = useMemo(() => {
    return columns.filter(col => !col.hidden);
  }, [columns]);

  const isBacklogHidden = useMemo(() => {
    const b = columns.find(col => col.id === 'backlog');
    return !b || b.hidden !== false;
  }, [columns]);

  const [backlogNotification, setBacklogNotification] = useState<{ bloggerName: string; dealId: string } | null>(null);

  useEffect(() => {
    if (!backlogNotification) return;
    const timer = setTimeout(() => setBacklogNotification(null), 4500);
    return () => clearTimeout(timer);
  }, [backlogNotification]);

  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return localStorage.getItem('tezi_kanban_project_id') || 'all';
  });

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    localStorage.setItem('tezi_kanban_project_id', id);
  };
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCabinet, setCopiedCabinet] = useState<boolean>(false);

  // Selected Deal Detail/Edit Modal State
  const [selectedDeal, setSelectedDeal] = useState<Integration | null>(null);
  const [activeChatDeal, setActiveChatDeal] = useState<Integration | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'details' | 'chat'>('details');
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);

  // Super Admin check
  const isSuperAdmin = 
    userRole === 'super_admin' || 
    (!userRole && (currentUserName === 'Super Admin' || (currentUserEmail && (currentUserEmail.includes('admin') || currentUserEmail === 'chief1' || currentUserEmail === 'abduazz'))));

  // Telegram Gateway live connection monitoring (Super Admin only)
  const [gatewayStatus, setGatewayStatus] = useState<TelegramGatewayStatus | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;

    let isMounted = true;
    const checkGateway = async () => {
      try {
        const res = await fetchTelegramGatewayStatus();
        if (isMounted) {
          setGatewayStatus(res);
        }
      } catch (err) {
        if (isMounted) {
          setGatewayStatus({ isRunning: false, isAuthorized: false });
        }
      }
    };

    checkGateway();
    // Poll gateway status every 20 seconds so super admin immediately sees if Telegram was unlinked
    const interval = setInterval(checkGateway, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isSuperAdmin]);

  const [editBloggerName, setEditBloggerName] = useState('');
  const [editBloggerLink, setEditBloggerLink] = useState('');
  const [editTelegramUsername, setEditTelegramUsername] = useState('');
  const [telegramContacts, setTelegramContacts] = useState<string[]>(['']);
  const [isTgFocused, setIsTgFocused] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const tgBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPhoneLike = (val: string | null | undefined): boolean => {
    if (!val) return false;
    const clean = val.trim().replace(/[\s\-\(\)]+/g, '');
    return clean.startsWith('+') || /^\d{7,16}$/.test(clean);
  };

  // Split multiple telegram contacts or return empty single contact
  const parseTelegramContacts = (val: string | null | undefined): string[] => {
    if (!val) return [''];
    const parts = val.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [''];
  };

  const getTelegramAppUrl = (contact: string): string => {
    const clean = contact.trim();
    if (!clean) return '#';
    const cleanDigits = clean.replace(/\D/g, '');
    if (/^\+?\d{9,15}$/.test(clean)) {
      return `https://t.me/+${cleanDigits}`;
    }
    return formatTelegramLink(clean);
  };

  const updateTelegramContact = (index: number, val: string) => {
    if (val.includes(',') || val.includes('\n')) {
      const pastedParts = val.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
      if (pastedParts.length > 1) {
        const updated = [...telegramContacts];
        updated.splice(index, 1, ...pastedParts);
        setTelegramContacts(updated);
        setEditTelegramUsername(updated.join(', '));
        return;
      }
    }
    const updated = [...telegramContacts];
    updated[index] = val;
    setTelegramContacts(updated);
    const combined = updated.map(s => s.trim()).filter(Boolean).join(', ');
    setEditTelegramUsername(combined);
  };

  const handleAddTgContact = () => {
    setTelegramContacts(prev => [...prev, '']);
  };

  const handleRemoveTgContact = (index: number) => {
    setTelegramContacts(prev => {
      const updated = prev.filter((_, i) => i !== index);
      const finalList = updated.length > 0 ? updated : [''];
      const combined = finalList.map(s => s.trim()).filter(Boolean).join(', ');
      setEditTelegramUsername(combined);
      return finalList;
    });
  };

  const handleOpenChatTab = async () => {
    if (isCreateMode || !selectedDeal) return;

    const currentTg = editTelegramUsername.trim();
    const oldTg = (selectedDeal.telegramUsername || '').trim();
    const isTgChanged = currentTg !== oldTg;
    const currentName = editBloggerName.trim() || selectedDeal.bloggerName;

    if (isTgChanged || currentName !== selectedDeal.bloggerName) {
      setIsOpeningChat(true);
      const isUnlinking = !currentTg;
      const newTelegramUsername = isUnlinking ? undefined : currentTg;
      // If contact was unlinked or changed to another person, reset chat ID
      const newTelegramChatId = isTgChanged ? undefined : selectedDeal.telegramChatId;

      const updatedDeal: Integration = {
        ...selectedDeal,
        bloggerName: currentName,
        telegramUsername: newTelegramUsername,
        telegramChatId: newTelegramChatId,
      };
      setSelectedDeal(updatedDeal);

      try {
        if (isUnlinking) {
          await updateIntegrationChatSettings(selectedDeal.id, null, null);
        } else {
          const res = await updateIntegrationChatSettings(selectedDeal.id, null, currentTg);
          if (res && res.telegramUsername !== undefined) {
            const resolvedUser = res.telegramUsername || currentTg;
            updatedDeal.telegramUsername = resolvedUser;
            setEditTelegramUsername(resolvedUser);
            setTelegramContacts(parseTelegramContacts(resolvedUser));
          }
        }
        if (onEditIntegration) {
          onEditIntegration(selectedDeal.id, {
            bloggerName: currentName,
            telegramUsername: newTelegramUsername,
            telegramChatId: newTelegramChatId,
          });
        }
      } catch (err: any) {
        console.error('Failed to sync telegram contact before opening chat:', err);
      } finally {
        setIsOpeningChat(false);
      }
    }

    setModalActiveTab('chat');
  };
  const [editPlatform, setEditPlatform] = useState<'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok'>('Instagram');
  const [editProjectId, setEditProjectId] = useState('');
  const [editKanbanStage, setEditKanbanStage] = useState('');
  const [initialKanbanStage, setInitialKanbanStage] = useState('');
  const [isQuickMoving, setIsQuickMoving] = useState(false);
  const [editPricePerSlot, setEditPricePerSlot] = useState<number | ''>(0);
  const [editSlotsCount, setEditSlotsCount] = useState<number | ''>(1);
  const [editPaidAmount, setEditPaidAmount] = useState<number | ''>(0);
  const [editPaidSlotsCount, setEditPaidSlotsCount] = useState<number>(0);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editReferralLink, setEditReferralLink] = useState('');
  const [editCardNumber, setEditCardNumber] = useState('');
  const [editCardName, setEditCardName] = useState('');
  const [isCardCopied, setIsCardCopied] = useState(false);
  const [editSubscribersCount, setEditSubscribersCount] = useState<number | ''>('');
  const [editCommentsList, setEditCommentsList] = useState<DealComment[]>([]);
  const [newCommentInput, setNewCommentInput] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'completed' | 'paused'>('active');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isDraggingRef = React.useRef(false);

  const handleCardNumberChange = (raw: string) => {
    if (/^[\d\s]*$/.test(raw)) {
      const digits = raw.replace(/\D/g, '').slice(0, 16);
      const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
      setEditCardNumber(formatted);
      return;
    }
    setEditCardNumber(raw);
  };

  // Target Payment Column ("Готов к оплате") resolution & customization
  const [paymentStageColId, setPaymentStageColId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kanban_payment_target_column_id');
      if (saved) return saved;
    }
    return 'ready_for_payment';
  });

  const handleSetPaymentStageColId = (colId: string) => {
    setPaymentStageColId(colId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kanban_payment_target_column_id', colId);
    }
  };

  const paymentColumn = useMemo(() => {
    // 1. Check if user explicitly selected a target column in settings
    if (paymentStageColId) {
      const matched = columns.find(c => c.id === paymentStageColId);
      if (matched) return matched;
    }
    // 2. Check default system column ready_for_payment
    const systemCol = columns.find(c => c.id === 'ready_for_payment');
    if (systemCol) return systemCol;
    // 3. Fallback: match by title keywords if renamed in production
    const titleMatch = columns.find(c => 
      /готов.*оплат|ready.*pay|to.lov.*tayyor/i.test(c.title) ||
      (/оплат|pay|to.lov/i.test(c.title) && c.id !== 'paid_in_progress')
    );
    if (titleMatch) return titleMatch;
    // 4. Fallback: first non-backlog column
    return columns.find(c => c.id !== 'backlog') || columns[0] || { id: 'ready_for_payment', title: 'Готов к оплате', color: 'indigo' };
  }, [columns, paymentStageColId]);

  const areCardFieldsFilled = useMemo(() => {
    const cleanDigits = editCardNumber.replace(/\s+/g, '');
    const cleanName = editCardName.trim();
    const isCardOk = cleanDigits.length >= 4 || editCardNumber.trim().length >= 4;
    const isNameOk = cleanName.length >= 1;
    return Boolean(isCardOk && isNameOk);
  }, [editCardNumber, editCardName]);

  // Modals state
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [columnTitleInput, setColumnTitleInput] = useState('');
  const [activePassportScanZoom, setActivePassportScanZoom] = useState<{ src: string; title: string } | null>(null);

  // Detect whether blogger channel, handle, link, or platform was modified inside modal
  const isChannelChangedInModal = useMemo(() => {
    if (!selectedDeal || isCreateMode) return false;
    const oldName = (selectedDeal.bloggerName || '').trim().toLowerCase().replace(/^[@#]/, '');
    const newName = editBloggerName.trim().toLowerCase().replace(/^[@#]/, '');
    const oldLink = (selectedDeal.bloggerPageLink || '').trim();
    const newLink = editBloggerLink.trim();
    const oldPlat = selectedDeal.platform || 'Instagram';
    const newPlat = editPlatform;
    return oldName !== newName || oldLink !== newLink || oldPlat !== newPlat;
  }, [selectedDeal, isCreateMode, editBloggerName, editBloggerLink, editPlatform]);

  // Construct effective deal for audience widget: when channel changed, wipe old history for display!
  const effectiveDealForAudience: Integration = useMemo(() => {
    if (!selectedDeal) return {} as Integration;
    if (isChannelChangedInModal) {
      return {
        ...selectedDeal,
        bloggerName: editBloggerName.trim() || selectedDeal.bloggerName,
        bloggerPageLink: editBloggerLink.trim(),
        platform: editPlatform,
        subscribersCount: editSubscribersCount !== '' ? Number(editSubscribersCount) : null,
        subscribersHistory: [],
        subscribersUpdatedAt: null,
      };
    }
    return {
      ...selectedDeal,
      bloggerName: editBloggerName.trim() || selectedDeal.bloggerName,
      bloggerPageLink: editBloggerLink.trim(),
      platform: editPlatform,
      subscribersCount: editSubscribersCount !== '' ? Number(editSubscribersCount) : selectedDeal.subscribersCount,
    };
  }, [selectedDeal, isChannelChangedInModal, editBloggerName, editBloggerLink, editPlatform, editSubscribersCount]);

  // Keep selectedDeal in sync with integrations prop
  useEffect(() => {
    if (selectedDeal) {
      const fresh = integrations.find(i => i.id === selectedDeal.id);
      if (fresh) {
        setSelectedDeal(prev => {
          if (!prev) return null;
          if (
            prev.subscribersCount !== fresh.subscribersCount ||
            prev.subscribersUpdatedAt !== fresh.subscribersUpdatedAt ||
            JSON.stringify(prev.subscribersHistory) !== JSON.stringify(fresh.subscribersHistory)
          ) {
            return {
              ...prev,
              subscribersCount: fresh.subscribersCount,
              subscribersUpdatedAt: fresh.subscribersUpdatedAt,
              subscribersHistory: fresh.subscribersHistory
            };
          }
          return prev;
        });
      }
    }
  }, [integrations]);

  // Handle refresh subscribers right inside the modal with current input values
  const handleRefreshSubscribersInModal = async (integrationId: string) => {
    if (!onRefreshSubscribers) return;
    const updated = await onRefreshSubscribers(integrationId, {
      platform: editPlatform,
      bloggerName: editBloggerName.trim(),
      bloggerPageLink: editBloggerLink.trim(),
      telegramUsername: editTelegramUsername.trim()
    });
    if (updated) {
      setSelectedDeal(updated);
      setEditSubscribersCount(updated.subscribersCount ?? '');
      if (updated.bloggerName) setEditBloggerName(updated.bloggerName);
      if (updated.bloggerPageLink !== undefined) setEditBloggerLink(updated.bloggerPageLink || '');
      if (updated.telegramUsername !== undefined) {
        setEditTelegramUsername(updated.telegramUsername || '');
        setTelegramContacts(parseTelegramContacts(updated.telegramUsername));
      }
      if (updated.platform) setEditPlatform(updated.platform);
    }
  };

  // Handle reset subscribers history in modal
  const handleResetHistoryInModal = async (integrationId: string) => {
    if (onResetSubscribersHistory) {
      const updated = await onResetSubscribersHistory(integrationId);
      if (updated) {
        setSelectedDeal(updated);
        setEditSubscribersCount('');
      }
    }
  };

  // Comment Handlers
  const handleAddComment = () => {
    if (!newCommentInput.trim()) return;
    const authorName = currentUserEmail || (userRole ? `${lang === 'uz' ? 'Foydalanuvchi' : lang === 'en' ? 'User' : 'Пользователь'} (${userRole})` : (lang === 'uz' ? 'Foydalanuvchi' : lang === 'en' ? 'User' : 'Пользователь'));
    const newCommentItem: DealComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      author: authorName,
      text: newCommentInput.trim(),
      createdAt: new Date().toISOString()
    };
    setEditCommentsList((prev) => [...prev, newCommentItem]);
    setNewCommentInput('');
  };

  const handleDeleteComment = (commentId: string) => {
    setEditCommentsList((prev) => prev.filter(c => c.id !== commentId));
  };

  // Filtered Integrations: only include deals that belong to a kanban stage
  const filteredIntegrations = useMemo(() => {
    return integrations.filter((item) => {
      if (!item.kanbanStage) return false;
      const matchSearch = item.bloggerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.referralLink && item.referralLink.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchProject = selectedProjectId === 'all' || String(item.projectId) === String(selectedProjectId);
      const matchPlatform = selectedPlatform === 'all' || item.platform === selectedPlatform;
      return matchSearch && matchProject && matchPlatform;
    });
  }, [integrations, searchQuery, selectedProjectId, selectedPlatform]);

  // Count deals per project (only deals with active kanban stage)
  const projectDealCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    integrations.forEach((item) => {
      if (item.kanbanStage && item.projectId) {
        const pid = String(item.projectId);
        counts[pid] = (counts[pid] || 0) + 1;
      }
    });
    return counts;
  }, [integrations]);

  // Total active kanban cards
  const totalKanbanCards = useMemo(() => {
    return integrations.filter(i => Boolean(i.kanbanStage)).length;
  }, [integrations]);

  // Grouped Integrations by Column ID
  const columnDataMap = useMemo(() => {
    const map = new Map<string, Integration[]>();
    columns.forEach(c => map.set(c.id, []));

    filteredIntegrations.forEach((item) => {
      if (!item.kanbanStage) return;
      const stage = item.kanbanStage;
      if (map.has(stage)) {
        map.get(stage)!.push(item);
      }
    });

    return map;
  }, [filteredIntegrations, columns]);

  // Drag and Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    isDraggingRef.current = true;
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      setDraggedDealId(dealId);
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedDealId(null);
    setDragOverColumnId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  const handleDragOverColumn = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== colId) {
      setDragOverColumnId(colId);
    }
  };

  const handleDragLeaveColumn = (colId: string) => {
    if (dragOverColumnId === colId) {
      setDragOverColumnId(null);
    }
  };

  const handleDropOnColumn = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain') || draggedDealId;
    if (dealId) {
      onUpdateIntegrationStage(dealId, targetColId);
      if (targetColId === 'backlog') {
        const deal = integrations.find(i => i.id === dealId);
        if (deal) {
          setBacklogNotification({ bloggerName: deal.bloggerName, dealId: deal.id });
        }
      }
    }
    setDraggedDealId(null);
    setDragOverColumnId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  // Open Deal Create Modal
  const handleOpenCreateDealModal = (stageId?: string) => {
    setIsCreateMode(true);
    setSelectedDeal(null);
    setModalActiveTab('details');
    setEditBloggerName('');
    setEditBloggerLink('');
    setEditTelegramUsername('');
    setTelegramContacts(['']);
    setIsTgFocused(false);
    setEditPlatform('Instagram');
    setEditProjectId(selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id || ''));
    const startStage = stageId || columns[0]?.id || 'wishlist';
    setEditKanbanStage(startStage);
    setInitialKanbanStage(startStage);
    setEditPricePerSlot(0);
    setEditSlotsCount(1);
    setEditPaidAmount(0);
    setEditPaidSlotsCount(0);
    setEditStartDate(new Date().toISOString().split('T')[0]);
    setEditEndDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setEditReferralLink('');
    setEditCardNumber('');
    setEditCardName('');
    setIsCardCopied(false);
    setEditSubscribersCount('');
    setEditCommentsList([]);
    setNewCommentInput('');
    setEditStatus('active');
    setSaveSuccess(false);
    setIsQuickMoving(false);
  };

  // Open Deal Detail / Edit Modal
  const handleOpenDealModal = (deal: Integration) => {
    setIsCreateMode(false);
    setSelectedDeal(deal);
    setModalActiveTab('details');
    setEditBloggerName(deal.bloggerName || '');
    setEditBloggerLink(deal.bloggerPageLink || '');
    setEditTelegramUsername(deal.telegramUsername || '');
    setTelegramContacts(parseTelegramContacts(deal.telegramUsername));
    setIsTgFocused(false);
    setEditPlatform(deal.platform || 'Instagram');
    setEditProjectId(deal.projectId || (projects[0] ? projects[0].id : ''));
    const startStage = deal.kanbanStage || columns[0]?.id || 'wishlist';
    setEditKanbanStage(startStage);
    setInitialKanbanStage(startStage);
    setEditPricePerSlot(deal.pricePerSlot ?? 0);
    setEditSlotsCount(deal.slotsCount || 1);
    setEditPaidAmount(deal.paidAmount || 0);
    setEditPaidSlotsCount(deal.paidSlotsCount ?? (deal.paidAmount && deal.pricePerSlot ? Math.min(deal.slotsCount, Math.floor(deal.paidAmount / deal.pricePerSlot)) : 0));
    setEditStartDate(deal.startDate || new Date().toISOString().split('T')[0]);
    setEditEndDate(deal.endDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setEditReferralLink(deal.referralLink || '');
    const req = deal.requisites || bloggerRequisitesList?.find(r => 
      (r.integrationId && String(r.integrationId) === String(deal.id)) ||
      (deal.bloggerName && r.bloggerName && r.bloggerName.replace(/^[@#]/, '').trim().toLowerCase() === deal.bloggerName.replace(/^[@#]/, '').trim().toLowerCase())
    );
    setEditCardNumber(req?.cardNumberOrIban || '');
    setEditCardName(req?.fullName || req?.recipientName || '');
    setIsCardCopied(false);
    setEditSubscribersCount(deal.subscribersCount ?? '');
    setEditCommentsList(parseComments(deal.comments));
    setNewCommentInput('');
    setEditStatus(deal.status || 'active');
    setSaveSuccess(false);
    setIsQuickMoving(false);
  };

  // Close Deal Modal
  const handleCloseDealModal = () => {
    setSelectedDeal(null);
    setIsCreateMode(false);
    setInitialKanbanStage('');
    setIsQuickMoving(false);
    setSaveSuccess(false);
    setModalActiveTab('details');
    setIsOpeningChat(false);
  };

  // Quick Move & Save directly to payment column ("Готов к оплате")
  const handleMoveToPaymentColumn = async () => {
    if (!paymentColumn) return;
    const targetStageId = paymentColumn.id;
    setEditKanbanStage(targetStageId);

    if (isCreateMode) {
      // In create mode, setting editKanbanStage is sufficient for when form is submitted
      return;
    }

    if (selectedDeal) {
      setIsQuickMoving(true);
      try {
        const calculatedTotal = Number(editPricePerSlot || 0) * Number(editSlotsCount || 0);

        let finalComments = [...editCommentsList];
        if (newCommentInput.trim()) {
          const authorName = currentUserEmail || (userRole ? `${lang === 'uz' ? 'Foydalanuvchi' : lang === 'en' ? 'User' : 'Пользователь'} (${userRole})` : (lang === 'uz' ? 'Foydalanuvchi' : lang === 'en' ? 'User' : 'Пользователь'));
          finalComments.push({
            id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            author: authorName,
            text: newCommentInput.trim(),
            createdAt: new Date().toISOString()
          });
          setNewCommentInput('');
        }

        const cleanCard = editCardNumber.trim();
        const cleanCardName = editCardName.trim();
        const existingReq = selectedDeal.requisites || bloggerRequisitesList?.find(r => 
          (r.integrationId && String(r.integrationId) === String(selectedDeal.id)) ||
          (r.bloggerName && r.bloggerName.replace(/^[@#]/, '').trim().toLowerCase() === editBloggerName.trim().toLowerCase())
        );

        let requisitesPayload: BloggerRequisites | undefined = undefined;
        if (cleanCard || cleanCardName) {
          requisitesPayload = {
            ...(existingReq || {}),
            id: existingReq?.id || `req-${selectedDeal.id}`,
            integrationId: String(selectedDeal.id),
            bloggerName: editBloggerName.trim() || selectedDeal.bloggerName,
            taxStatus: existingReq?.taxStatus || 'card_transfer',
            cardNumberOrIban: cleanCard,
            fullName: cleanCardName || existingReq?.fullName || editBloggerName.trim(),
            recipientName: cleanCardName || existingReq?.recipientName || existingReq?.fullName || editBloggerName.trim(),
            submittedAt: existingReq?.submittedAt || new Date().toISOString(),
            status: 'submitted',
          };
        } else if (existingReq) {
          requisitesPayload = {
            ...existingReq,
            cardNumberOrIban: '',
            fullName: '',
            recipientName: '',
          };
        }

        const targetProjectId = editProjectId || projects[0]?.id || selectedDeal.projectId;

        const updatedFields: Partial<Integration> = {
          bloggerName: editBloggerName.trim(),
          bloggerPageLink: editBloggerLink.trim(),
          telegramUsername: editTelegramUsername.trim(),
          platform: editPlatform,
          projectId: targetProjectId,
          pricePerSlot: Number(editPricePerSlot) || 0,
          slotsCount: Number(editSlotsCount) || 1,
          totalAmount: calculatedTotal,
          paidAmount: Number(editPaidAmount) || 0,
          paidSlotsCount: Number(editPaidSlotsCount) || 0,
          startDate: selectedDeal.startDate || editStartDate || new Date().toISOString().split('T')[0],
          endDate: selectedDeal.endDate || editEndDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          referralLink: editReferralLink.trim(),
          comments: finalComments,
          status: editStatus,
          kanbanStage: targetStageId,
          subscribersCount: editSubscribersCount !== '' ? Number(editSubscribersCount) : undefined,
          requisites: requisitesPayload,
        };

        if (isChannelChangedInModal) {
          updatedFields.subscribersHistory = [];
          updatedFields.subscribersUpdatedAt = undefined;
          if (editSubscribersCount === '') {
            updatedFields.subscribersCount = undefined;
          }
        }

        // 1. Move stage immediately on board (optimistic)
        onUpdateIntegrationStage(selectedDeal.id, targetStageId);

        // 2. Persist deal with stage & requisites
        if (onEditIntegration) {
          await onEditIntegration(selectedDeal.id, updatedFields);
        }

        // 3. Mark success and close modal smoothly
        setSaveSuccess(true);
        setTimeout(() => {
          handleCloseDealModal();
        }, 500);
      } catch (err) {
        console.error('Failed to move deal to payment column:', err);
        alert(t.kanbanSaveErrorAlert || 'Ошибка при сохранении данных сделки');
      } finally {
        setIsQuickMoving(false);
      }
    }
  };

  // Save Deal Changes (Create or Edit)
  const handleSaveDealEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBloggerName.trim()) {
      alert(t.kanbanFillBloggerNameAlert || 'Пожалуйста, укажите имя или канал блогера');
      return;
    }
    const targetProjectId = editProjectId || projects[0]?.id || '';
    if (!targetProjectId) {
      alert(t.kanbanSelectProjectAlert || 'Пожалуйста, выберите проект');
      return;
    }

    setIsSavingEdit(true);
    try {
      const calculatedTotal = Number(editPricePerSlot || 0) * Number(editSlotsCount || 0);

      // Append typed comment in input box if user didn't explicitly click "Отправить"
      let finalComments = [...editCommentsList];
      if (newCommentInput.trim()) {
        const authorName = currentUserEmail || (userRole ? `${lang === 'uz' ? 'Foydalanuvchi' : lang === 'en' ? 'User' : 'Пользователь'} (${userRole})` : (lang === 'uz' ? 'Foydalanuvchi' : lang === 'en' ? 'User' : 'Пользователь'));
        finalComments.push({
          id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          author: authorName,
          text: newCommentInput.trim(),
          createdAt: new Date().toISOString()
        });
        setNewCommentInput('');
      }

      // Requisites payload handling (card number & name)
      let requisitesPayload: BloggerRequisites | undefined = undefined;
      const cleanCard = editCardNumber.trim();
      const cleanCardName = editCardName.trim();
      const existingReq = selectedDeal?.requisites || bloggerRequisitesList?.find(r => 
        selectedDeal && ((r.integrationId && String(r.integrationId) === String(selectedDeal.id)) ||
        (r.bloggerName && r.bloggerName.replace(/^[@#]/, '').trim().toLowerCase() === editBloggerName.trim().toLowerCase()))
      );

      if (cleanCard || cleanCardName) {
        requisitesPayload = {
          ...(existingReq || {}),
          id: existingReq?.id || `req-${selectedDeal?.id || Date.now()}`,
          integrationId: selectedDeal?.id ? String(selectedDeal.id) : '',
          bloggerName: editBloggerName.trim(),
          taxStatus: existingReq?.taxStatus || 'card_transfer',
          cardNumberOrIban: cleanCard,
          fullName: cleanCardName || existingReq?.fullName || editBloggerName.trim(),
          recipientName: cleanCardName || existingReq?.recipientName || existingReq?.fullName || editBloggerName.trim(),
          submittedAt: existingReq?.submittedAt || new Date().toISOString(),
          status: existingReq?.status || 'submitted',
        };
      } else if (existingReq) {
        requisitesPayload = {
          ...existingReq,
          cardNumberOrIban: '',
          fullName: '',
          recipientName: '',
        };
      }

      // Automatically promote to target payment column if card fields are filled
      let finalKanbanStage = editKanbanStage;
      if (areCardFieldsFilled && paymentColumn) {
        const isEarlyStage = !selectedDeal?.kanbanStage || 
          ['wishlist', 'negotiation', 'requisites_pending', 'contract', 'backlog'].includes(selectedDeal.kanbanStage);
        const stageUntouchedOrEarly = (editKanbanStage === initialKanbanStage && isEarlyStage);
        if (editKanbanStage === paymentColumn.id || stageUntouchedOrEarly) {
          finalKanbanStage = paymentColumn.id;
        }
      }

      if (isCreateMode) {
        await onAddIntegration({
          projectId: targetProjectId,
          bloggerName: editBloggerName.trim(),
          bloggerPageLink: editBloggerLink.trim() || '',
          telegramUsername: editTelegramUsername.trim() || undefined,
          platform: editPlatform,
          pricePerSlot: Number(editPricePerSlot) || 0,
          slotsCount: Number(editSlotsCount) || 1,
          paidSlotsCount: Number(editPaidSlotsCount) || 0,
          paidAmount: Number(editPaidAmount) || 0,
          startDate: editStartDate || new Date().toISOString().split('T')[0],
          endDate: editEndDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          referralLink: editReferralLink.trim() || '',
          comments: finalComments,
          status: editStatus,
          kanbanStage: finalKanbanStage,
          createdBy: currentUserName || currentUserEmail || undefined,
          subscribersCount: editSubscribersCount !== '' ? Number(editSubscribersCount) : undefined,
          requisites: requisitesPayload,
        });
      } else if (selectedDeal) {
        const currentTg = editTelegramUsername.trim();
        const oldTg = (selectedDeal.telegramUsername || '').trim();
        const isTgChanged = currentTg !== oldTg;

        const updatedFields: Partial<Integration> = {
          bloggerName: editBloggerName.trim(),
          bloggerPageLink: editBloggerLink.trim(),
          telegramUsername: currentTg ? currentTg : (null as any),
          platform: editPlatform,
          projectId: targetProjectId,
          pricePerSlot: Number(editPricePerSlot) || 0,
          slotsCount: Number(editSlotsCount) || 1,
          totalAmount: calculatedTotal,
          paidAmount: Number(editPaidAmount) || 0,
          paidSlotsCount: Number(editPaidSlotsCount) || 0,
          startDate: selectedDeal.startDate || editStartDate || new Date().toISOString().split('T')[0],
          endDate: selectedDeal.endDate || editEndDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          referralLink: editReferralLink.trim(),
          comments: finalComments,
          status: editStatus,
          kanbanStage: finalKanbanStage,
          subscribersCount: editSubscribersCount !== '' ? Number(editSubscribersCount) : undefined,
          requisites: requisitesPayload,
        };

        if (isTgChanged) {
          updatedFields.telegramChatId = null as any;
        }

        if (isChannelChangedInModal) {
          updatedFields.subscribersHistory = [];
          updatedFields.subscribersUpdatedAt = undefined;
          if (editSubscribersCount === '') {
            updatedFields.subscribersCount = undefined;
          }
        }

        if (onEditIntegration) {
          await onEditIntegration(selectedDeal.id, updatedFields);
        }
        if (finalKanbanStage !== selectedDeal.kanbanStage) {
          onUpdateIntegrationStage(selectedDeal.id, finalKanbanStage);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => {
        handleCloseDealModal();
      }, 400);
    } catch (err) {
      console.error('Error saving deal:', err);
      alert(isCreateMode ? (t.kanbanCreateErrorAlert || 'Ошибка при создании сделки') : (t.kanbanSaveErrorAlert || 'Ошибка при сохранении данных сделки'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Copy Magic Link for Requisites
  const handleCopyRequisitesLink = async (integration: Integration) => {
    const url = `${window.location.origin}${window.location.pathname}?view=requisites&token=${integration.id}`;
    await copyToClipboard(url);
    setCopiedId(integration.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Add / Edit Column logic
  const handleAddOrEditColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!columnTitleInput.trim()) return;

    if (editingColumnId) {
      // Edit
      const updated = columns.map(c => c.id === editingColumnId ? { ...c, title: columnTitleInput.trim() } : c);
      updateAndSaveColumns(updated);
    } else {
      // Add
      const newCol: KanbanColumn = {
        id: `col-${Date.now()}`,
        title: columnTitleInput.trim(),
        color: 'indigo'
      };
      const updated = [...columns, newCol];
      updateAndSaveColumns(updated);
    }

    setColumnTitleInput('');
    setEditingColumnId(null);
  };

  const handleDeleteColumn = (colId: string) => {
    if (SYSTEM_STAGE_IDS.includes(colId)) {
      alert('Этот этап является системным и не может быть удален. Вы можете переименовать его или скрыть.');
      return;
    }
    if (!window.confirm(t.kanbanDeleteColumnConfirm || 'Вы уверены, что хотите удалить этот столбец?')) return;
    const updated = columns.filter(c => c.id !== colId);
    updateAndSaveColumns(updated);
  };

  // Reorder columns in settings (arrows & drag-and-drop)
  const [draggedSettingsColId, setDraggedSettingsColId] = useState<string | null>(null);

  const handleMoveColumn = (colId: string, direction: 'up' | 'down') => {
    const backlog = columns.find(c => c.id === 'backlog');
    const rest = columns.filter(c => c.id !== 'backlog');
    const index = rest.findIndex(c => c.id === colId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const updatedRest = [...rest];
      const temp = updatedRest[index];
      updatedRest[index] = updatedRest[index - 1];
      updatedRest[index - 1] = temp;
      updateAndSaveColumns(backlog ? [backlog, ...updatedRest] : updatedRest);
    } else if (direction === 'down' && index < rest.length - 1) {
      const updatedRest = [...rest];
      const temp = updatedRest[index];
      updatedRest[index] = updatedRest[index + 1];
      updatedRest[index + 1] = temp;
      updateAndSaveColumns(backlog ? [backlog, ...updatedRest] : updatedRest);
    }
  };

  const handleSettingsDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedSettingsColId(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSettingsDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSettingsDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!draggedSettingsColId || draggedSettingsColId === targetColId) {
      setDraggedSettingsColId(null);
      return;
    }

    const backlog = columns.find(c => c.id === 'backlog');
    const rest = columns.filter(c => c.id !== 'backlog');
    const fromIndex = rest.findIndex(c => c.id === draggedSettingsColId);
    const toIndex = rest.findIndex(c => c.id === targetColId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const updatedRest = [...rest];
      const [movedItem] = updatedRest.splice(fromIndex, 1);
      updatedRest.splice(toIndex, 0, movedItem);
      updateAndSaveColumns(backlog ? [backlog, ...updatedRest] : updatedRest);
    }
    setDraggedSettingsColId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-2 font-sans">
      {/* Unified Compact Control Bar: Project Tabs, Search, Filters & Actions */}
      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-neutral-200/90 shadow-2xs space-y-2 shrink-0">
        {/* Project Quick Filter Tabs */}
        {projects && projects.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            <button
              type="button"
              onClick={() => handleSelectProject('all')}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-150 cursor-pointer shrink-0 ${
                selectedProjectId === 'all'
                  ? 'bg-black text-white font-bold shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium border border-slate-200/80'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${selectedProjectId === 'all' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
              <span>{t.kanbanAllProjects || 'Все проекты'}</span>
              <span
                className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold transition-colors ${
                  selectedProjectId === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/80 text-slate-600 group-hover:bg-slate-300/80'
                }`}
              >
                {loading && integrations.length === 0 ? (
                  <span className="inline-block w-4 h-3 bg-slate-300 animate-pulse rounded" />
                ) : (
                  totalKanbanCards
                )}
              </span>
            </button>

            {projects.map((project) => {
              const isSelected = String(selectedProjectId) === String(project.id);
              const count = projectDealCounts[String(project.id)] || 0;

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleSelectProject(isSelected ? 'all' : String(project.id))}
                  className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-150 cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-black text-white font-bold shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium border border-slate-200/80'
                  }`}
                >
                  <span>{project.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold transition-colors ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/80 text-slate-600 group-hover:bg-slate-300/80'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="h-px bg-slate-100" />

        {/* Search, Filter & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Search Bar: Compact & direct input */}
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                  }
                }}
                placeholder={t.kanbanSearchPlaceholder || 'Поиск по имени блогера...'}
                className="w-44 sm:w-60 h-8 pl-8 pr-7 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1.5 focus:ring-black transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={t.kanbanCloseSearchTitle || 'Очистить'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Platform selector */}
            <div className="flex items-center gap-1.5 h-8 bg-slate-50 hover:bg-slate-100/70 px-2.5 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-400 font-medium">{t.kanbanPlatformLabel || 'Платформа:'}</span>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">{t.kanbanAllPlatformsOption || 'Все платформы'}</option>
                <option value="Instagram">Instagram</option>
                <option value="Telegram">Telegram</option>
                <option value="YouTube">YouTube</option>
                <option value="TikTok">TikTok</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenRequisitesDirectory && (
              <button
                onClick={onOpenRequisitesDirectory}
                className="flex items-center gap-1.5 h-8 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>{t.kanbanRequisitesDirectoryBtn || 'База реквизитов'}</span>
              </button>
            )}

            <button
              onClick={() => {
                setEditingColumnId(null);
                setColumnTitleInput('');
                setIsColumnModalOpen(true);
              }}
              className="flex items-center gap-1.5 h-8 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 transition cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.kanbanConfigureColumnsBtn || 'Настройка столбцов'}</span>
            </button>

            {/* Personal Telegram (QR) Gateway - Super Admin Only */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsGatewayModalOpen(true)}
                className={`flex items-center gap-1.5 h-8 px-2.5 font-semibold text-xs rounded-lg border transition cursor-pointer shadow-2xs ${
                  gatewayStatus && !gatewayStatus.isAuthorized
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 ring-2 ring-rose-400/50 animate-pulse'
                    : gatewayStatus?.isAuthorized
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200'
                }`}
                title={
                  gatewayStatus && !gatewayStatus.isAuthorized
                    ? (lang === 'uz' ? 'DIQQAT: Telegram uzilgan! QR-kodni zudlik bilan skanerlang' : lang === 'en' ? 'WARNING: Telegram disconnected! Scan QR code immediately' : 'ВНИМАНИЕ: Рабочий Telegram отвязан! Нажмите для срочного сканирования QR-кода')
                    : gatewayStatus?.isAuthorized && gatewayStatus.user?.username
                    ? `Telegram: @${gatewayStatus.user.username} (Подключен)`
                    : (lang === 'uz' ? 'Shaxsiy Telegramni ulash' : lang === 'en' ? 'Connect personal Telegram' : 'Подключить личный рабочий Telegram по QR-коду')
                }
              >
                {gatewayStatus && !gatewayStatus.isAuthorized ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                ) : gatewayStatus?.isAuthorized ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                ) : (
                  <QrCode className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                )}
                <span>
                  {gatewayStatus && !gatewayStatus.isAuthorized
                    ? (lang === 'uz' ? 'TG uzilgan! (QR)' : lang === 'en' ? 'TG Disconnected! (QR)' : 'TG отвязан! (QR)')
                    : gatewayStatus?.isAuthorized && gatewayStatus.user?.username
                    ? `@${gatewayStatus.user.username}`
                    : (lang === 'uz' ? 'Shaxsiy TG (QR)' : lang === 'en' ? 'Personal TG (QR)' : 'Личный Telegram (QR)')
                  }
                </span>
              </button>
            )}

            <button
              onClick={() => handleOpenCreateDealModal()}
              className="flex items-center gap-1.5 h-8 px-3 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-lg shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.kanbanAddBloggerBtn || 'Добавить блогера'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Super Admin Alert Banner: Displayed when Personal Telegram Session is disconnected */}
      {isSuperAdmin && gatewayStatus && !gatewayStatus.isAuthorized && (
        <div className="mb-3 p-3 sm:p-3.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white rounded-2xl shadow-lg border border-rose-300/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl shrink-0 ring-2 ring-white/30">
              <AlertTriangle className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm tracking-tight text-white">
                  {lang === 'uz' ? 'Diqqat: Ishchi Telegram uzilgan!' : lang === 'en' ? 'Attention: Working Telegram disconnected!' : 'Внимание: Рабочий Telegram отвязан!'}
                </h4>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white text-rose-700 px-2 py-0.5 rounded-full shadow-xs">
                  {lang === 'uz' ? 'Shoshilinch' : lang === 'en' ? 'Urgent' : 'Срочно'}
                </span>
              </div>
              <p className="text-xs text-rose-50 font-medium mt-0.5 leading-snug">
                {lang === 'uz' 
                  ? 'Bloggerlar bilan xabarlar almashinuvi to‘xtab qolmasligi uchun telefoningizdagi Telegram orqali QR-kodni zudlik bilan skanerlang.'
                  : lang === 'en'
                  ? 'To keep messaging bloggers without interruption, scan the QR code immediately using Telegram on your phone.'
                  : 'Отправка и приём сообщений с блогерами приостановлены. Отсканируйте QR-код через приложение Telegram на телефоне (Настройки → Устройства → Подключить устройство).'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsGatewayModalOpen(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white hover:bg-rose-50 text-rose-700 font-extrabold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer ring-2 ring-white/60"
          >
            <QrCode className="w-4 h-4 text-rose-600" />
            <span>{lang === 'uz' ? 'QR-kodni skanerlash' : lang === 'en' ? 'Scan QR Code' : 'Сканировать QR-код'}</span>
          </button>
        </div>
      )}

      {/* Kanban Dynamic Columns Horizontal Scroll Container */}
      <div className="flex gap-2.5 items-stretch overflow-x-auto overflow-y-hidden pb-1 pt-0.5 snap-x flex-1 min-h-0">
        {visibleColumns.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-center px-6 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3 text-slate-600">
              <Plus className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 mb-1">
              {t.kanbanEmptyColumnsTitle || 'Все этапы скрыты или отсутствуют'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mb-4 leading-relaxed">
              {t.kanbanEmptyColumnsDesc || 'Откройте «Настройка столбцов», чтобы включить отображение столбцов или создать новые.'}
            </p>
            <button
              onClick={() => {
                setEditingColumnId(null);
                setColumnTitleInput('');
                setIsColumnModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Settings2 className="w-4 h-4" />
              <span>{t.kanbanConfigureColumnsBtn || 'Настройка столбцов'}</span>
            </button>
          </div>
        ) : (
          visibleColumns.map((column, colIdx) => {
          const isFirstCol = colIdx === 0;
          const columnDeals = columnDataMap.get(column.id) || [];
          const totalColumnBudget = columnDeals.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
          const isOver = dragOverColumnId === column.id;
          const isBacklogOverFirstCol = isFirstCol && isBacklogHidden && dragOverColumnId === 'backlog';

          return (
            <div
              key={column.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (isFirstCol && isBacklogHidden) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (e.clientX - rect.left < 130) {
                    handleDragOverColumn(e, 'backlog');
                    return;
                  }
                }
                handleDragOverColumn(e, column.id);
              }}
              onDragLeave={() => {
                handleDragLeaveColumn(column.id);
                if (isFirstCol && dragOverColumnId === 'backlog') {
                  handleDragLeaveColumn('backlog');
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (isFirstCol && isBacklogHidden) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (e.clientX - rect.left < 130 || dragOverColumnId === 'backlog') {
                    handleDropOnColumn(e, 'backlog');
                    return;
                  }
                }
                handleDropOnColumn(e, column.id);
              }}
              className={`relative flex flex-col bg-white rounded-xl border overflow-hidden transition-all duration-150 w-[290px] min-w-[290px] shrink-0 h-full max-h-full ${
                isBacklogOverFirstCol
                  ? 'border-neutral-900 ring-2 ring-neutral-900/40 bg-neutral-100/60 shadow-md'
                  : isOver 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-md' 
                    : 'border-neutral-200 shadow-2xs'
              }`}
            >
              {/* Backlog Drop Hint on first column when hovering left edge */}
              {isBacklogOverFirstCol && (
                <div className="absolute top-2 left-2 z-30 pointer-events-none bg-black text-white text-[11px] font-black px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in">
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{t.kanbanBacklogDropHint || 'В архив Backlog (не договорились)'}</span>
                </div>
              )}
              {/* Column Header: Compact Single Row with Title, Count, Budget and Actions */}
              <div className="px-3 py-2 border-b border-neutral-200 bg-slate-50/90 flex items-center justify-between gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-xs text-slate-900 uppercase tracking-wider truncate">
                    {getLocalizedColumnTitle(column, lang)}
                  </span>
                  {column.id === 'backlog' && (
                    <span className="px-1.5 py-0.2 text-[9px] bg-slate-200 text-slate-700 rounded font-bold shrink-0">
                      {t.kanbanBacklogBadge || 'Отказы'}
                    </span>
                  )}
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-black text-white shrink-0">
                    {columnDeals.length}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {totalColumnBudget > 0 && (
                    <span 
                      className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200/90 px-1.5 py-0.5 rounded cursor-help"
                      title={`${t.kanbanTotalLabel || 'Итого:'} ${totalColumnBudget.toLocaleString()} UZS`}
                    >
                      {totalColumnBudget >= 1_000_000 
                        ? `${(totalColumnBudget / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` 
                        : `${Math.round(totalColumnBudget / 1_000)}k`} UZS
                    </span>
                  )}
                  {column.id === 'backlog' && (
                    <button
                      type="button"
                      onClick={() => handleToggleColumnVisibility('backlog')}
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-black transition cursor-pointer"
                      title={t.kanbanHideBacklogTitle || 'Скрыть колонку Backlog с доски'}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {columnDeals.length > 0 && onClearStage && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(lang === 'ru' 
                          ? `Убрать все карточки (${columnDeals.length}) из столбца "${getLocalizedColumnTitle(column, lang)}" с доски? Сами интеграции и статистика блогеров останутся в системе.`
                          : lang === 'uz'
                          ? `"${getLocalizedColumnTitle(column, lang)}" ustunidagi barcha kartochkalarni (${columnDeals.length}) doskadan olib tashlansinmi? Integratsiyalar va statistika tizimda saqlanib qoladi.`
                          : `Remove all cards (${columnDeals.length}) from "${getLocalizedColumnTitle(column, lang)}"? Integrations and blogger statistics will remain preserved.`
                        )) {
                          onClearStage(column.id);
                        }
                      }}
                      title={`${t.kanbanClearStageTooltip || 'Очистить столбец'} (${getLocalizedColumnTitle(column, lang)})`}
                      className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenCreateDealModal(column.id)}
                    title={`${t.kanbanAddCardTooltip || 'Добавить карточку'} -> ${getLocalizedColumnTitle(column, lang)}`}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-black transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Cards List Drop Target with Internal Scrollable Area */}
              <div className="p-2 space-y-1.5 overflow-y-auto flex-1 min-h-0">
                {columnDeals.length === 0 ? (
                  loading && integrations.length === 0 ? (
                    <div className="space-y-2 p-1">
                      <div className="h-16 bg-slate-100/90 animate-pulse rounded-lg" />
                      <div className="h-14 bg-slate-100/70 animate-pulse rounded-lg" />
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg p-2 text-center transition ${
                      isOver ? 'border-indigo-400 bg-indigo-50/40 text-indigo-600' : 'border-slate-200 text-slate-400'
                    }`}>
                      <Clock className="w-4 h-4 mb-1 opacity-40" />
                      <span className="text-[11px] font-semibold">{t.kanbanDragHere || 'Перетащите сюда'}</span>
                    </div>
                  )
                ) : (
                  columnDeals.map((deal) => {
                    const project = projects.find(p => p.id === deal.projectId);
                    const hasRequisites = !!deal.requisites || (bloggerRequisitesList && bloggerRequisitesList.some(r => 
                      (r.integrationId && String(r.integrationId) === String(deal.id)) ||
                      (deal.bloggerName && r.bloggerName && r.bloggerName.replace(/^[@#]/, '').trim().toLowerCase() === deal.bloggerName.replace(/^[@#]/, '').trim().toLowerCase())
                    ));
                    const isDragging = draggedDealId === deal.id;

                    return (
                      <div
                        key={deal.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => {
                          if (isDraggingRef.current) return;
                          handleOpenDealModal(deal);
                        }}
                        className={`group relative bg-white p-2.5 rounded-lg border border-neutral-200 shadow-2xs hover:shadow-xs hover:border-slate-400 transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                          isDragging ? 'opacity-30 border-dashed border-neutral-400' : ''
                        } ${draggedDealId && !isDragging ? 'pointer-events-none' : ''}`}
                      >
                        {/* Top Bar: Badges + Hover actions */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <GripVertical className="w-3 h-3 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab" />
                            <span className={`px-1.5 py-0.2 text-[9px] font-black rounded uppercase tracking-wider shrink-0 ${getPlatformBadgeClasses(deal.platform)}`}>
                              {deal.platform}
                            </span>
                            {project && (
                              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 text-[10px] font-bold rounded truncate max-w-[120px]">
                                {project.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDealModal(deal);
                              }}
                              className="p-0.5 text-slate-400 hover:text-black transition cursor-pointer"
                              title={t.kanbanEditDealTooltip || 'Редактировать сделку'}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>

                            {onDeleteIntegration && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteIntegration(deal.id);
                                }}
                                className="p-0.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title={t.deleteTooltip || 'Удалить'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Blogger Name & Contact Handles */}
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs group-hover:text-indigo-600 transition leading-snug line-clamp-1">
                            {deal.bloggerName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {deal.bloggerPageLink && (
                              <a
                                href={deal.bloggerPageLink}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 hover:text-black bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 transition"
                              >
                                <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                                <span>{t.kanbanChannelLink || 'Канал / Страница'}</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveChatDeal(deal);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-sky-500 hover:text-white px-1.5 py-0.5 rounded border border-slate-200/80 transition group/chat cursor-pointer"
                              title={lang === 'uz' ? 'Telegram chat (CRM)' : lang === 'en' ? 'Telegram Chat (CRM)' : 'Онлайн-диалог в Telegram'}
                            >
                              <MessageSquare className="w-2.5 h-2.5 text-sky-500 group-hover/chat:text-white" />
                              <span>{lang === 'uz' ? 'Chat' : lang === 'en' ? 'Chat' : 'Чат'}</span>
                              {deal.telegramChatId ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Подключен" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Ожидает подключения" />
                              )}
                            </button>
                          </div>

                          {deal.createdBy && (
                            <div className="mt-1">
                              <span className="text-[9px] text-slate-400 truncate block" title={`${t.kanbanCreatedByLabel || 'Создал:'} ${deal.createdBy}`}>
                                • {deal.createdBy}
                              </span>
                            </div>
                          )}

                          {/* Compact Comment Preview */}
                          {(() => {
                            const commentsArr = parseComments(deal.comments);
                            if (commentsArr.length === 0) return null;
                            const lastComment = commentsArr[commentsArr.length - 1];
                            return (
                              <div className="mt-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 text-[10px] text-slate-600 flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1 truncate">
                                  <MessageSquare className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span className="italic truncate font-medium">«{lastComment.text}»</span>
                                </div>
                                {commentsArr.length > 1 && (
                                  <span className="px-1 py-0.2 bg-slate-200 text-slate-700 font-bold rounded text-[9px] shrink-0">
                                    +{commentsArr.length - 1}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Amount & Requisites */}
                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                          <div className="flex items-baseline gap-1">
                            <span className="font-black text-slate-900">
                              {(deal.totalAmount || (deal.pricePerSlot * deal.slotsCount)).toLocaleString()}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">UZS</span>
                          </div>

                          {/* Requisites Status & Quick Copy */}
                          <div className="flex items-center gap-1">
                            {hasRequisites ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>{t.kanbanRequisitesFilled || 'Заполнены'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-700 font-medium bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded">
                                <Clock className="w-2.5 h-2.5 text-amber-600" />
                                <span>{t.kanbanRequisitesPending || 'Ожидаются'}</span>
                              </span>
                            )}

                            {/* Quick copy requisites link button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyRequisitesLink(deal);
                              }}
                              title={copiedId === deal.id ? (t.kanbanCopiedSuccess || 'Скопировано!') : (t.kanbanRequisitesLinkBtn || 'Скопировать ссылку на реквизиты')}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition cursor-pointer"
                            >
                              {copiedId === deal.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Action Button for 'ready_for_payment' Stage: Создать отчёт */}
                        {(column.id === 'ready_for_payment' || column.id === paymentColumn.id || deal.kanbanStage === 'ready_for_payment' || deal.kanbanStage === paymentColumn.id) && onNavigateToReports && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToReports(deal);
                            }}
                            className="w-full flex items-center justify-center gap-1 py-1 bg-black hover:bg-neutral-800 active:bg-neutral-900 text-white font-bold text-[11px] rounded-md shadow-2xs transition cursor-pointer"
                          >
                            <FilePlus className="w-3 h-3" />
                            <span>{t.createReport || 'Создать отчет'}</span>
                          </button>
                        )}

                        {/* Stage Micro-Selector */}
                        <select
                          value={deal.kanbanStage || column.id}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            onUpdateIntegrationStage(deal.id, e.target.value);
                          }}
                          className="w-full text-[10px] font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded px-1.5 py-0.5 text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer transition"
                        >
                          {columns.map(c => (
                            <option key={c.id} value={c.id}>
                              {getLocalizedColumnTitle(c, lang)} {c.id === 'backlog' ? `📁 (${t.kanbanBacklogBadge || 'Отказы'})` : c.hidden ? `(${t.kanbanHiddenBadge || 'скрытая'})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })
      )}
      </div>

      {/* Column Management Modal */}
      {isColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 border border-neutral-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <Settings2 className="w-5 h-5" /> {t.kanbanColumnsSettingsTitle || 'Настройка столбцов Канбана'}
              </h3>
              <button onClick={() => setIsColumnModalOpen(false)} className="text-slate-400 hover:text-black font-bold">✕</button>
            </div>

            {/* Dedicated Backlog Toggle Card */}
            {(() => {
              const backlogCol = columns.find(c => c.id === 'backlog');
              if (!backlogCol) return null;
              const backlogDeals = columnDataMap.get('backlog') || [];
              const isVisible = !backlogCol.hidden;
              return (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isVisible ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-900">{t.kanbanBacklogCardTitle || 'Колонка Backlog'}</span>
                        <span className="px-2 py-0.5 text-[10px] bg-slate-200 text-slate-700 rounded-full font-black shrink-0">
                          {backlogDeals.length}
                        </span>
                      </div>
                      {((isVisible ? t.kanbanBacklogVisibleDesc : t.kanbanBacklogHiddenDesc) || '').trim() && (
                        <p className="text-[11px] text-slate-500 font-medium">
                          {isVisible ? t.kanbanBacklogVisibleDesc : t.kanbanBacklogHiddenDesc}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleColumnVisibility('backlog')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      isVisible
                        ? 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50 shadow-2xs'
                        : 'bg-black text-white border-black hover:bg-neutral-800 shadow-xs'
                    }`}
                  >
                    {isVisible ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>{t.kanbanHideFromBoard || 'Скрыть с доски'}</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t.kanbanShowOnBoard || 'Показать на доске'}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })()}

            {/* Dedicated Target Payment Column ("Готов к оплате") Selector Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900">
                        {t.kanbanPaymentStageSettingHeader || 'Целевой столбец «Готов к оплате»'}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] bg-indigo-100 text-indigo-700 rounded-full font-black truncate max-w-[140px]">
                        {paymentColumn.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {t.kanbanPaymentStageSettingDesc || 'Столбец, в который карточка переносится при заполнении карты и имени блогера:'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <select
                  value={paymentColumn.id}
                  onChange={(e) => handleSetPaymentStageColId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-black cursor-pointer transition shadow-2xs"
                >
                  {columns.filter(c => c.id !== 'backlog').map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title} {c.id === 'ready_for_payment' ? `(${t.kanbanDefaultBadge || 'по умолчанию'})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>


            {/* Existing columns list with reordering */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(() => {
                const nonBacklogCols = columns.filter(col => col.id !== 'backlog');
                return nonBacklogCols.map((col, idx) => {
                  const isSystem = SYSTEM_STAGE_IDS.includes(col.id);
                  const isDraggingThis = draggedSettingsColId === col.id;
                  return (
                    <div 
                      key={col.id}
                      draggable={true}
                      onDragStart={(e) => handleSettingsDragStart(e, col.id)}
                      onDragOver={handleSettingsDragOver}
                      onDrop={(e) => handleSettingsDrop(e, col.id)}
                      onDragEnd={() => setDraggedSettingsColId(null)}
                      className={`flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-xl border transition-all ${
                        isDraggingThis 
                          ? 'opacity-40 border-dashed border-indigo-500 bg-indigo-50/20' 
                          : 'border-slate-200 hover:border-slate-300 hover:bg-white shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                        {/* Reorder controls (Grip + Up/Down arrows) */}
                        <div className="flex items-center gap-1 shrink-0 text-slate-400 mr-1 select-none">
                          <GripVertical className="w-3.5 h-3.5 cursor-grab active:cursor-grabbing hover:text-black" />
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveColumn(col.id, 'up')}
                              className={`p-0.5 rounded hover:bg-slate-200 transition ${
                                idx === 0 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:text-black'
                              }`}
                              title="Переместить левее (выше)"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === nonBacklogCols.length - 1}
                              onClick={() => handleMoveColumn(col.id, 'down')}
                              className={`p-0.5 rounded hover:bg-slate-200 transition ${
                                idx === nonBacklogCols.length - 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:text-black'
                              }`}
                              title="Переместить правее (ниже)"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate text-xs font-bold text-slate-800">{col.title}</span>
                        {col.id === paymentColumn.id ? (
                          <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold shrink-0 flex items-center gap-1">
                            <CreditCard className="w-2.5 h-2.5" />
                            <span>{t.kanbanTargetForPaymentBadge || 'Готов к оплате'}</span>
                          </span>
                        ) : col.id === 'ready_for_payment' ? (
                          <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold shrink-0">
                            Кнопка отчёта
                          </span>
                        ) : null}
                        {col.id === 'paid_in_progress' && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold shrink-0">
                            Оплата
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {col.id !== paymentColumn.id && col.id !== 'backlog' && (
                          <button
                            type="button"
                            onClick={() => handleSetPaymentStageColId(col.id)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                            title={t.kanbanSetAsPaymentStageTooltip || 'Назначить целевым столбцом для готовых к оплате'}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleColumnVisibility(col.id)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                            !col.hidden
                              ? 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                              : 'bg-slate-200/80 text-slate-500 border-slate-300 hover:bg-slate-300'
                          }`}
                          title={col.hidden ? (t.kanbanShowOnBoard || 'Показать на доске') : (t.kanbanHideFromBoard || 'Скрыть с доски')}
                        >
                          {!col.hidden ? (
                            <>
                              <Eye className="w-3 h-3 text-emerald-600" />
                              <span>{t.kanbanOnBoardBadge || 'На доске'}</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-slate-400" />
                              <span>{t.kanbanHiddenBadge || 'Скрыт'}</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => { setEditingColumnId(col.id); setColumnTitleInput(col.title); }}
                          className="p-1 text-slate-400 hover:text-black transition cursor-pointer"
                          title={t.editTooltip || 'Переименовать'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {isSystem ? (
                          <span
                            className="p-1 text-slate-300 cursor-not-allowed flex items-center"
                            title="Системный этап (удаление недоступно, можно только переименовать или скрыть)"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDeleteColumn(col.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title={t.deleteTooltip || 'Удалить'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Add / Edit Form */}
            <form onSubmit={handleAddOrEditColumn} className="space-y-3 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {editingColumnId ? (t.kanbanRenameColumnHeader || 'Переименовать столбец') : (t.kanbanAddNewColumnHeader || 'Добавить новый столбец')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={columnTitleInput}
                  onChange={(e) => setColumnTitleInput(e.target.value)}
                  placeholder={t.kanbanColumnNamePlaceholder || 'Название столбца (напр., Проверка Оферты)'}
                  className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs shrink-0"
                >
                  {editingColumnId ? (t.kanbanSaveDealBtn || 'Сохранить') : (t.kanbanAddBtn || 'Добавить')}
                </button>
              </div>
            </form>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsColumnModalOpen(false)}
                className="px-5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs rounded-xl"
              >
                {t.kanbanDoneBtn || 'Готово'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View, Edit & Create Deal Details */}
      {(selectedDeal || isCreateMode) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-6 border border-neutral-200 my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-black text-white rounded-2xl shadow-xs">
                  {isCreateMode ? <Plus className="w-6 h-6" /> : <User className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-xl text-slate-900 tracking-tight">
                      {isCreateMode ? (t.kanbanModalCreateTitle || 'Добавить блогера в Канбан') : selectedDeal?.bloggerName}
                    </h3>
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider shrink-0 ${getPlatformBadgeClasses(editPlatform)}`}>
                      {editPlatform}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className="text-xs font-medium text-slate-500">
                      {isCreateMode ? (t.kanbanModalCreateSub || 'Заполните параметры и создайте новую сделку') : (t.kanbanModalEditSub || 'Информация и редактирование сделки')}
                    </p>
                    {isCreateMode && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 border border-slate-200/80 rounded-lg text-[10px] text-slate-700 font-medium">
                        <User className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{t.creatingAsUser || 'Создает:'} <strong className="text-slate-900 font-bold">{currentUserName || currentUserEmail || 'Super Admin'}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseDealModal}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center font-bold text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Action Buttons (Edit mode only) */}
            {!isCreateMode && selectedDeal && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {(selectedDeal.kanbanStage === 'ready_for_payment' || selectedDeal.kanbanStage === paymentColumn.id || editKanbanStage === 'ready_for_payment' || editKanbanStage === paymentColumn.id) && onNavigateToReports && (
                  <button
                    type="button"
                    onClick={() => {
                      const dealToReport = { ...selectedDeal, kanbanStage: editKanbanStage };
                      handleCloseDealModal();
                      onNavigateToReports(dealToReport);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>{t.createReport || 'Создать отчет'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleCopyRequisitesLink(selectedDeal)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  {copiedId === selectedDeal.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.kanbanCopiedSuccess || 'Скопировано!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t.kanbanRequisitesLinkBtn || 'Ссылка на реквизиты'}</span>
                    </>
                  )}
                </button>

                {selectedDeal.bloggerCabinetToken && (
                  <button
                    type="button"
                    onClick={async () => {
                      const url = getCabinetUrl(selectedDeal.bloggerCabinetToken);
                      await copyToClipboard(url);
                      setCopiedCabinet(true);
                      setTimeout(() => setCopiedCabinet(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
                  >
                    {copiedCabinet ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{t.kanbanCopiedSuccess || 'Скопировано!'}</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        <span>{t.kanbanBloggerCabinetBtn || 'Кабинет блогера'}</span>
                      </>
                    )}
                  </button>
                )}




                <button
                  type="button"
                  onClick={() => {
                    if (modalActiveTab === 'chat') {
                      setModalActiveTab('details');
                    } else {
                      handleOpenChatTab();
                    }
                  }}
                  disabled={isOpeningChat}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                    modalActiveTab === 'chat'
                      ? 'bg-[#229ED9] text-white border-[#229ED9] shadow-xs'
                      : 'bg-sky-50 hover:bg-sky-100 text-[#229ED9] border-sky-200/80'
                  }`}
                  title="Открыть онлайн Telegram-чат прямо в карточке"
                >
                  {isOpeningChat ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5" />
                  )}
                  <span>{lang === 'uz' ? 'Telegram Chat' : lang === 'en' ? 'Telegram Chat' : 'Telegram Чат'}</span>
                  {Boolean(editTelegramUsername.trim() || selectedDeal.telegramChatId || selectedDeal.telegramUsername) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </button>
              </div>
            )}

            {/* Modal Body: Switch between Chat and Details Form */}
            {modalActiveTab === 'chat' && !isCreateMode && selectedDeal ? (
              <div className="flex-1 min-h-[460px] flex flex-col overflow-hidden">
                <BloggerTelegramChat
                  integration={selectedDeal}
                  lang={lang}
                  userRole={userRole}
                  currentUserEmail={currentUserEmail}
                  currentUserName={currentUserName || currentUserEmail}
                  isInline={true}
                  onIntegrationUpdated={(updated) => {
                    setSelectedDeal(updated);
                    setEditTelegramUsername(updated.telegramUsername || '');
                    setTelegramContacts(parseTelegramContacts(updated.telegramUsername));
                    if (onEditIntegration) onEditIntegration(updated.id, updated);
                  }}
                />
              </div>
            ) : (
            /* Scrollable Form Body */
            <form id="deal-edit-form" onSubmit={handleSaveDealEdit} className="space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Creator Info (when viewing/editing) */}
              {!isCreateMode && selectedDeal && (
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>{t.kanbanCreatedByLabel || 'Создатель карточки:'} <strong className="text-slate-900 font-bold">{selectedDeal.createdBy || (t.kanbanNotSpecified || 'Не указан')}</strong></span>
                  </div>
                  {selectedDeal.startDate && (
                    <span className="text-slate-400 text-[11px]">
                      {t.kanbanStartDateLabel || 'Дата старта:'} {selectedDeal.startDate}
                    </span>
                  )}
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {t.kanbanBloggerNameLabel || 'Имя / Канал блогера *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editBloggerName}
                    onChange={(e) => setEditBloggerName(e.target.value)}
                    placeholder={t.kanbanBloggerNamePlaceholder || 'например, @tech_blogger_uz'}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {t.kanbanBloggerLinkLabel || 'Ссылка на страницу / канал'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editBloggerLink}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditBloggerLink(val);
                        const trimmed = val.trim().toLowerCase();
                        if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
                          if (editPlatform !== 'YouTube') setEditPlatform('YouTube');
                        } else if (trimmed.includes('t.me') || trimmed.includes('telegram.me')) {
                          if (editPlatform !== 'Telegram') setEditPlatform('Telegram');
                        } else if (trimmed.includes('instagram.com') || trimmed.includes('instagr.am')) {
                          if (editPlatform !== 'Instagram') setEditPlatform('Instagram');
                        } else if (trimmed.includes('tiktok.com')) {
                          if (editPlatform !== 'TikTok') setEditPlatform('TikTok');
                        }
                      }}
                      placeholder="https://instagram.com/..."
                      className="flex-1 min-w-0 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                    />
                    {editBloggerLink.trim() && (
                      <a
                        href={editBloggerLink.trim().startsWith('http://') || editBloggerLink.trim().startsWith('https://') ? editBloggerLink.trim() : `https://${editBloggerLink.trim()}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black rounded-xl border border-slate-200 transition shrink-0"
                        title={t.kanbanOpenChannelBtn || 'Открыть канал'}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      {t.kanbanBloggerTgLabel || 'Личный Telegram блогера (для связи)'}
                    </label>
                    {telegramContacts.length > 1 && !isTgFocused && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {lang === 'uz' ? `Kontaktlar: ${telegramContacts.length}` : lang === 'en' ? `Contacts: ${telegramContacts.length}` : `Контактов: ${telegramContacts.length}`}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {telegramContacts.map((contact, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="text"
                              value={contact}
                              onChange={(e) => updateTelegramContact(idx, e.target.value)}
                              onFocus={() => {
                                if (tgBlurTimeoutRef.current) {
                                  clearTimeout(tgBlurTimeoutRef.current);
                                  tgBlurTimeoutRef.current = null;
                                }
                                setIsTgFocused(true);
                              }}
                              onBlur={() => {
                                if (tgBlurTimeoutRef.current) {
                                  clearTimeout(tgBlurTimeoutRef.current);
                                }
                                tgBlurTimeoutRef.current = setTimeout(() => {
                                  setIsTgFocused(false);
                                }, 200);
                              }}
                              placeholder={idx === 0 
                                ? (t.kanbanBloggerTgPlaceholder || 'например, @username или https://t.me/username') 
                                : (lang === 'uz' ? "Qo'shimcha @username yoki raqam" : lang === 'en' ? 'Additional @username or number' : 'Дополнительный @username или номер')}
                              className="w-full pl-9 pr-38 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <Send className="w-3.5 h-3.5 text-sky-500" />
                            </div>

                            {/* Button inside input: open Telegram chat inside platform */}
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                              <button
                                type="button"
                                onClick={handleOpenChatTab}
                                disabled={isCreateMode || !selectedDeal || isOpeningChat}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-xs cursor-pointer ${
                                  isCreateMode || !selectedDeal
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                    : 'bg-[#229ED9] hover:bg-[#1b8bc2] active:bg-[#177fa2] text-white'
                                }`}
                                title={
                                  isCreateMode || !selectedDeal
                                    ? (lang === 'uz' ? 'Platformada chat kartochka yaratilgandan so‘ng ochiladi' : lang === 'en' ? 'Chat available after creating deal' : 'Чат в платформе доступен после сохранения карточки')
                                    : (lang === 'uz' ? 'Platformada Telegram chatni ochish' : lang === 'en' ? 'Open Telegram chat in platform' : 'Открыть онлайн Telegram-чат прямо в платформе')
                                }
                              >
                                {isOpeningChat ? (
                                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                                ) : (
                                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                                )}
                                <span>{t.kanbanChatInPlatform || 'Чат в платформе'}</span>
                                {Boolean(editTelegramUsername.trim() || selectedDeal?.telegramChatId) && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 ring-1 ring-white/50 shrink-0" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Button next to input: redirect to blogger's account in Telegram application */}
                          {contact.trim() && (
                            <a
                              href={getTelegramAppUrl(contact)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-center px-2.5 py-2 bg-slate-100 hover:bg-sky-50 text-sky-600 hover:text-sky-700 rounded-xl border border-slate-200 hover:border-sky-300 transition shrink-0"
                              title={t.kanbanOpenInTelegramApp || 'Открыть в приложении Telegram'}
                            >
                              <Send className="w-4 h-4 text-sky-500" />
                            </a>
                          )}

                          {/* Remove additional contact button */}
                          {telegramContacts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTgContact(idx)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl border border-slate-200/60 hover:border-rose-200 transition shrink-0 cursor-pointer"
                              title={lang === 'uz' ? "Ushbu kontaktni o'chirish" : lang === 'en' ? 'Remove this contact' : 'Удалить этот контакт'}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {idx === 0 && contact.trim() && isPhoneLike(contact) && (
                          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 pl-1">
                            <span>📱</span>
                            <span>
                              {lang === 'uz'
                                ? "Telefon raqami kiritildi (Telegramda mavjud bo‘lsa, tizim avtomatik bog‘laydi)"
                                : "Указан номер телефона (если аккаунт зарегистрирован, система автоматически свяжет его)"}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add another number or username action (shown only when focused) */}
                  {isTgFocused && (
                    <div className="flex items-center justify-between mt-2">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (tgBlurTimeoutRef.current) {
                            clearTimeout(tgBlurTimeoutRef.current);
                            tgBlurTimeoutRef.current = null;
                          }
                          handleAddTgContact();
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-200/80 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.kanbanAddAnotherTg || 'Добавить ещё один номер или юзернейм'}</span>
                      </button>
                      {telegramContacts.length > 1 && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {lang === 'uz' ? `Kontaktlar: ${telegramContacts.length}` : lang === 'en' ? `Contacts: ${telegramContacts.length}` : `Контактов: ${telegramContacts.length}`}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 mt-1">
                    {t.kanbanBloggerTgHint || 'Укажите @юзернейм, ник или номер блогера для общения прямо в карточке на доске'}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {t.kanbanPlatformLabel || 'Платформа'}
                  </label>
                  <select
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition cursor-pointer"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Telegram">Telegram</option>
                    <option value="YouTube">YouTube</option>
                    <option value="TikTok">TikTok</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {t.kanbanProjectLabel || 'Проект *'}
                  </label>
                  <select
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition cursor-pointer"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {t.kanbanStageLabel || 'Колонка / Этап Канбана'}
                  </label>
                  <select
                    value={editKanbanStage}
                    onChange={(e) => setEditKanbanStage(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition cursor-pointer"
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {getLocalizedColumnTitle(c, lang)} {c.id === 'backlog' ? `📁 (${t.kanbanBacklogBadge || 'Отказы'})` : c.hidden ? `(${t.kanbanHiddenBadge || 'скрытая'})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {t.kanbanDealStatusLabel || 'Статус сделки'}
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition cursor-pointer"
                  >
                    <option value="active">{t.kanbanStatusActive || 'Активна'}</option>
                    <option value="completed">{t.kanbanStatusCompleted || 'Завершена'}</option>
                    <option value="paused">{t.kanbanStatusPaused || 'На паузе'}</option>
                  </select>
                </div>
              </div>

              {/* Financials Box */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    {t.kanbanFinancialsTitle || 'Финансы и слоты'}
                  </h4>
                  <div className="text-xs font-bold text-slate-500">
                    {t.kanbanTotalPayable || 'Итого к оплате:'}{' '}
                    <span className="font-black text-slate-900">
                      {(Number(editPricePerSlot || 0) * Number(editSlotsCount || 0)).toLocaleString()} UZS
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {t.kanbanSlotsCountLabel || 'Количество слотов'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editSlotsCount}
                      onChange={(e) => setEditSlotsCount(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {t.kanbanPricePerSlotLabel || 'Цена за слот (UZS)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editPricePerSlot}
                      onChange={(e) => setEditPricePerSlot(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {t.kanbanPaidAmountLabel || 'Оплаченная сумма (UZS)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editPaidAmount}
                      onChange={(e) => setEditPaidAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>
              </div>

              {/* Referral Link */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {t.kanbanReferralLinkLabel || 'Реферальная ссылка'}
                </label>
                <input
                  type="text"
                  value={editReferralLink}
                  onChange={(e) => setEditReferralLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                />
              </div>

              {/* Bank Card & Cardholder Name Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      {t.kanbanBankCardNumberLabel || 'Номер банковской карты'}
                    </label>
                    {editCardNumber.trim() && (
                      <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={editCardNumber}
                      onChange={(e) => handleCardNumberChange(e.target.value)}
                      placeholder={t.kanbanCardNumberPlaceholder || '8600 •••• •••• ••••'}
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                    />
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    {editCardNumber.trim() && (
                      <button
                        type="button"
                        onClick={async () => {
                          await copyToClipboard(editCardNumber.replace(/\s+/g, ''));
                          setIsCardCopied(true);
                          setTimeout(() => setIsCardCopied(false), 2000);
                        }}
                        className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-black transition cursor-pointer"
                        title={isCardCopied ? (t.kanbanCopiedSuccess || 'Скопировано!') : (lang === 'uz' ? 'Kartani nusxalash' : lang === 'en' ? 'Copy card' : 'Скопировать номер карты')}
                      >
                        {isCardCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {t.kanbanCardholderNameLabel || 'Имя владельца карты'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editCardName}
                      onChange={(e) => setEditCardName(e.target.value)}
                      placeholder={t.kanbanCardholderNamePlaceholder || 'Имя Фамилия'}
                      className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Move to Payment Stage Button (Shown when both card number & name are filled) */}
              {areCardFieldsFilled && paymentColumn && (
                <div className="p-3 bg-gradient-to-r from-indigo-50/90 via-sky-50/80 to-emerald-50/90 rounded-2xl border border-indigo-200/90 shadow-2xs space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900 truncate">
                            {t.kanbanRequisitesCompleteTitle || 'Реквизиты карты заполнены'}
                          </span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          {editKanbanStage === paymentColumn.id
                            ? (lang === 'uz' ? `Kartochka «${paymentColumn.title}» ustuniga belgilangan` : lang === 'en' ? `Card is assigned to "${paymentColumn.title}" column` : `Карточка определена в столбец «${paymentColumn.title}»`)
                            : (lang === 'uz' ? `Kartochkani «${paymentColumn.title}» ustuniga o‘tkazish mumkin` : lang === 'en' ? `Ready to move to "${paymentColumn.title}" column` : `Можно перенести сделку в столбец «${paymentColumn.title}»`)}
                        </p>
                      </div>
                    </div>

                    {editKanbanStage !== paymentColumn.id ? (
                      <button
                        type="button"
                        disabled={isQuickMoving}
                        onClick={handleMoveToPaymentColumn}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow transition flex items-center gap-1.5 shrink-0 cursor-pointer group disabled:opacity-60"
                        title={lang === 'uz' ? `«${paymentColumn.title}» ustuniga o‘tkazish` : lang === 'en' ? `Move to "${paymentColumn.title}"` : `Перенести в «${paymentColumn.title}»`}
                      >
                        {isQuickMoving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{t.kanbanMovingToPaymentBtn || 'Переносим...'}</span>
                          </>
                        ) : (
                          <>
                            <span>{lang === 'uz' ? `«${paymentColumn.title}» ga o‘tkazish` : lang === 'en' ? `Move to "${paymentColumn.title}"` : `В «${paymentColumn.title}»`}</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-xl border border-emerald-200 shrink-0">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        <span>{lang === 'uz' ? `«${paymentColumn.title}» da` : lang === 'en' ? `In "${paymentColumn.title}"` : `В «${paymentColumn.title}»`}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comments Section / Лента комментариев */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-700" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      {t.kanbanCommentsTitle || 'Комментарии и заметки'} ({editCommentsList.length})
                    </h4>
                  </div>
                  {currentUserEmail && (
                    <span className="text-[11px] font-medium text-slate-500 truncate">
                      {lang === 'uz' ? 'Muallif:' : lang === 'en' ? 'Author:' : 'Автор:'} <span className="font-bold text-slate-800">{currentUserEmail}</span>
                    </span>
                  )}
                </div>

                {/* Comments List */}
                {editCommentsList.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {editCommentsList.map((item) => (
                      <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 uppercase">
                              {item.author.charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {item.author}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium text-slate-400 shrink-0">
                              {new Date(item.createdAt).toLocaleString(lang === 'uz' ? 'uz-UZ' : lang === 'en' ? 'en-US' : 'ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(item.id)}
                              className="text-slate-300 hover:text-rose-600 transition p-0.5 cursor-pointer"
                              title={lang === 'uz' ? "Izohni o'chirish" : lang === 'en' ? 'Delete comment' : 'Удалить комментарий'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap pl-7 leading-relaxed font-medium">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-white p-3 rounded-xl border border-slate-200">
                    {t.kanbanNoComments || 'Комментариев пока нет. Напишите комментарий ниже.'}
                  </p>
                )}

                {/* Add Comment Input */}
                <div className="pt-2 border-t border-slate-200/80 flex items-end gap-2">
                  <div className="flex-1">
                    <textarea
                      rows={2}
                      value={newCommentInput}
                      onChange={(e) => setNewCommentInput(e.target.value)}
                      placeholder={`${t.kanbanCommentPlaceholder || 'Написать комментарий...'} (${currentUserEmail || (lang === 'uz' ? 'Foydalanuvchi' : lang === 'en' ? 'User' : 'Пользователь')})`}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black transition resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={!newCommentInput.trim()}
                    className="px-4 py-2.5 bg-black hover:bg-neutral-800 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer mb-0.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{t.kanbanSendBtn || 'Отправить'}</span>
                  </button>
                </div>
              </div>

              {/* Audience & Subscribers Section */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-800" />
                    {t.kanbanAudienceTitle || 'Аудитория блогера (Подписчики)'}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {t.kanbanSubscribersCountLabel || 'Количество подписчиков'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder={t.kanbanSubscribersPlaceholder || 'Например: 125000'}
                      value={editSubscribersCount}
                      onChange={(e) => setEditSubscribersCount(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {editSubscribersCount && Number(editSubscribersCount) > 0 && Number(editPricePerSlot || 0) > 0 ? (
                        <span>
                          {t.kanbanApproxCostPer1k || 'Ориентировочно:'} <strong className="text-slate-900 font-bold">~{Math.round((Number(editPricePerSlot) / Number(editSubscribersCount)) * 1000).toLocaleString()} UZS</strong> {t.kanbanPer1kReach || 'за 1K охвата'}
                        </span>
                      ) : (
                        t.kanbanEnterSubscribersHint || 'Укажите подписчиков для расчета ориентировочной стоимости за 1,000 охвата'
                      )}
                    </p>
                  </div>
                </div>

                {/* If existing deal, show the interactive flip card directly inside modal */}
                {!isCreateMode && selectedDeal && (
                  <div className="mt-2 space-y-2">
                    {isChannelChangedInModal && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <span className="font-bold block">
                            {t.audChannelChangedNotice || 'Канал блогера изменен. Старые записи замеров очищены для нового канала.'}
                          </span>
                          <span className="text-[11px] text-amber-700">
                            {t.audRunFirstCheck || 'Запустите замер через кнопку обновления для получения актуальных данных нового канала.'}
                          </span>
                        </div>
                      </div>
                    )}
                    <BloggerAudienceCard
                      integration={effectiveDealForAudience}
                      lang={lang}
                      onRefreshSubscribers={handleRefreshSubscribersInModal}
                      onAddManualSnapshot={onAddManualSnapshot}
                      onResetHistory={handleResetHistoryInModal}
                      isCollapsible={false}
                    />
                  </div>
                )}
              </div>

              {/* Requisites Information Section (Edit mode only) */}
              {!isCreateMode && selectedDeal && (() => {
                const activeRequisites = selectedDeal.requisites || bloggerRequisitesList?.find(r => 
                  (r.integrationId && String(r.integrationId) === String(selectedDeal.id)) ||
                  (selectedDeal.bloggerName && r.bloggerName && r.bloggerName.replace(/^[@#]/, '').trim().toLowerCase() === selectedDeal.bloggerName.replace(/^[@#]/, '').trim().toLowerCase())
                );
                return (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          {t.kanbanRequisitesSectionTitle || 'Реквизиты блогера'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {activeRequisites?.taxStatus === 'card_transfer' ? (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            {t.kanbanCardTaxStatus || '💳 На карту'}
                          </span>
                        ) : activeRequisites?.taxStatus === 'contract' ? (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            {t.kanbanContractTaxStatus || '📄 Договор'}
                          </span>
                        ) : null}
                        {activeRequisites ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {t.kanbanRequisitesFilled || 'Заполнены'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-amber-700 font-medium bg-amber-100/80 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 text-amber-600" /> {t.kanbanRequisitesPending || 'Ожидаются'}
                          </span>
                        )}
                      </div>
                    </div>

                    {activeRequisites ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-semibold block">{t.kanbanFullNameLabel || 'ФИО:'}</span>
                          <span className="font-bold text-slate-900">{activeRequisites.fullName || '—'}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-semibold block">{t.kanbanCardIbanLabel || 'Номер карты / IBAN:'}</span>
                          <span className="font-mono font-bold text-slate-900">{activeRequisites.cardNumberOrIban || '—'}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-semibold block">{t.kanbanPinflTinLabel || 'ПИНФЛ / ИНН:'}</span>
                          <span className="font-mono font-bold text-slate-900">{activeRequisites.pinflOrTin || '—'}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-semibold block">{t.kanbanBankPhoneLabel || 'Банк / Телефон:'}</span>
                          <span className="font-semibold text-slate-900">
                            {activeRequisites.bankName || activeRequisites.phone || '—'}
                          </span>
                        </div>

                        {/* Passport Scans Previews */}
                        {(activeRequisites.passportFrontScan || activeRequisites.passportBackScan) && (
                          <div className="sm:col-span-2 bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider flex items-center gap-1">
                              <FileCheck className="w-3 h-3 text-emerald-600" /> {t.kanbanPassportCopiesLabel || 'Копии паспорта / ID-карты (2 стороны):'}
                            </span>
                            <div className="grid grid-cols-2 gap-2 pt-0.5">
                              {activeRequisites.passportFrontScan && (
                                <div 
                                  onClick={() => setActivePassportScanZoom({ src: activeRequisites.passportFrontScan!, title: t.kanbanPassportFront || 'Лицевая сторона' })}
                                  className="group relative rounded-lg border border-slate-200 overflow-hidden cursor-pointer bg-slate-50 hover:border-black transition"
                                >
                                  <img src={activeRequisites.passportFrontScan} alt="Лицевая сторона" className="w-full h-20 object-cover group-hover:scale-105 transition duration-150" />
                                  <div className="p-1 text-center bg-white/95 text-[10px] font-bold text-slate-700 border-t border-slate-100 flex items-center justify-between px-2">
                                    <span>{t.kanbanPassportFront || 'Лицевая сторона'}</span>
                                    <ZoomIn className="w-3 h-3 text-slate-400" />
                                  </div>
                                </div>
                              )}
                              {activeRequisites.passportBackScan && (
                                <div 
                                  onClick={() => setActivePassportScanZoom({ src: activeRequisites.passportBackScan!, title: t.kanbanPassportBack || 'Обратная сторона' })}
                                  className="group relative rounded-lg border border-slate-200 overflow-hidden cursor-pointer bg-slate-50 hover:border-black transition"
                                >
                                  <img src={activeRequisites.passportBackScan} alt="Обратная сторона" className="w-full h-20 object-cover group-hover:scale-105 transition duration-150" />
                                  <div className="p-1 text-center bg-white/95 text-[10px] font-bold text-slate-700 border-t border-slate-100 flex items-center justify-between px-2">
                                    <span>{t.kanbanPassportBack || 'Обратная сторона'}</span>
                                    <ZoomIn className="w-3 h-3 text-slate-400" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 pt-1">
                        {t.kanbanNoRequisitesFilledYet || 'Блогер еще не заполнил реквизиты. Вы можете скопировать и отправить ему ссылку на форму реквизитов.'}
                      </p>
                    )}
                  </div>
                );
              })()}
            </form>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 shrink-0">
              <div>
                {!isCreateMode && selectedDeal && onDeleteIntegration && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t.kanbanDeleteDealConfirm || 'Вы уверены, что хотите удалить эту сделку?')) {
                        onDeleteIntegration(selectedDeal.id);
                        handleCloseDealModal();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t.deleteTooltip || 'Удалить'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseDealModal}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  {modalActiveTab === 'chat'
                    ? (lang === 'uz' ? 'Yopish' : lang === 'en' ? 'Close' : 'Закрыть')
                    : (t.kanbanCancelBtn || 'Отмена')}
                </button>
                {modalActiveTab === 'details' && (
                  <button
                    type="submit"
                    form="deal-edit-form"
                    disabled={isSavingEdit}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-black hover:bg-neutral-800 disabled:opacity-50 rounded-xl shadow-xs transition cursor-pointer"
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>{isCreateMode ? (t.kanbanCreatedBtn || 'Создано!') : (t.kanbanSavedBtn || 'Сохранено!')}</span>
                      </>
                    ) : isSavingEdit ? (
                      <span>{isCreateMode ? (t.kanbanCreatingBtn || 'Создание...') : (t.kanbanSavingBtn || 'Сохранение...')}</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{isCreateMode ? (t.kanbanCreateDealBtn || 'Создать сделку') : (t.kanbanSaveDealBtn || 'Сохранить изменения')}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {activePassportScanZoom && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4"
          onClick={() => setActivePassportScanZoom(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between text-white pb-3">
              <span className="font-bold text-sm">{activePassportScanZoom.title}</span>
              <button
                type="button"
                onClick={() => setActivePassportScanZoom(null)}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={activePassportScanZoom.src}
              alt={activePassportScanZoom.title}
              className="max-h-[80vh] w-auto max-w-full rounded-2xl border border-white/20 shadow-2xl object-contain bg-slate-900"
            />
          </div>
        </div>
      )}
      {/* Backlog Move Notification Toast */}
      {backlogNotification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-neutral-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-8 h-8 rounded-xl bg-neutral-800 flex items-center justify-center text-white shrink-0">
            <EyeOff className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <p className="font-bold">{t.kanbanToastBacklogTitle || 'Карточка перенесена в Backlog'}</p>
            <p className="text-neutral-400 text-[11px]">«{backlogNotification.bloggerName}» {t.kanbanToastBacklogSaved || 'сохранена в скрытом архиве'}</p>
          </div>
          {isBacklogHidden && (
            <button
              onClick={() => {
                handleToggleColumnVisibility('backlog');
                setBacklogNotification(null);
              }}
              className="ml-2 px-2.5 py-1 bg-white text-black font-bold text-[11px] rounded-lg hover:bg-neutral-200 transition cursor-pointer"
            >
              {t.kanbanToastShowBacklog || 'Показать Backlog'}
            </button>
          )}
          <button
            onClick={() => setBacklogNotification(null)}
            className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Slide-over Drawer for Quick Telegram Chat directly from Kanban board */}
      {activeChatDeal && (
        <div 
          className="fixed inset-0 z-60 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setActiveChatDeal(null)}
        >
          <div 
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-3 sm:p-4 animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <BloggerTelegramChat
              integration={activeChatDeal}
              lang={lang}
              userRole={userRole}
              currentUserEmail={currentUserEmail}
              currentUserName={currentUserName || currentUserEmail}
              onClose={() => setActiveChatDeal(null)}
              onIntegrationUpdated={(updated) => {
                setActiveChatDeal(updated);
                if (onEditIntegration) onEditIntegration(updated.id, updated);
              }}
            />
          </div>
        </div>
      )}

      {/* Telegram Gateway Modal for Personal Account QR Code Login - Super Admin Only */}
      {isSuperAdmin && isGatewayModalOpen && (
        <TelegramGatewayModal
          isOpen={isGatewayModalOpen}
          onClose={() => {
            setIsGatewayModalOpen(false);
            fetchTelegramGatewayStatus().then(setGatewayStatus).catch(() => {});
          }}
          lang={lang}
        />
      )}
    </div>
  );
}
