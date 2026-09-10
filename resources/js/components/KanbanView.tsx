/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Integration, Project, KanbanColumn, INITIAL_KANBAN_COLUMNS, DealComment } from '../data/mockData';
import { Language, translations } from '../translations';
import { getCabinetUrl } from '../utils/url';
import { getPlatformBadgeClasses, formatTelegramLink, formatTelegramHandle } from '../utils/platform';
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
  ChevronDown
} from 'lucide-react';
import BloggerAudienceCard from './BloggerAudienceCard';

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
  onOpenRequisitesDirectory?: () => void;
  onClearStage?: (stageId: string) => void | Promise<void>;
  onRefreshSubscribers?: (integrationId: string) => Promise<void>;
  onAddManualSnapshot?: (integrationId: string, date: string, count: number, note?: string) => Promise<void>;
  onNavigateToReports?: (deal: Integration) => void;
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
  onOpenRequisitesDirectory,
  onClearStage,
  onRefreshSubscribers,
  onAddManualSnapshot,
  onNavigateToReports
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
  const [editBloggerName, setEditBloggerName] = useState('');
  const [editBloggerLink, setEditBloggerLink] = useState('');
  const [editTelegramUsername, setEditTelegramUsername] = useState('');
  const [editPlatform, setEditPlatform] = useState<'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok'>('Instagram');
  const [editProjectId, setEditProjectId] = useState('');
  const [editKanbanStage, setEditKanbanStage] = useState('');
  const [editPricePerSlot, setEditPricePerSlot] = useState<number | ''>(0);
  const [editSlotsCount, setEditSlotsCount] = useState<number | ''>(1);
  const [editPaidAmount, setEditPaidAmount] = useState<number | ''>(0);
  const [editPaidSlotsCount, setEditPaidSlotsCount] = useState<number>(0);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editReferralLink, setEditReferralLink] = useState('');
  const [editSubscribersCount, setEditSubscribersCount] = useState<number | ''>('');
  const [editCommentsList, setEditCommentsList] = useState<DealComment[]>([]);
  const [newCommentInput, setNewCommentInput] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'completed' | 'paused'>('active');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isDraggingRef = React.useRef(false);

  // Modals state
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [columnTitleInput, setColumnTitleInput] = useState('');
  const [activePassportScanZoom, setActivePassportScanZoom] = useState<{ src: string; title: string } | null>(null);

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
    setEditBloggerName('');
    setEditBloggerLink('');
    setEditTelegramUsername('');
    setEditPlatform('Instagram');
    setEditProjectId(selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id || ''));
    setEditKanbanStage(stageId || columns[0]?.id || 'wishlist');
    setEditPricePerSlot(0);
    setEditSlotsCount(1);
    setEditPaidAmount(0);
    setEditPaidSlotsCount(0);
    setEditStartDate(new Date().toISOString().split('T')[0]);
    setEditEndDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setEditReferralLink('');
    setEditSubscribersCount('');
    setEditCommentsList([]);
    setNewCommentInput('');
    setEditStatus('active');
    setSaveSuccess(false);
  };

  // Open Deal Detail / Edit Modal
  const handleOpenDealModal = (deal: Integration) => {
    setIsCreateMode(false);
    setSelectedDeal(deal);
    setEditBloggerName(deal.bloggerName || '');
    setEditBloggerLink(deal.bloggerPageLink || '');
    setEditTelegramUsername(deal.telegramUsername || '');
    setEditPlatform(deal.platform || 'Instagram');
    setEditProjectId(deal.projectId || (projects[0] ? projects[0].id : ''));
    setEditKanbanStage(deal.kanbanStage || columns[0]?.id || 'wishlist');
    setEditPricePerSlot(deal.pricePerSlot ?? 0);
    setEditSlotsCount(deal.slotsCount || 1);
    setEditPaidAmount(deal.paidAmount || 0);
    setEditPaidSlotsCount(deal.paidSlotsCount ?? (deal.paidAmount && deal.pricePerSlot ? Math.min(deal.slotsCount, Math.floor(deal.paidAmount / deal.pricePerSlot)) : 0));
    setEditStartDate(deal.startDate || new Date().toISOString().split('T')[0]);
    setEditEndDate(deal.endDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setEditReferralLink(deal.referralLink || '');
    setEditSubscribersCount(deal.subscribersCount ?? '');
    setEditCommentsList(parseComments(deal.comments));
    setNewCommentInput('');
    setEditStatus(deal.status || 'active');
    setSaveSuccess(false);
  };

  // Close Deal Modal
  const handleCloseDealModal = () => {
    setSelectedDeal(null);
    setIsCreateMode(false);
    setSaveSuccess(false);
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
          kanbanStage: editKanbanStage,
          createdBy: currentUserEmail || undefined,
          subscribersCount: editSubscribersCount !== '' ? Number(editSubscribersCount) : undefined,
        });
      } else if (selectedDeal) {
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
          kanbanStage: editKanbanStage,
          subscribersCount: editSubscribersCount !== '' ? Number(editSubscribersCount) : undefined,
        };

        if (onEditIntegration) {
          await onEditIntegration(selectedDeal.id, updatedFields);
        }
        if (editKanbanStage !== selectedDeal.kanbanStage) {
          onUpdateIntegrationStage(selectedDeal.id, editKanbanStage);
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
  const handleCopyRequisitesLink = (integration: Integration) => {
    const url = `${window.location.origin}${window.location.pathname}?view=requisites&token=${integration.id}`;
    navigator.clipboard.writeText(url);
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
    <div className="flex flex-col h-full bg-slate-50 min-h-screen p-4 md:p-8 space-y-6 font-sans">
      {/* Project Quick Filter Tabs */}
      {projects && projects.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap">
          <button
            type="button"
            onClick={() => handleSelectProject('all')}
            className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer shrink-0 ${
              selectedProjectId === 'all'
                ? 'bg-black text-white font-bold shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-black font-semibold border border-neutral-200 shadow-2xs'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 ${selectedProjectId === 'all' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
            <span>{t.kanbanAllProjects || 'Все проекты'}</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                selectedProjectId === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
              }`}
            >
              {totalKanbanCards}
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
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-black text-white font-bold shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-black font-semibold border border-neutral-200 shadow-2xs'
                }`}
              >
                <span>{project.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search, Filter & Actions Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-neutral-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1">
          {/* Search Bar: Compact icon by default, expands on click */}
          {isSearchExpanded || searchQuery ? (
            <div
              className="relative flex items-center w-full sm:w-72 md:w-80 transition-all duration-200 animate-in fade-in"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node) && !searchQuery) {
                  setIsSearchExpanded(false);
                }
              }}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setIsSearchExpanded(false);
                  }
                }}
                placeholder={t.kanbanSearchPlaceholder || 'Поиск по имени блогера или ссылке...'}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchExpanded(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition cursor-pointer"
                title={t.kanbanCloseSearchTitle || 'Закрыть поиск'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsSearchExpanded(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="flex items-center justify-center w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 hover:border-slate-300 transition cursor-pointer shrink-0 shadow-2xs"
              title={t.kanbanSearchTitle || 'Поиск блогеров'}
            >
              <Search className="w-4 h-4 text-slate-600" />
            </button>
          )}

          {/* Project selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-500">{t.kanbanProjectLabel || 'Проект:'}</span>
            <select
              value={selectedProjectId}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">{t.kanbanAllProjectsOption || 'Все проекты'}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Platform selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-500">{t.kanbanPlatformLabel || 'Платформа:'}</span>
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

        {/* Action Buttons moved from top container */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenRequisitesDirectory && (
            <button
              onClick={onOpenRequisitesDirectory}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-slate-600" />
              <span>{t.kanbanRequisitesDirectoryBtn || 'База реквизитов'}</span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingColumnId(null);
              setColumnTitleInput('');
              setIsColumnModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-slate-600" />
            <span>{t.kanbanConfigureColumnsBtn || 'Настройка столбцов'}</span>
          </button>

          <button
            onClick={() => handleOpenCreateDealModal()}
            className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.kanbanAddBloggerBtn || 'Добавить блогера'}</span>
          </button>
        </div>
      </div>

      {/* Kanban Dynamic Columns Horizontal Scroll Container */}
      <div className="flex gap-5 items-start overflow-x-auto pb-8 pt-2 snap-x min-h-[400px]">
        {visibleColumns.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 text-center px-6 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-slate-600">
              <Plus className="w-7 h-7" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1.5">
              {t.kanbanEmptyColumnsTitle || 'Все этапы скрыты или отсутствуют'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              {t.kanbanEmptyColumnsDesc || 'Откройте «Настройка столбцов», чтобы включить отображение столбцов или создать новые.'}
            </p>
            <button
              onClick={() => {
                setEditingColumnId(null);
                setColumnTitleInput('');
                setIsColumnModalOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-3 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
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
              className={`relative flex flex-col bg-white rounded-2xl border overflow-hidden transition-all duration-150 w-[340px] min-w-[340px] shrink-0 ${
                isBacklogOverFirstCol
                  ? 'border-neutral-900 ring-2 ring-neutral-900/40 bg-neutral-100/60 shadow-md'
                  : isOver 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-md' 
                    : 'border-neutral-200 shadow-xs'
              }`}
            >
              {/* Backlog Drop Hint on first column when hovering left edge */}
              {isBacklogOverFirstCol && (
                <div className="absolute top-2 left-2 z-30 pointer-events-none bg-black text-white text-[11px] font-black px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in">
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{t.kanbanBacklogDropHint || 'В архив Backlog (не договорились)'}</span>
                </div>
              )}
              {/* Column Header */}
              <div className="p-3.5 border-b border-neutral-200 bg-slate-50/80 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider truncate">
                    {getLocalizedColumnTitle(column, lang)}
                  </span>
                  {column.id === 'backlog' && (
                    <span className="px-1.5 py-0.5 text-[9px] bg-slate-200 text-slate-700 rounded font-bold shrink-0">
                      {t.kanbanBacklogBadge || 'Отказы'}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-black text-white shrink-0">
                    {columnDeals.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {column.id === 'backlog' && (
                    <button
                      type="button"
                      onClick={() => handleToggleColumnVisibility('backlog')}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-black transition cursor-pointer"
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
                      className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenCreateDealModal(column.id)}
                    title={`${t.kanbanAddCardTooltip || 'Добавить карточку'} -> ${getLocalizedColumnTitle(column, lang)}`}
                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-black transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Column Total Budget */}
              <div className="px-3.5 py-1.5 bg-white border-b border-slate-100 text-[11px] font-semibold text-slate-500 flex justify-between shrink-0">
                <span>{t.kanbanTotalLabel || 'Итого:'}</span>
                <span className="font-extrabold text-slate-900">{totalColumnBudget.toLocaleString()} UZS</span>
              </div>

              {/* Cards List Drop Target with Internal Scrollable Area */}
              <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] min-h-[300px] overflow-y-auto flex-1">
                {columnDeals.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl p-4 text-center transition ${
                    isOver ? 'border-indigo-400 bg-indigo-50/40 text-indigo-600' : 'border-slate-200 text-slate-400'
                  }`}>
                    <Clock className="w-5 h-5 mb-1 opacity-50" />
                    <span className="text-xs font-semibold">{t.kanbanDragHere || 'Перетащите сюда'}</span>
                  </div>
                ) : (
                  columnDeals.map((deal) => {
                    const project = projects.find(p => p.id === deal.projectId);
                    const hasRequisites = !!deal.requisites;
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
                        className={`group relative bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs hover:shadow-md hover:border-black transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          isDragging ? 'opacity-30 border-dashed border-neutral-400' : ''
                        } ${draggedDealId && !isDragging ? 'pointer-events-none' : ''}`}
                      >
                        {/* Top Bar */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab" />
                            <span className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shrink-0 ${getPlatformBadgeClasses(deal.platform)}`}>
                              {deal.platform}
                            </span>
                            {project && (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-md truncate max-w-[130px]">
                                {project.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDealModal(deal);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-black transition cursor-pointer"
                              title={t.kanbanEditDealTooltip || 'Редактировать сделку'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {onDeleteIntegration && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteIntegration(deal.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title={t.deleteTooltip || 'Удалить'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Blogger Name */}
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition">
                            {deal.bloggerName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {deal.bloggerPageLink && (
                              <a
                                href={deal.bloggerPageLink}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-slate-500 hover:text-black hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                <span>{t.kanbanChannelLink || 'Канал'}</span>
                              </a>
                            )}
                            {deal.telegramUsername && (
                              <a
                                href={formatTelegramLink(deal.telegramUsername)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-sky-700 bg-sky-50 hover:bg-sky-500 hover:text-white px-2 py-0.5 rounded-md border border-sky-200 transition shadow-2xs group/tg"
                                title={t.kanbanTgChatTooltip || 'Перейти в личный Telegram (открыть чат)'}
                              >
                                <Send className="w-2.5 h-2.5 text-sky-500 group-hover/tg:text-white transition-colors" />
                                <span>{formatTelegramHandle(deal.telegramUsername)}</span>
                              </a>
                            )}
                          </div>

                          {(() => {
                            const commentsArr = parseComments(deal.comments);
                            if (commentsArr.length === 0) return null;
                            const lastComment = commentsArr[commentsArr.length - 1];
                            return (
                              <div className="mt-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-[11px] text-slate-700 space-y-1">
                                <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-semibold">
                                  <span className="flex items-center gap-1 font-bold text-slate-800 truncate max-w-[170px]">
                                    <MessageSquare className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span className="truncate">{lastComment.author}</span>
                                  </span>
                                  {commentsArr.length > 1 && (
                                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-bold rounded-md text-[9px] shrink-0">
                                      +{commentsArr.length - 1}
                                    </span>
                                  )}
                                </div>
                                <p className="line-clamp-2 italic font-medium leading-snug pl-4 text-slate-700">
                                  «{lastComment.text}»
                                </p>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Creator Info */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {t.kanbanCreatedByLabel || 'Создал:'} <strong className="text-slate-800 font-bold">{deal.createdBy || (t.kanbanNotSpecified || 'Не указан')}</strong>
                          </span>
                        </div>

                        {/* Amount & Requisites */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span>{t.kanbanAmountLabel || 'Сумма:'}</span>
                            <span className="font-black text-black">
                              {(deal.totalAmount || (deal.pricePerSlot * deal.slotsCount)).toLocaleString()} UZS
                            </span>
                          </div>

                          {/* Requisites Status */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-semibold">{t.kanbanRequisitesLabel || 'Реквизиты:'}</span>
                            {hasRequisites ? (
                              <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {t.kanbanRequisitesFilled || 'Заполнены'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                <Clock className="w-3 h-3 text-amber-600" /> {t.kanbanRequisitesPending || 'Ожидаются'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stage Dropdown Selector & Magic Link Action */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <select
                            value={deal.kanbanStage || column.id}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              onUpdateIntegrationStage(deal.id, e.target.value);
                            }}
                            className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                          >
                            {columns.map(c => (
                              <option key={c.id} value={c.id}>
                                {getLocalizedColumnTitle(c, lang)} {c.id === 'backlog' ? `📁 (${t.kanbanBacklogBadge || 'Отказы'})` : c.hidden ? `(${t.kanbanHiddenBadge || 'скрытая'})` : ''}
                              </option>
                            ))}
                          </select>

                          {/* Action Button for 'ready_for_payment' Stage: Создать отчёт */}
                          {(column.id === 'ready_for_payment' || deal.kanbanStage === 'ready_for_payment') && onNavigateToReports && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToReports(deal);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-black hover:bg-neutral-800 active:bg-neutral-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                            >
                              <FilePlus className="w-3.5 h-3.5" />
                              <span>{t.createReport || 'Создать отчет'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyRequisitesLink(deal);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-black hover:text-white text-slate-800 font-bold text-[11px] rounded-lg transition cursor-pointer"
                          >
                            {copiedId === deal.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{t.kanbanCopiedSuccess || 'Скопировано!'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>{t.kanbanRequisitesLinkBtn || 'Ссылка на реквизиты'}</span>
                              </>
                            )}
                          </button>
                        </div>
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
                        {col.id === 'ready_for_payment' && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold shrink-0">
                            Кнопка отчёта
                          </span>
                        )}
                        {col.id === 'paid_in_progress' && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold shrink-0">
                            Оплата
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
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
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    {isCreateMode ? (t.kanbanModalCreateSub || 'Заполните параметры и создайте новую сделку') : (t.kanbanModalEditSub || 'Информация и редактирование сделки')}
                  </p>
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
                {(selectedDeal.kanbanStage === 'ready_for_payment' || editKanbanStage === 'ready_for_payment') && onNavigateToReports && (
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
                    onClick={() => {
                      const url = getCabinetUrl(selectedDeal.bloggerCabinetToken);
                      navigator.clipboard.writeText(url);
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

                {editBloggerLink && (
                  <a
                    href={editBloggerLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t.kanbanOpenChannelBtn || 'Открыть канал'}</span>
                  </a>
                )}

                {editTelegramUsername && (
                  <a
                    href={formatTelegramLink(editTelegramUsername)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl border border-sky-200 transition shadow-2xs"
                    title={t.kanbanTgChatTooltip || 'Открыть диалог в Telegram'}
                  >
                    <Send className="w-3.5 h-3.5 text-sky-600" />
                    <span>{lang === 'uz' ? 'Chat' : lang === 'en' ? 'Chat' : 'Чат'}: {formatTelegramHandle(editTelegramUsername)}</span>
                    <ExternalLink className="w-3 h-3 text-sky-500" />
                  </a>
                )}
              </div>
            )}

            {/* Scrollable Form Body */}
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
                  <input
                    type="text"
                    value={editBloggerLink}
                    onChange={(e) => setEditBloggerLink(e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      {t.kanbanBloggerTgLabel || 'Личный Telegram блогера (для связи)'}
                    </label>
                    {editTelegramUsername && (
                      <a
                        href={formatTelegramLink(editTelegramUsername)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800 hover:underline transition"
                        title={t.kanbanTgChatTooltip || 'Нажмите, чтобы открыть чат с блогером в Telegram'}
                      >
                        <Send className="w-3 h-3" />
                        <span>{lang === 'uz' ? 'Chatni ochish' : lang === 'en' ? 'Open chat' : 'Открыть чат'} {formatTelegramHandle(editTelegramUsername)}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={editTelegramUsername}
                      onChange={(e) => setEditTelegramUsername(e.target.value)}
                      placeholder={t.kanbanBloggerTgPlaceholder || 'например, @username, username или https://t.me/username'}
                      className="w-full pl-9 pr-24 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Send className="w-3.5 h-3.5 text-sky-500" />
                    </div>
                    {editTelegramUsername && (
                      <a
                        href={formatTelegramLink(editTelegramUsername)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-[10px] font-black inline-flex items-center gap-1 shadow-xs transition cursor-pointer"
                        title={t.kanbanTgChatTooltip || 'Открыть чат в Telegram'}
                      >
                        <span>{lang === 'uz' ? 'Chat' : lang === 'en' ? 'Chat' : 'Чат'}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t.kanbanBloggerTgHint || 'Поддерживает любой формат (@юзернейм, ссылку t.me или ник без @) — клик сразу перенаправит в личный чат в Telegram'}
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
                  <div className="mt-2">
                    <BloggerAudienceCard
                      integration={selectedDeal}
                      lang={lang}
                      onRefreshSubscribers={onRefreshSubscribers}
                      onAddManualSnapshot={onAddManualSnapshot}
                      isCollapsible={false}
                    />
                  </div>
                )}
              </div>

              {/* Requisites Information Section (Edit mode only) */}
              {!isCreateMode && selectedDeal && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        {t.kanbanRequisitesSectionTitle || 'Реквизиты блогера'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedDeal.requisites?.taxStatus === 'card_transfer' ? (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          {t.kanbanCardTaxStatus || '💳 На карту'}
                        </span>
                      ) : selectedDeal.requisites?.taxStatus === 'contract' ? (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          {t.kanbanContractTaxStatus || '📄 Договор'}
                        </span>
                      ) : null}
                      {selectedDeal.requisites ? (
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

                  {selectedDeal.requisites ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">{t.kanbanFullNameLabel || 'ФИО:'}</span>
                        <span className="font-bold text-slate-900">{selectedDeal.requisites.fullName || '—'}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">{t.kanbanCardIbanLabel || 'Номер карты / IBAN:'}</span>
                        <span className="font-mono font-bold text-slate-900">{selectedDeal.requisites.cardNumberOrIban || '—'}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">{t.kanbanPinflTinLabel || 'ПИНФЛ / ИНН:'}</span>
                        <span className="font-mono font-bold text-slate-900">{selectedDeal.requisites.pinflOrTin || '—'}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">{t.kanbanBankPhoneLabel || 'Банк / Телефон:'}</span>
                        <span className="font-semibold text-slate-900">
                          {selectedDeal.requisites.bankName || selectedDeal.requisites.phone || '—'}
                        </span>
                      </div>

                      {/* Passport Scans Previews */}
                      {(selectedDeal.requisites.passportFrontScan || selectedDeal.requisites.passportBackScan) && (
                        <div className="sm:col-span-2 bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider flex items-center gap-1">
                            <FileCheck className="w-3 h-3 text-emerald-600" /> {t.kanbanPassportCopiesLabel || 'Копии паспорта / ID-карты (2 стороны):'}
                          </span>
                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            {selectedDeal.requisites.passportFrontScan && (
                              <div 
                                onClick={() => setActivePassportScanZoom({ src: selectedDeal.requisites!.passportFrontScan!, title: t.kanbanPassportFront || 'Лицевая сторона' })}
                                className="group relative rounded-lg border border-slate-200 overflow-hidden cursor-pointer bg-slate-50 hover:border-black transition"
                              >
                                <img src={selectedDeal.requisites.passportFrontScan} alt="Лицевая сторона" className="w-full h-20 object-cover group-hover:scale-105 transition duration-150" />
                                <div className="p-1 text-center bg-white/95 text-[10px] font-bold text-slate-700 border-t border-slate-100 flex items-center justify-between px-2">
                                  <span>{t.kanbanPassportFront || 'Лицевая сторона'}</span>
                                  <ZoomIn className="w-3 h-3 text-slate-400" />
                                </div>
                              </div>
                            )}
                            {selectedDeal.requisites.passportBackScan && (
                              <div 
                                onClick={() => setActivePassportScanZoom({ src: selectedDeal.requisites!.passportBackScan!, title: t.kanbanPassportBack || 'Обратная сторона' })}
                                className="group relative rounded-lg border border-slate-200 overflow-hidden cursor-pointer bg-slate-50 hover:border-black transition"
                              >
                                <img src={selectedDeal.requisites.passportBackScan} alt="Обратная сторона" className="w-full h-20 object-cover group-hover:scale-105 transition duration-150" />
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
              )}
            </form>

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
                  {t.kanbanCancelBtn || 'Отмена'}
                </button>
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
    </div>
  );
}
