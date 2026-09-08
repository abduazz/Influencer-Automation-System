/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Integration, Project, KanbanColumn, INITIAL_KANBAN_COLUMNS, DealComment } from '../data/mockData';
import { Language, translations } from '../translations';
import { getCabinetUrl } from '../utils/url';
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
  MoveRight,
  GripVertical,
  Layers,
  FileText,
  User,
  Sparkles,
  ChevronDown,
  FileCheck,
  ZoomIn,
  X,
  ExternalLink,
  MessageSquare,
  Send
} from 'lucide-react';

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
  onOpenRequisitesDirectory
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
          author: 'Заметка',
          text: raw,
          createdAt: new Date().toISOString()
        }];
      }
    }
    return [];
  };

  // Columns State
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns || INITIAL_KANBAN_COLUMNS);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selected Deal Detail/Edit Modal State
  const [selectedDeal, setSelectedDeal] = useState<Integration | null>(null);
  const [editBloggerName, setEditBloggerName] = useState('');
  const [editBloggerLink, setEditBloggerLink] = useState('');
  const [editPlatform, setEditPlatform] = useState<'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok'>('Instagram');
  const [editProjectId, setEditProjectId] = useState('');
  const [editKanbanStage, setEditKanbanStage] = useState('');
  const [editPricePerSlot, setEditPricePerSlot] = useState<number>(0);
  const [editSlotsCount, setEditSlotsCount] = useState<number>(1);
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);
  const [editPaidSlotsCount, setEditPaidSlotsCount] = useState<number>(0);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editReferralLink, setEditReferralLink] = useState('');
  const [editCommentsList, setEditCommentsList] = useState<DealComment[]>([]);
  const [newCommentInput, setNewCommentInput] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'completed' | 'paused'>('active');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedCabinet, setCopiedCabinet] = useState(false);
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
    const authorName = currentUserEmail || (userRole ? `Пользователь (${userRole})` : 'Пользователь');
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

  // Filtered Integrations
  const filteredIntegrations = useMemo(() => {
    return integrations.filter((item) => {
      const matchSearch = item.bloggerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.referralLink && item.referralLink.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchProject = selectedProjectId === 'all' || item.projectId === selectedProjectId;
      const matchPlatform = selectedPlatform === 'all' || item.platform === selectedPlatform;
      return matchSearch && matchProject && matchPlatform;
    });
  }, [integrations, searchQuery, selectedProjectId, selectedPlatform]);

  // Grouped Integrations by Column ID
  const columnDataMap = useMemo(() => {
    const map = new Map<string, Integration[]>();
    columns.forEach(c => map.set(c.id, []));

    filteredIntegrations.forEach((item) => {
      const stage = item.kanbanStage || (item.status === 'completed' ? 'completed' : 'negotiation');
      if (!map.has(stage)) {
        // Fallback to first column if custom stage deleted
        const fallbackCol = columns[0]?.id || 'wishlist';
        if (map.has(fallbackCol)) {
          map.get(fallbackCol)!.push(item);
        }
      } else {
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
    setDraggedDealId(dealId);
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
    const dealId = e.dataTransfer.getData('text/plain');
    if (dealId) {
      onUpdateIntegrationStage(dealId, targetColId);
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
    setEditPlatform('Instagram');
    setEditProjectId(selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id || ''));
    setEditKanbanStage(stageId || columns[0]?.id || 'wishlist');
    setEditPricePerSlot(1000000);
    setEditSlotsCount(1);
    setEditPaidAmount(0);
    setEditPaidSlotsCount(0);
    setEditStartDate(new Date().toISOString().split('T')[0]);
    setEditEndDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setEditReferralLink('');
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
    setEditPlatform(deal.platform || 'Instagram');
    setEditProjectId(deal.projectId || (projects[0] ? projects[0].id : ''));
    setEditKanbanStage(deal.kanbanStage || columns[0]?.id || 'wishlist');
    setEditPricePerSlot(deal.pricePerSlot || 0);
    setEditSlotsCount(deal.slotsCount || 1);
    setEditPaidAmount(deal.paidAmount || 0);
    setEditPaidSlotsCount(deal.paidSlotsCount ?? (deal.paidAmount && deal.pricePerSlot ? Math.min(deal.slotsCount, Math.floor(deal.paidAmount / deal.pricePerSlot)) : 0));
    setEditStartDate(deal.startDate || new Date().toISOString().split('T')[0]);
    setEditEndDate(deal.endDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setEditReferralLink(deal.referralLink || '');
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
      alert('Пожалуйста, укажите имя или канал блогера');
      return;
    }
    const targetProjectId = editProjectId || projects[0]?.id || '';
    if (!targetProjectId) {
      alert('Пожалуйста, выберите проект');
      return;
    }

    setIsSavingEdit(true);
    try {
      const calculatedTotal = Number(editPricePerSlot) * Number(editSlotsCount);

      // Append typed comment in input box if user didn't explicitly click "Отправить"
      let finalComments = [...editCommentsList];
      if (newCommentInput.trim()) {
        const authorName = currentUserEmail || (userRole ? `Пользователь (${userRole})` : 'Пользователь');
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
          bloggerName: editBloggerName,
          bloggerPageLink: editBloggerLink || '',
          platform: editPlatform,
          pricePerSlot: Number(editPricePerSlot) || 0,
          slotsCount: Number(editSlotsCount) || 1,
          paidSlotsCount: Number(editPaidSlotsCount) || 0,
          paidAmount: Number(editPaidAmount) || 0,
          startDate: editStartDate || new Date().toISOString().split('T')[0],
          endDate: editEndDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          referralLink: editReferralLink || (editBloggerName ? `https://${editBloggerName.replace('@', '')}.ref.link` : ''),
          comments: finalComments,
          status: editStatus,
          kanbanStage: editKanbanStage
        });
      } else if (selectedDeal) {
        const updatedFields: Partial<Integration> = {
          bloggerName: editBloggerName,
          bloggerPageLink: editBloggerLink,
          platform: editPlatform,
          projectId: targetProjectId,
          pricePerSlot: Number(editPricePerSlot),
          slotsCount: Number(editSlotsCount),
          totalAmount: calculatedTotal,
          paidAmount: Number(editPaidAmount),
          paidSlotsCount: Number(editPaidSlotsCount),
          startDate: editStartDate,
          endDate: editEndDate,
          referralLink: editReferralLink,
          comments: finalComments,
          status: editStatus,
          kanbanStage: editKanbanStage
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
      alert(isCreateMode ? 'Ошибка при создании сделки' : 'Ошибка при сохранении данных сделки');
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
      setColumns(updated);
      if (onUpdateColumns) onUpdateColumns(updated);
    } else {
      // Add
      const newCol: KanbanColumn = {
        id: `col-${Date.now()}`,
        title: columnTitleInput.trim(),
        color: 'indigo'
      };
      const updated = [...columns, newCol];
      setColumns(updated);
      if (onUpdateColumns) onUpdateColumns(updated);
    }

    setColumnTitleInput('');
    setEditingColumnId(null);
  };

  const handleDeleteColumn = (colId: string) => {
    if (columns.length <= 1) {
      alert('Нельзя удалить единственный столбец!');
      return;
    }
    if (!window.confirm('Вы уверены, что хотите удалить этот столбец? Сделки переместятся в первый доступный столбец.')) return;
    const updated = columns.filter(c => c.id !== colId);
    setColumns(updated);
    if (onUpdateColumns) onUpdateColumns(updated);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 min-h-screen p-4 md:p-8 space-y-6 font-sans">
      {/* Search, Filter & Actions Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-neutral-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени блогера или ссылке..."
              className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 w-4 h-4 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Project selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Проект:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Все проекты</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Platform selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Платформа:</span>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Все платформы</option>
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
              <span>База реквизитов</span>
            </button>
          )}

          <button
            onClick={() => setIsColumnModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-slate-600" />
            <span>Настройка столбцов</span>
          </button>

          <button
            onClick={() => handleOpenCreateDealModal()}
            className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить блогера</span>
          </button>
        </div>
      </div>

      {/* Kanban Dynamic Columns Horizontal Scroll Container */}
      <div className="flex gap-5 items-start overflow-x-auto pb-8 pt-2 snap-x">
        {columns.map((column) => {
          const columnDeals = columnDataMap.get(column.id) || [];
          const totalColumnBudget = columnDeals.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
          const isOver = dragOverColumnId === column.id;

          return (
            <div
              key={column.id}
              onDragOver={(e) => handleDragOverColumn(e, column.id)}
              onDragLeave={() => handleDragLeaveColumn(column.id)}
              onDrop={(e) => handleDropOnColumn(e, column.id)}
              className={`flex flex-col bg-white rounded-2xl border overflow-hidden transition-all duration-150 w-[340px] min-w-[340px] shrink-0 ${
                isOver 
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-md' 
                  : 'border-neutral-200 shadow-xs'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-neutral-200 bg-slate-50/80 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider truncate">
                    {column.title}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-black text-white shrink-0">
                    {columnDeals.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenCreateDealModal(column.id)}
                  title={`Добавить карточку в "${column.title}"`}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-black transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Column Total Budget */}
              <div className="px-3.5 py-1.5 bg-white border-b border-slate-100 text-[11px] font-semibold text-slate-500 flex justify-between shrink-0">
                <span>Итого:</span>
                <span className="font-extrabold text-slate-900">{totalColumnBudget.toLocaleString()} UZS</span>
              </div>

              {/* Cards List Drop Target with Internal Scrollable Area */}
              <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] min-h-[300px] overflow-y-auto flex-1">
                {columnDeals.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl p-4 text-center transition ${
                    isOver ? 'border-indigo-400 bg-indigo-50/40 text-indigo-600' : 'border-slate-200 text-slate-400'
                  }`}>
                    <Clock className="w-5 h-5 mb-1 opacity-50" />
                    <span className="text-xs font-semibold">Перетащите сюда</span>
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
                          isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''
                        }`}
                      >
                        {/* Top Bar */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab" />
                            <span className="px-2 py-0.5 bg-black text-white text-[9px] font-black rounded-md uppercase">
                              {deal.platform}
                            </span>
                            {project && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-800 text-[9px] font-bold rounded-md truncate max-w-[100px]">
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
                              title="Редактировать сделку"
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
                                title="Удалить"
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
                          {deal.bloggerPageLink && (
                            <a
                              href={deal.bloggerPageLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-slate-500 hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span>Ссылка на канал</span>
                            </a>
                          )}

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

                        {/* Amount & Requisites */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span>Сумма:</span>
                            <span className="font-black text-black">
                              {(deal.totalAmount || (deal.pricePerSlot * deal.slotsCount)).toLocaleString()} UZS
                            </span>
                          </div>

                          {/* Requisites Status */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-semibold">Реквизиты:</span>
                            {hasRequisites ? (
                              <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Заполнены
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                <Clock className="w-3 h-3 text-amber-600" /> Ожидаются
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
                                {c.title}
                              </option>
                            ))}
                          </select>

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
                                <span>Скопировано!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Ссылка на реквизиты</span>
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
        })}
      </div>

      {/* Column Management Modal */}
      {isColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 border border-neutral-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <Settings2 className="w-5 h-5" /> Настройка столбцов Канбана
              </h3>
              <button onClick={() => setIsColumnModalOpen(false)} className="text-slate-400 hover:text-black font-bold">✕</button>
            </div>

            {/* Existing columns list */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {columns.map((col, idx) => (
                <div key={col.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span>{col.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditingColumnId(col.id); setColumnTitleInput(col.title); }}
                      className="p-1 text-slate-400 hover:text-black"
                      title="Переименовать"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {columns.length > 1 && (
                      <button
                        onClick={() => handleDeleteColumn(col.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add / Edit Form */}
            <form onSubmit={handleAddOrEditColumn} className="space-y-3 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {editingColumnId ? 'Переименовать столбец' : 'Добавить новый столбец'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={columnTitleInput}
                  onChange={(e) => setColumnTitleInput(e.target.value)}
                  placeholder="Название столбца (напр., Проверка Оферты)"
                  className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs shrink-0"
                >
                  {editingColumnId ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsColumnModalOpen(false)}
                className="px-5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs rounded-xl"
              >
                Готово
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
                      {isCreateMode ? 'Добавить блогера в Канбан' : selectedDeal?.bloggerName}
                    </h3>
                    <span className="px-2 py-0.5 bg-black text-white text-[10px] font-black rounded-md uppercase">
                      {editPlatform}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    {isCreateMode ? 'Заполните параметры и создайте новую сделку' : 'Информация и редактирование сделки'}
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
                <button
                  type="button"
                  onClick={() => handleCopyRequisitesLink(selectedDeal)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  {copiedId === selectedDeal.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Скопировано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ссылка на реквизиты</span>
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
                        <span>Скопировано!</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        <span>Кабинет блогера</span>
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
                    <span>Открыть канал</span>
                  </a>
                )}
              </div>
            )}

            {/* Scrollable Form Body */}
            <form id="deal-edit-form" onSubmit={handleSaveDealEdit} className="space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Имя / Канал блогера *
                  </label>
                  <input
                    type="text"
                    required
                    value={editBloggerName}
                    onChange={(e) => setEditBloggerName(e.target.value)}
                    placeholder="например, @tech_blogger_uz"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Ссылка на страницу / канал
                  </label>
                  <input
                    type="text"
                    value={editBloggerLink}
                    onChange={(e) => setEditBloggerLink(e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Платформа
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
                    Проект *
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
                    Колонка / Этап Канбана
                  </label>
                  <select
                    value={editKanbanStage}
                    onChange={(e) => setEditKanbanStage(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition cursor-pointer"
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Статус сделки
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition cursor-pointer"
                  >
                    <option value="active">Активна</option>
                    <option value="completed">Завершена</option>
                    <option value="paused">На паузе</option>
                  </select>
                </div>
              </div>

              {/* Financials Box */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Финансы и слоты
                  </h4>
                  <div className="text-xs font-bold text-slate-500">
                    Итого к оплате:{' '}
                    <span className="font-black text-slate-900">
                      {(Number(editPricePerSlot || 0) * Number(editSlotsCount || 0)).toLocaleString()} UZS
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Количество слотов
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editSlotsCount}
                      onChange={(e) => setEditSlotsCount(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Цена за слот (UZS)
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editPricePerSlot}
                      onChange={(e) => setEditPricePerSlot(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Оплаченная сумма (UZS)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editPaidAmount}
                      onChange={(e) => setEditPaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>
              </div>

              {/* Dates & Referral Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Дата начала
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Дата окончания
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Реферальная ссылка
                  </label>
                  <input
                    type="text"
                    value={editReferralLink}
                    onChange={(e) => setEditReferralLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Comments Section / Лента комментариев */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-700" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Комментарии и заметки ({editCommentsList.length})
                    </h4>
                  </div>
                  {currentUserEmail && (
                    <span className="text-[11px] font-medium text-slate-500 truncate">
                      Автор: <span className="font-bold text-slate-800">{currentUserEmail}</span>
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
                              {new Date(item.createdAt).toLocaleString('ru-RU', {
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
                              title="Удалить комментарий"
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
                    Комментариев пока нет. Напишите комментарий ниже.
                  </p>
                )}

                {/* Add Comment Input */}
                <div className="pt-2 border-t border-slate-200/80 flex items-end gap-2">
                  <div className="flex-1">
                    <textarea
                      rows={2}
                      value={newCommentInput}
                      onChange={(e) => setNewCommentInput(e.target.value)}
                      placeholder={`Написать комментарий... (${currentUserEmail || 'Пользователь'})`}
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
                    <span>Отправить</span>
                  </button>
                </div>
              </div>

              {/* Requisites Information Section (Edit mode only) */}
              {!isCreateMode && selectedDeal && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Реквизиты блогера
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedDeal.requisites?.taxStatus === 'card_transfer' ? (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          💳 На карту
                        </span>
                      ) : selectedDeal.requisites?.taxStatus === 'contract' ? (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          📄 Договор
                        </span>
                      ) : null}
                      {selectedDeal.requisites ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Заполнены
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-amber-700 font-medium bg-amber-100/80 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-amber-600" /> Ожидаются
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedDeal.requisites ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">ФИО:</span>
                        <span className="font-bold text-slate-900">{selectedDeal.requisites.fullName || '—'}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">Номер карты / IBAN:</span>
                        <span className="font-mono font-bold text-slate-900">{selectedDeal.requisites.cardNumberOrIban || '—'}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">ПИНФЛ / ИНН:</span>
                        <span className="font-mono font-bold text-slate-900">{selectedDeal.requisites.pinflOrTin || '—'}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">Банк / Телефон:</span>
                        <span className="font-semibold text-slate-900">
                          {selectedDeal.requisites.bankName || selectedDeal.requisites.phone || '—'}
                        </span>
                      </div>

                      {/* Passport Scans Previews */}
                      {(selectedDeal.requisites.passportFrontScan || selectedDeal.requisites.passportBackScan) && (
                        <div className="sm:col-span-2 bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider flex items-center gap-1">
                            <FileCheck className="w-3 h-3 text-emerald-600" /> Копии паспорта / ID-карты (2 стороны):
                          </span>
                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            {selectedDeal.requisites.passportFrontScan && (
                              <div 
                                onClick={() => setActivePassportScanZoom({ src: selectedDeal.requisites!.passportFrontScan!, title: 'Лицевая сторона паспорта' })}
                                className="group relative rounded-lg border border-slate-200 overflow-hidden cursor-pointer bg-slate-50 hover:border-black transition"
                              >
                                <img src={selectedDeal.requisites.passportFrontScan} alt="Лицевая сторона" className="w-full h-20 object-cover group-hover:scale-105 transition duration-150" />
                                <div className="p-1 text-center bg-white/95 text-[10px] font-bold text-slate-700 border-t border-slate-100 flex items-center justify-between px-2">
                                  <span>Лицевая сторона</span>
                                  <ZoomIn className="w-3 h-3 text-slate-400" />
                                </div>
                              </div>
                            )}
                            {selectedDeal.requisites.passportBackScan && (
                              <div 
                                onClick={() => setActivePassportScanZoom({ src: selectedDeal.requisites!.passportBackScan!, title: 'Обратная сторона паспорта' })}
                                className="group relative rounded-lg border border-slate-200 overflow-hidden cursor-pointer bg-slate-50 hover:border-black transition"
                              >
                                <img src={selectedDeal.requisites.passportBackScan} alt="Обратная сторона" className="w-full h-20 object-cover group-hover:scale-105 transition duration-150" />
                                <div className="p-1 text-center bg-white/95 text-[10px] font-bold text-slate-700 border-t border-slate-100 flex items-center justify-between px-2">
                                  <span>Обратная сторона</span>
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
                      Блогер еще не заполнил реквизиты. Вы можете скопировать и отправить ему ссылку на форму реквизитов.
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
                      if (window.confirm('Вы уверены, что хотите удалить эту сделку?')) {
                        onDeleteIntegration(selectedDeal.id);
                        handleCloseDealModal();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Удалить</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseDealModal}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Отмена
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
                      <span>{isCreateMode ? 'Создано!' : 'Сохранено!'}</span>
                    </>
                  ) : isSavingEdit ? (
                    <span>{isCreateMode ? 'Создание...' : 'Сохранение...'}</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isCreateMode ? 'Создать сделку' : 'Сохранить изменения'}</span>
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
    </div>
  );
}
