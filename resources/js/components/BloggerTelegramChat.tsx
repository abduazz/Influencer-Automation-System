/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Integration, ChatMessage, SiblingBlogger } from '../data/mockData';
import { Language } from '../translations';
import { 
  Send, 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle, 
  ExternalLink, 
  X, 
  RefreshCw, 
  Settings, 
  MessageSquare,
  Sparkles,
  ChevronDown,
  Users,
  Pencil,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { fetchChatMessages, sendChatMessage, updateIntegrationChatSettings, editChatMessage, deleteChatMessage } from '../services/api';
import { formatTelegramLink, formatTelegramHandle } from '../utils/platform';

interface BloggerTelegramChatProps {
  integration: Integration;
  lang?: Language;
  userRole?: string | null;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
  onClose?: () => void;
  onIntegrationUpdated?: (updated: Integration) => void;
  isInline?: boolean;
}

const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
];

/** Check if input looks like a phone number (e.g. +7977..., 79771730800, +9989...) */
const isPhoneOnly = (val: string | null | undefined): boolean => {
  if (!val) return false;
  const clean = val.trim().replace(/[\s\-\(\)]+/g, '');
  return clean.startsWith('+') || /^\d{7,16}$/.test(clean);
};

/** Normalize telegram input, stripping t.me links */
const cleanTelegramUsernameInput = (val: string): string => {
  let clean = val.trim();
  clean = clean.replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me)\/(?:s\/)?/i, '');
  return clean;
};

export default function BloggerTelegramChat({
  integration,
  lang = 'ru',
  userRole,
  currentUserEmail,
  currentUserName,
  onClose,
  onIntegrationUpdated,
  isInline = false,
}: BloggerTelegramChatProps) {
  const isSuperAdmin = 
    userRole === 'super_admin' || 
    currentUserName === 'Super Admin' || 
    (!userRole && !currentUserEmail) ||
    (currentUserEmail && (currentUserEmail.includes('admin') || currentUserEmail === 'chief1' || currentUserEmail === 'abduazz'));

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState<string | null>(integration.telegramChatId || null);
  const [telegramUsername, setTelegramUsername] = useState<string>(integration.telegramUsername || '');
  const [manualUsername, setManualUsername] = useState<string>(integration.telegramUsername || '');
  const [showSettings, setShowSettings] = useState(false);
  const [manualChatId, setManualChatId] = useState(integration.telegramChatId || '');
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [siblingBloggers, setSiblingBloggers] = useState<SiblingBlogger[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Message edit and delete state (Super Admin only)
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null);
  const [deleteRevoke, setDeleteRevoke] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Load initial messages
  const loadMessages = async (silent = false, forceSync = false) => {
    if (!silent) setLoading(true);
    if (forceSync) setRefreshing(true);
    try {
      const res = await fetchChatMessages(integration.id, undefined, forceSync);
      setMessages(res.messages || []);
      if (res.siblingBloggers) setSiblingBloggers(res.siblingBloggers);
      if (res.integration?.telegramUsername !== undefined) {
        setTelegramUsername(res.integration.telegramUsername || '');
      }
      if (res.integration?.telegramChatId !== undefined) {
        setTelegramChatId(res.integration.telegramChatId);
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      if (!silent) setLoading(false);
      if (forceSync) setRefreshing(false);
    }
  };

  useEffect(() => {
    const currentUsername = integration.telegramUsername || '';
    const currentChatId = integration.telegramChatId || null;

    setTelegramUsername(currentUsername);
    setManualUsername(currentUsername);
    setTelegramChatId(currentChatId);
    setManualChatId(currentChatId || '');

    if (!currentUsername && !currentChatId) {
      setMessages([]);
      setLoading(false);
    } else {
      loadMessages();
    }

    // Start smart polling every 3.5 seconds only when contact exists
    pollingRef.current = setInterval(() => {
      if (integration.telegramUsername || integration.telegramChatId) {
        loadMessages(true);
      }
    }, 3500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [integration.id, integration.telegramUsername, integration.telegramChatId]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || sending) return;

    setSendError(null);
    setSending(true);

    // Optimistic message append
    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      integrationId: integration.id,
      senderType: 'manager',
      senderName: currentUserName || 'Super Admin',
      text: textToSend,
      status: 'pending',
      sentAt: nowIso,
      receivedAt: null,
      createdAt: nowIso,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');

    try {
      const res = await sendChatMessage(integration.id, textToSend, currentUserName || 'Super Admin');
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? res.message : m))
      );
      // Reload chat/integration to pick up resolved telegramUsername / telegramChatId
      loadMessages(true);
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
      setSendError(err.message || 'Ошибка при отправке сообщения');
    } finally {
      setSending(false);
      setTimeout(() => scrollToBottom(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      if (editingMessage) {
        e.preventDefault();
        handleCancelEdit();
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage) {
        handleSaveEdit();
      } else {
        handleSend();
      }
    }
  };

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setInputText(msg.text);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessage) return;
    const newText = inputText.trim();
    if (!newText || savingEdit) return;

    setSavingEdit(true);
    setSendError(null);
    try {
      await editChatMessage(
        integration.id, 
        editingMessage.id, 
        newText,
        userRole,
        currentUserEmail
      );
      setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, text: newText, isEdited: true } : m));
      setEditingMessage(null);
      setInputText('');
    } catch (err: any) {
      setSendError(err.message || 'Ошибка редактирования сообщения');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleStartDelete = (msg: ChatMessage) => {
    setDeletingMessage(msg);
    setDeleteRevoke(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMessage) return;
    setIsDeleting(true);
    setSendError(null);
    try {
      await deleteChatMessage(
        integration.id,
        deletingMessage.id,
        deleteRevoke,
        userRole,
        currentUserEmail
      );
      setMessages(prev => prev.filter(m => m.id !== deletingMessage.id));
      if (editingMessage?.id === deletingMessage.id) {
        setEditingMessage(null);
        setInputText('');
      }
      setDeletingMessage(null);
    } catch (err: any) {
      setSendError(err.message || 'Ошибка при удалении сообщения');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveManualSettings = async () => {
    let trimmed = cleanTelegramUsernameInput(manualUsername);
    if (trimmed.startsWith('@')) {
      trimmed = trimmed.substring(1);
    }
    setSavingSettings(true);
    try {
      const contactChanged = trimmed !== (telegramUsername || '');
      const newChatId = contactChanged ? null : (telegramChatId || manualChatId || null);

      const res = await updateIntegrationChatSettings(
        integration.id, 
        newChatId,
        trimmed || null
      );
      setTelegramChatId(res.telegramChatId);
      const savedUser = res.telegramUsername !== undefined ? (res.telegramUsername || '') : trimmed;
      setTelegramUsername(savedUser);
      setManualUsername(savedUser);
      if (contactChanged) {
        setMessages([]);
      }
      setShowSettings(false);
      if (onIntegrationUpdated) {
        onIntegrationUpdated({
          ...integration,
          telegramChatId: res.telegramChatId,
          telegramUsername: savedUser || undefined,
        });
      }
      loadMessages(true, true);
    } catch (err: any) {
      alert('Ошибка при сохранении: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUnlink = async () => {
    const confirmText = lang === 'uz'
      ? 'Haqiqatan ham ushbu Telegram akkauntini kartochkadan uzmoqchimisiz?'
      : lang === 'en'
      ? 'Are you sure you want to unlink Telegram account from this card?'
      : 'Вы уверены, что хотите отвязать Telegram-аккаунт блогера от этой карточки?';

    if (!confirm(confirmText)) return;

    setSavingSettings(true);
    try {
      await updateIntegrationChatSettings(integration.id, null, null);
      setTelegramChatId(null);
      setTelegramUsername('');
      setManualChatId('');
      setManualUsername('');
      setMessages([]);
      setShowSettings(false);
      if (onIntegrationUpdated) {
        onIntegrationUpdated({
          ...integration,
          telegramChatId: undefined,
          telegramUsername: undefined,
        });
      }
    } catch (err: any) {
      alert('Ошибка при отвязке: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };
  const formatFullDateTime = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      if (lang === 'en') {
        const datePart = d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `${datePart}, ${timePart}`;
      }
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
    } catch {
      return '';
    }
  };

  const getMessageDateKey = (msg: ChatMessage) => {
    const raw = msg.sentAt || msg.createdAt;
    if (!raw) return '';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const formatDayDivider = (dateKey: string) => {
    if (!dateKey) return '';
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return dateKey;
      const date = new Date(y, m - 1, d);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const isToday = today.getFullYear() === y && today.getMonth() === m - 1 && today.getDate() === d;
      const isYesterday = yesterday.getFullYear() === y && yesterday.getMonth() === m - 1 && yesterday.getDate() === d;

      let formattedDate = '';
      if (lang === 'uz') {
        const monthName = UZ_MONTHS[m - 1] || '';
        formattedDate = y !== today.getFullYear()
          ? `${d}-${monthName}, ${y}-yil`
          : `${d}-${monthName}`;
      } else {
        formattedDate = date.toLocaleDateString(
          lang === 'en' ? 'en-US' : 'ru-RU',
          { day: 'numeric', month: 'long', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined }
        );
      }

      if (isToday) {
        return lang === 'uz' ? `Bugun, ${formattedDate}` : lang === 'en' ? `Today, ${formattedDate}` : `Сегодня, ${formattedDate}`;
      }
      if (isYesterday) {
        return lang === 'uz' ? `Kecha, ${formattedDate}` : lang === 'en' ? `Yesterday, ${formattedDate}` : `Вчера, ${formattedDate}`;
      }
      return formattedDate;
    } catch {
      return dateKey;
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs ${isInline ? 'min-h-[460px]' : 'h-[620px]'}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-neutral-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
            {integration.bloggerName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-neutral-900 text-xs sm:text-sm truncate leading-snug">
              {integration.bloggerName}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 truncate mt-0.5">
              {(telegramChatId || telegramUsername) ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-neutral-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-mono text-xs text-neutral-700">{telegramUsername ? formatTelegramHandle(telegramUsername) : `ID: ${telegramChatId}`}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setManualUsername(telegramUsername || '');
                    setShowSettings(true);
                  }}
                  className="text-neutral-500 hover:text-neutral-900 underline font-medium cursor-pointer"
                  title="Указать Telegram логин блогера"
                >
                  + Указать @username
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => loadMessages(true, true)}
            disabled={refreshing}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition cursor-pointer disabled:opacity-50"
            title={lang === 'uz' ? 'Telegram bilan yangilash' : lang === 'en' ? 'Sync with Telegram' : 'Синхронизировать с Telegram'}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-neutral-900' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!showSettings) {
                setManualUsername(telegramUsername || '');
              }
              setShowSettings(!showSettings);
            }}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
            title="Настройки контакта"
          >
            <Settings className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Manual Settings Drawer/Bar */}
      {showSettings && (
        <div className="p-3.5 bg-neutral-50 border-b border-neutral-200 flex flex-col gap-2.5 text-xs animate-in fade-in duration-100">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-neutral-600" />
              {lang === 'uz' ? 'Telegram sozlamalari' : lang === 'en' ? 'Telegram Settings' : 'Настройки контакта Telegram'}
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label className="text-[11px] font-medium text-neutral-600 block mb-1">
              {lang === 'uz' ? 'Blogger @username yoki telefon raqami:' : lang === 'en' ? 'Blogger @username or phone:' : 'Telegram логин (@юзернейм) или номер телефона:'}
            </label>
            <input
              type="text"
              value={manualUsername}
              onChange={(e) => setManualUsername(cleanTelegramUsernameInput(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveManualSettings();
                }
              }}
              placeholder="@username или номер (+7977...)"
              className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-neutral-900"
              autoFocus
            />
            {isPhoneOnly(manualUsername) && (
              <div className="mt-1.5 p-2 bg-sky-50 border border-sky-200 rounded-lg text-[11px] text-sky-900 flex items-start gap-1.5">
                <span className="shrink-0 text-sky-600 font-bold">📱</span>
                <span>
                  {lang === 'uz'
                    ? "Telefon raqami kiritildi. Tizim Telegram orqali kontaktni avtomatik topadi va bog'laydi."
                    : "Указан номер телефона. Система автоматически найдет аккаунт блогера в Telegram при отправке."}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-200/80 mt-1">
            {(telegramChatId || telegramUsername) ? (
              <button
                type="button"
                onClick={handleUnlink}
                disabled={savingSettings}
                className="px-2.5 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                {lang === 'uz' ? 'Akkauntni uzish' : lang === 'en' ? 'Unlink account' : 'Отвязать аккаунт'}
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-2.5 py-1.5 text-neutral-500 hover:text-neutral-800 text-xs font-medium cursor-pointer"
              >
                {lang === 'uz' ? 'Bekor qilish' : lang === 'en' ? 'Cancel' : 'Отмена'}
              </button>
              <button
                type="button"
                onClick={handleSaveManualSettings}
                disabled={savingSettings}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold rounded-lg text-xs disabled:opacity-50 transition shadow-2xs cursor-pointer"
              >
                {savingSettings ? '...' : (lang === 'uz' ? 'Saqlash' : lang === 'en' ? 'Save' : 'Сохранить')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Agency / Sibling Bloggers Banner */}
      {siblingBloggers.length > 0 && (
        <div className="px-3.5 py-2 bg-neutral-50 border-b border-neutral-200 text-xs text-neutral-800 shrink-0">
          <div className="flex items-center gap-1.5 font-medium mb-1">
            <Users className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
            <span>
              {lang === 'uz' ? 'Umumiy vakil / Agentlik' : lang === 'en' ? 'Shared Representative / Agency' : 'Общий представитель / Агентство'}
            </span>
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.2 rounded-full bg-neutral-200 text-neutral-700">
              {siblingBloggers.length + 1} {lang === 'uz' ? 'ta' : 'блогеров'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pl-5">
            <span className="text-[11px] text-neutral-500">
              {lang === 'uz' ? 'Shuningdek:' : 'Также ведёт:'}
            </span>
            {siblingBloggers.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-[11px] font-medium text-neutral-800 shadow-2xs"
              >
                <span>{s.bloggerName}</span>
                {s.kanbanStage && (
                  <span className="text-[10px] text-neutral-400">· {s.kanbanStage}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Body */}
      <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 bg-[#fafafa]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-neutral-400 text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-neutral-600" />
            <span>{lang === 'uz' ? 'Xabarlar yuklanmoqda...' : lang === 'en' ? 'Loading messages...' : 'Загрузка сообщений...'}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-neutral-400">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-600 mb-2 shadow-2xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-neutral-800 text-xs mb-1">
              {lang === 'uz' ? 'Hozircha yozishmalar yo‘q' : lang === 'en' ? 'No messages yet' : 'Диалог пока пуст'}
            </h4>

            {(!telegramUsername && !telegramChatId) ? (
              <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-xl p-3.5 shadow-2xs text-left my-2">
                <div className="font-semibold text-neutral-900 text-xs mb-1">
                  {lang === 'uz' ? 'Telegram kontaktni ulash' : lang === 'en' ? 'Link Telegram Contact' : 'Привязать Telegram блогера'}
                </div>
                <p className="text-[11px] text-neutral-500 mb-2.5 leading-relaxed">
                  {lang === 'uz'
                    ? 'Bloggerning @username yoki telefon raqamini kiriting:'
                    : lang === 'en'
                    ? 'Enter blogger’s @username or phone number:'
                    : 'Укажите @username или номер телефона блогера для общения:'}
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={manualUsername}
                    onChange={(e) => setManualUsername(cleanTelegramUsernameInput(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveManualSettings();
                      }
                    }}
                    placeholder="@username или номер (+7977...)"
                    className="flex-1 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveManualSettings}
                    disabled={savingSettings || !manualUsername.trim()}
                    className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition cursor-pointer shrink-0"
                  >
                    {savingSettings ? '...' : (lang === 'uz' ? 'Ulash' : lang === 'en' ? 'Link' : 'Привязать')}
                  </button>
                </div>
              </div>
            ) : isPhoneOnly(telegramUsername) && !telegramChatId ? (
              <div className="w-full max-w-sm bg-sky-50/80 border border-sky-200 rounded-xl p-3.5 text-left my-2 text-xs">
                <div className="font-semibold text-sky-950 flex items-center gap-1.5 mb-1">
                  <span>📱</span>
                  <span>{lang === 'uz' ? 'Telefon raqami orqali chat' : 'Связь по номеру телефона'}</span>
                </div>
                <p className="text-[11px] text-sky-800 mb-2.5 leading-relaxed">
                  {lang === 'uz'
                    ? `Bloger telefon raqami: ${telegramUsername}. Birinchi xabarni pastda yozishingiz mumkin — tizim Telegram orqali kontaktni avtomatik topadi.`
                    : `Указан номер: ${telegramUsername}. Напишите сообщение в поле ниже — система автоматически найдет аккаунт блогера в Telegram и свяжет диалог.`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setManualUsername(telegramUsername);
                    setShowSettings(true);
                  }}
                  className="text-[11px] text-sky-700 hover:text-sky-900 font-semibold underline cursor-pointer"
                >
                  {lang === 'uz' ? 'Raqamni yoki @username-ni o‘zgartirish' : 'Изменить номер или указать @username'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">
                {lang === 'uz'
                  ? 'Bloggerga birinchi xabaringizni quyida yozing.'
                  : lang === 'en'
                  ? 'Type your first message below.'
                  : 'Напишите первое сообщение в поле ниже.'}
              </p>
            )}
          </div>
        ) : (
          messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const dateKey = getMessageDateKey(msg);
            const prevDateKey = prevMsg ? getMessageDateKey(prevMsg) : '';
            const showDateDivider = !prevMsg || (dateKey !== '' && dateKey !== prevDateKey);

            if (msg.senderType === 'system') {
              return (
                <div key={msg.id} className="flex flex-col items-center my-2">
                  {showDateDivider && dateKey && (
                    <div className="flex justify-center mb-2.5 select-none">
                      <span className="px-3 py-0.5 rounded-full bg-neutral-100 border border-neutral-200/80 text-neutral-500 text-[10px] font-semibold tracking-wide shadow-2xs">
                        {formatDayDivider(dateKey)}
                      </span>
                    </div>
                  )}
                  <div className="px-3.5 py-1.5 rounded-full bg-neutral-200/80 text-neutral-600 text-[11px] font-medium max-w-md text-center flex items-center gap-2 shadow-2xs">
                    <span>{msg.text}</span>
                    <span className="text-[9.5px] opacity-75 font-mono">
                      {formatFullDateTime(msg.sentAt || msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            }

            const isManager = msg.senderType === 'manager';
            const sentAt = msg.sentAt || msg.createdAt;
            const receivedAt = msg.receivedAt || (msg.senderType === 'blogger' ? (msg.createdAt || msg.sentAt) : (msg.status === 'delivered' || msg.status === 'read' ? (msg.updatedAt || msg.createdAt) : null));

            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && dateKey && (
                  <div className="flex justify-center my-2.5 select-none">
                    <span className="px-3 py-0.5 rounded-full bg-neutral-100 border border-neutral-200/80 text-neutral-500 text-[10px] font-semibold tracking-wide shadow-2xs">
                      {formatDayDivider(dateKey)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex flex-col ${isManager ? 'items-end' : 'items-start'}`}
                >
                  {!isManager && msg.senderName && (
                    <span className="text-[10px] font-semibold text-neutral-500 mb-0.5 ml-1">
                      {msg.senderName}
                    </span>
                  )}
                  {isManager && (
                    <span className="text-[10px] font-semibold text-neutral-500 mb-0.5 mr-1 text-right">
                      {(msg.senderName && msg.senderName !== 'Менеджер')
                        ? msg.senderName
                        : (currentUserName || 'Super Admin')}
                    </span>
                  )}
                  <div className={`group relative flex items-center gap-1.5 max-w-[85%] sm:max-w-[75%] ${isManager ? 'flex-row' : 'flex-row-reverse'}`}>
                    {/* Super Admin Hover Actions */}
                    {isSuperAdmin && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 bg-white/95 backdrop-blur-xs px-1 py-0.5 rounded-lg border border-neutral-200/90 shadow-2xs">
                        {isManager && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(msg)}
                            className="p-1 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition cursor-pointer"
                            title={lang === 'uz' ? 'Tahrirlash' : 'Редактировать'}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartDelete(msg)}
                          className="p-1 rounded text-neutral-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title={lang === 'uz' ? 'O‘chirish' : 'Удалить'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`w-full min-w-[210px] sm:min-w-[230px] px-3.5 py-2.5 rounded-2xl text-xs shadow-2xs relative break-words ${
                        isManager
                          ? 'bg-neutral-900 text-white rounded-br-xs'
                          : 'bg-white text-neutral-900 border border-neutral-200/90 rounded-bl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed select-text">
                        {msg.text}
                      </div>

                      {/* Timestamps Section: Дата и время отправления и получения */}
                      <div className={`mt-2 pt-1.5 border-t text-[10px] space-y-0.5 select-none ${
                        isManager ? 'border-white/15 text-neutral-300' : 'border-neutral-200/80 text-neutral-600'
                      }`}>
                        {/* Дата/время отправления */}
                        <div className="flex items-center justify-between gap-3 text-[10px]">
                          <span className="inline-flex items-center gap-1 font-semibold opacity-85">
                            <Send className="w-2.5 h-2.5 shrink-0 opacity-70" />
                            <span>{lang === 'uz' ? 'Yuborilgan' : lang === 'en' ? 'Sent' : 'Отправлено'}:</span>
                          </span>
                          <span className="font-mono font-medium whitespace-nowrap text-[9.5px]">
                            {formatFullDateTime(sentAt)}
                          </span>
                        </div>

                        {/* Дата/время получения / доставки */}
                        <div className="flex items-center justify-between gap-3 text-[10px]">
                          <span className="inline-flex items-center gap-1 font-semibold opacity-85">
                            <CheckCheck className="w-2.5 h-2.5 shrink-0 opacity-70" />
                            <span>
                              {isManager
                                ? (lang === 'uz' ? 'Yetkazilgan' : lang === 'en' ? 'Delivered' : 'Доставлено')
                                : (lang === 'uz' ? 'Qabul qilingan' : lang === 'en' ? 'Received' : 'Получено')}:
                            </span>
                          </span>
                          <span className="font-mono font-medium whitespace-nowrap text-[9.5px] flex items-center gap-1">
                            {receivedAt ? (
                              <>
                                <span>{formatFullDateTime(receivedAt)}</span>
                                {isManager && (
                                  <span>
                                    {msg.status === 'delivered' || msg.status === 'read' ? (
                                      <CheckCheck className="w-3 h-3 text-emerald-400 inline" />
                                    ) : msg.status === 'sent' ? (
                                      <Check className="w-3 h-3 text-neutral-300 inline" />
                                    ) : (
                                      <AlertCircle className="w-2.5 h-2.5 text-rose-400 inline" />
                                    )}
                                  </span>
                                )}
                              </>
                            ) : isManager && msg.status === 'pending' ? (
                              <span className="text-amber-300 italic flex items-center gap-1 font-sans text-[10px]">
                                <Clock className="w-2.5 h-2.5 animate-spin inline" />
                                <span>{lang === 'uz' ? 'Yuborilmoqda...' : lang === 'en' ? 'Sending...' : 'Отправка...'}</span>
                              </span>
                            ) : isManager && msg.status === 'failed' ? (
                              <span className="text-rose-400 font-semibold flex items-center gap-1 font-sans text-[10px]">
                                <AlertCircle className="w-2.5 h-2.5 inline" />
                                <span>{lang === 'uz' ? 'Xatolik' : lang === 'en' ? 'Failed' : 'Не доставлено'}</span>
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {msg.isEdited && (
                        <div className="text-[9px] italic opacity-70 mt-1 text-right">
                          {lang === 'uz' ? 'tahrirlangan' : lang === 'en' ? 'edited' : 'изменено'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send Error Alert */}
      {sendError && (
        <div className="px-3.5 py-1.5 bg-neutral-100 border-t border-neutral-200 text-xs text-rose-700 flex items-center justify-between">
          <span>{sendError}</span>
          <button type="button" onClick={() => setSendError(null)} className="font-bold cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* Editing Message Header */}
      {editingMessage && (
        <div className="px-3.5 py-2 bg-neutral-100 border-t border-neutral-200 text-xs flex items-center justify-between shrink-0 animate-in fade-in duration-100">
          <div className="flex items-center gap-2 min-w-0">
            <Pencil className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-neutral-800 text-[11px] block">
                {lang === 'uz' ? 'Xabarni tahrirlash' : 'Редактирование сообщения'}
              </span>
              <span className="text-neutral-500 text-[11px] truncate block max-w-sm">
                {editingMessage.text}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-200/60 cursor-pointer"
            title="Отмена (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Footer / Input Area */}
      <form onSubmit={editingMessage ? (e) => { e.preventDefault(); handleSaveEdit(); } : handleSend} className="p-2.5 sm:p-3 bg-white border-t border-neutral-200 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!telegramUsername && !telegramChatId}
            placeholder={
              (!telegramUsername && !telegramChatId)
                ? (lang === 'uz' ? 'Xabar yozish uchun avval Telegram kontaktni ulang...' : 'Для отправки сообщений привяжите Telegram блогера...')
                : editingMessage
                ? (lang === 'uz' ? 'O‘zgartirilgan xabarni kiriting (Enter - saqlash)...' : 'Введите измененный текст (Enter для сохранения)...')
                : (lang === 'uz' ? 'Xabar yozing (Enter - jo‘natish)...' : 'Напишите сообщение (Enter для отправки)...')
            }
            rows={1}
            className={`flex-1 max-h-28 min-h-[38px] px-3.5 py-2 border rounded-xl text-xs font-normal focus:outline-none transition resize-none leading-relaxed ${
              (!telegramUsername && !telegramChatId)
                ? 'bg-neutral-100/70 border-neutral-200 text-neutral-400 cursor-not-allowed'
                : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:bg-white'
            }`}
            autoFocus={!!editingMessage}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending || savingEdit || (!telegramUsername && !telegramChatId)}
            className={`h-[38px] px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs shrink-0 cursor-pointer ${
              editingMessage
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-neutral-900 hover:bg-neutral-800 text-white'
            }`}
          >
            {sending || savingEdit ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : editingMessage ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {editingMessage
                ? (lang === 'uz' ? 'Saqlash' : 'Сохранить')
                : (lang === 'uz' ? 'Jo‘natish' : 'Отправить')}
            </span>
          </button>
        </div>
      </form>

      {/* Delete Confirmation Modal (Telegram-style) */}
      {deletingMessage && (
        <div 
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in duration-150"
          onClick={() => !isDeleting && setDeletingMessage(null)}
        >
          <div 
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-neutral-200 p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-neutral-900 text-sm">
                  {lang === 'uz' ? 'Xabarni o‘chirish' : 'Удалить сообщение?'}
                </h3>
                <p className="text-neutral-500 text-[11px] truncate mt-0.5">
                  "{deletingMessage.text.slice(0, 60)}{deletingMessage.text.length > 60 ? '...' : ''}"
                </p>
              </div>
            </div>

            {/* Deletion mode choices */}
            <div className="space-y-2 pt-1">
              <label 
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                  !deleteRevoke 
                    ? 'border-neutral-900 bg-neutral-50/80 text-neutral-900' 
                    : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                }`}
              >
                <input
                  type="radio"
                  name="deleteMode"
                  checked={!deleteRevoke}
                  onChange={() => setDeleteRevoke(false)}
                  className="mt-0.5 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="font-semibold block text-xs">
                    {lang === 'uz' ? 'Faqat o‘zim uchun o‘chirish' : 'Удалить только у себя'}
                  </span>
                  <span className="text-[11px] text-neutral-500 leading-tight block mt-0.5">
                    {lang === 'uz' 
                      ? 'Xabar CRM va profilingizdan o‘chiriladi, lekin suhbatdoshda qoladi'
                      : 'Сообщение исчезнет из CRM и вашего Telegram, но останется у собеседника'}
                  </span>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                  deleteRevoke 
                    ? 'border-rose-600 bg-rose-50/50 text-neutral-900' 
                    : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                }`}
              >
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteRevoke}
                  onChange={() => setDeleteRevoke(true)}
                  className="mt-0.5 text-rose-600 focus:ring-rose-600 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="font-semibold block text-xs text-rose-950">
                    {lang === 'uz' 
                      ? `Men va ${integration.bloggerName} uchun ham o‘chirish`
                      : `Удалить у меня и у ${integration.bloggerName}`}
                  </span>
                  <span className="text-[11px] text-neutral-500 leading-tight block mt-0.5">
                    {lang === 'uz'
                      ? 'Xabar Telegramda ikkala tomon uchun ham butunlay qaytarib olinadi'
                      : 'Сообщение будет отозвано и удалено для обоих участников в Telegram'}
                  </span>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeletingMessage(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-neutral-600 hover:text-neutral-900 text-xs font-semibold rounded-lg cursor-pointer"
              >
                {lang === 'uz' ? 'Bekor qilish' : 'Отмена'}
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{lang === 'uz' ? 'O‘chirish' : 'Удалить'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
