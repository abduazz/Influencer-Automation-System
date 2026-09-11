/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { BloggerRequisites, Integration, Project } from '../data/mockData';
import { Language, translations } from '../translations';
import { 
  FileText, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  UserCheck, 
  CreditCard, 
  Building2, 
  ShieldCheck, 
  Eye, 
  ExternalLink,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  FileCheck,
  ZoomIn,
  X,
  Send,
  Share2,
  Clock,
  Phone,
  MessageCircle,
  Plus,
  ArrowUpRight,
  CheckCircle2
} from 'lucide-react';

interface BloggerRequisitesDirectoryViewProps {
  requisitesList?: BloggerRequisites[];
  integrations?: Integration[];
  projects?: Project[];
  lang?: Language;
  onOpenRequisitesPage?: (integrationId?: string) => void;
  onRefresh?: () => void;
}

export default function BloggerRequisitesDirectoryView({
  requisitesList = [],
  integrations = [],
  projects = [],
  lang = 'ru',
  onOpenRequisitesPage,
  onRefresh
}: BloggerRequisitesDirectoryViewProps) {
  const currentLang = lang || 'ru';
  const t = translations[currentLang] || translations['ru'];

  const [activeTab, setActiveTab] = useState<'filled' | 'pending'>('filled');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaxStatus, setSelectedTaxStatus] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedRequisitesForDoc, setSelectedRequisitesForDoc] = useState<BloggerRequisites | null>(null);
  const [activeScanZoom, setActiveScanZoom] = useState<{ src: string; title: string } | null>(null);

  // Send Requisites Link Modal State
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedIntegrationIdForLink, setSelectedIntegrationIdForLink] = useState<string>('');
  const [copiedModalLink, setCopiedModalLink] = useState(false);
  const [copiedGeneralLink, setCopiedGeneralLink] = useState(false);

  // Combine requisites attached to integrations with standalone requisitesList
  const allRequisites = useMemo(() => {
    const map = new Map<string, BloggerRequisites>();

    // From integrations first (keyed by integration id)
    integrations.forEach((item) => {
      if (item.requisites) {
        const key = String(item.id);
        map.set(key, { ...item.requisites, integrationId: String(item.id), bloggerName: item.bloggerName });
      }
    });

    // From array fetched from API / backend
    requisitesList.forEach((item) => {
      if (item) {
        const key = item.integrationId ? String(item.integrationId) : (item.id ? String(item.id) : '');
        if (key) {
          if (!map.has(key)) {
            map.set(key, item);
          } else {
            map.set(key, { ...map.get(key)!, ...item });
          }
        }
      }
    });

    return Array.from(map.values());
  }, [requisitesList, integrations]);

  // Integrations waiting for requisites: ONLY active deals on 'requisites_pending' stage in Kanban
  const pendingIntegrations = useMemo(() => {
    return integrations.filter((item) => {
      // Exclude historical deals created before Kanban/requisites portal (they have no kanbanStage)
      if (!item.kanbanStage || item.kanbanStage !== 'requisites_pending') {
        return false;
      }
      if (item.status === 'completed') {
        return false;
      }
      const hasRequisites = !!item.requisites || allRequisites.some(r => String(r.integrationId) === String(item.id));
      return !hasRequisites;
    });
  }, [integrations, allRequisites]);

  const availableIntegrationsForLink = useMemo(() => {
    return integrations.filter(i => !!i.kanbanStage && i.status !== 'completed' && i.kanbanStage !== 'completed');
  }, [integrations]);

  // Filtered filled requisites
  const filteredRequisites = useMemo(() => {
    return allRequisites.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = 
        (item.bloggerName || '').toLowerCase().includes(q) ||
        (item.fullName || '').toLowerCase().includes(q) ||
        (item.pinflOrTin || '').includes(q) ||
        (item.cardNumberOrIban || '').includes(q) ||
        (item.phone || '').includes(q) ||
        (item.bankName || '').toLowerCase().includes(q);

      const matchTax = selectedTaxStatus === 'all' || item.taxStatus === selectedTaxStatus;
      return matchSearch && matchTax;
    });
  }, [allRequisites, searchQuery, selectedTaxStatus]);

  // Filtered pending integrations
  const filteredPending = useMemo(() => {
    return pendingIntegrations.filter((item) => {
      const q = searchQuery.toLowerCase();
      return (item.bloggerName || '').toLowerCase().includes(q) ||
        (item.platform || '').toLowerCase().includes(q) ||
        (item.telegramUsername || '').toLowerCase().includes(q);
    });
  }, [pendingIntegrations, searchQuery]);

  const handleCopyCard = (req: BloggerRequisites) => {
    navigator.clipboard.writeText((req.cardNumberOrIban || '').replace(/\s+/g, ''));
    setCopiedId(`card-${req.id}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyValue = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text.trim());
    setCopiedId(identifier);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyLink = (integrationId?: string, identifier = 'general') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tezi.uz';
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    const url = integrationId 
      ? `${origin}${path}?view=requisites&token=${integrationId}`
      : `${origin}${path}?view=requisites`;

    navigator.clipboard.writeText(url);
    setCopiedId(identifier);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCardDisplay = (val?: string) => {
    if (!val) return '';
    const clean = val.replace(/\s+/g, '');
    if (/^\d{16}$/.test(clean)) {
      return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
    }
    return val;
  };

  const getTaxBadge = (status: BloggerRequisites['taxStatus']) => {
    const isContract = status === 'contract';
    const rawLabel = isContract
      ? (t.taxStatusContract || 'Официальный договор')
      : (t.taxStatusCardTransfer || 'Перевод на карту');
    const label = rawLabel.replace(/^[^\w\sа-яА-ЯёЁo'ʻ’‘]+/iu, '').trim();

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
        isContract
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
          : 'bg-blue-50 text-blue-700 border-blue-200'
      }`}>
        {isContract ? <FileText className="w-3 h-3 text-indigo-600" /> : <CreditCard className="w-3 h-3 text-blue-600" />}
        <span>{label}</span>
      </span>
    );
  };

  // Helper for generating share text
  const getTelegramShareUrl = (integration: Integration) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tezi.uz';
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    const formUrl = `${origin}${path}?view=requisites&token=${integration.id}`;
    
    const message = currentLang === 'uz'
      ? `Assalomu alaykum, ${integration.bloggerName}! Iltimos, to'lovni amalga oshirishimiz uchun ushbu havola orqali to'lov rekvizitlaringizni to'ldirib bering:\n${formUrl}`
      : `Здравствуйте, ${integration.bloggerName}! Пожалуйста, заполните форму реквизитов для проведения выплаты:\n${formUrl}`;

    const cleanUsername = (integration.telegramUsername || '').replace(/^@/, '');
    if (cleanUsername) {
      return `https://t.me/${cleanUsername}?text=${encodeURIComponent(message)}`;
    }
    return `https://t.me/share/url?url=${encodeURIComponent(formUrl)}&text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 p-4 md:p-8 space-y-6 font-sans">
      {/* Top Bar: Tabs & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
        {/* Tabs: Filled vs Pending */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('filled')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'filled'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${activeTab === 'filled' ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>{t.tabFilledRequisites || 'Заполненные анкеты'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'filled' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {allRequisites.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${activeTab === 'pending' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>{t.tabPendingRequisites || 'Ожидают реквизитов'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {pendingIntegrations.length}
            </span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (pendingIntegrations.length > 0) {
                setSelectedIntegrationIdForLink(pendingIntegrations[0].id);
              } else if (integrations.length > 0) {
                setSelectedIntegrationIdForLink(integrations[0].id);
              }
              setIsSendModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.sendRequisitesLinkBtn || 'Отправить ссылку на реквизиты'}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenRequisitesPage?.()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
            title="Заполнить реквизиты вручную"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>{t.fillManuallyBtn || 'Заполнить вручную'}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'filled' 
              ? (t.searchRequisitesPlaceholder || 'Поиск по каналу, ФИО, ПИНФЛ, карте...')
              : 'Поиск по блогеру, платформе...'
            }
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black focus:bg-white"
          />
        </div>

        {activeTab === 'filled' && (
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500">{t.payoutFormatLabel || 'Формат выплаты:'}</span>
            <select
              value={selectedTaxStatus}
              onChange={(e) => setSelectedTaxStatus(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">{t.allFormats || 'Все форматы'}</option>
              <option value="card_transfer">{t.taxStatusCardTransfer || '💳 Перевод на карту'}</option>
              <option value="contract">{t.taxStatusContract || '📄 Официальный договор'}</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: FILLED REQUISITES */}
      {activeTab === 'filled' && (
        filteredRequisites.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center space-y-4 shadow-xs">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">{t.noRequisitesFound || 'Заполненные реквизиты не найдены'}</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {t.noRequisitesFoundSub || 'Когда блогеры заполнят анкету реквизитов по высланным ссылкам, их анкеты и паспортные данные появятся в этом реестре.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsSendModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.sendRequisitesLinkBtn || 'Отправить ссылку на реквизиты'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredRequisites.map((req) => {
              const int = integrations.find(i => String(i.id) === String(req.integrationId));
              const proj = int ? projects.find(p => String(p.id) === String(int.projectId)) : null;

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-5 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header: Blogger Identity & Badges */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-slate-900 text-base tracking-tight">
                            {req.bloggerName}
                          </h3>
                          {int?.platform && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                              {int.platform}
                            </span>
                          )}
                          {proj && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200/60">
                              {proj.name}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-slate-800">
                          {req.fullName}
                        </div>

                        {(req.phone || req.telegramHandle) && (
                          <div className="flex items-center gap-3 pt-0.5 text-[11px] text-slate-500 flex-wrap">
                            {req.phone && (
                              <a
                                href={`tel:${req.phone}`}
                                className="inline-flex items-center gap-1 hover:text-black transition"
                              >
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{req.phone}</span>
                              </a>
                            )}
                            {req.telegramHandle && (
                              <a
                                href={`https://t.me/${req.telegramHandle.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 font-medium transition"
                              >
                                <Send className="w-3 h-3 text-sky-500" />
                                <span>{req.telegramHandle.startsWith('@') ? req.telegramHandle : `@${req.telegramHandle}`}</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                        {getTaxBadge(req.taxStatus)}
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>{t.verifiedBadge || 'Проверено'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Passport & Identity Section */}
                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        {/* PINFL */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            {t.pinflOrTin || 'ПИНФЛ / ИНН'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {req.pinflOrTin || <span className="text-slate-400 font-sans font-normal">{t.notSpecified || 'Не указан'}</span>}
                            </span>
                            {req.pinflOrTin && (
                              <button
                                type="button"
                                onClick={() => handleCopyValue(req.pinflOrTin!, `pinfl-${req.id}`)}
                                className="p-0.5 rounded text-slate-400 hover:text-black transition cursor-pointer"
                                title="Скопировать ПИНФЛ"
                              >
                                {copiedId === `pinfl-${req.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Passport series & number */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            {t.passportSeriesNumber || 'Серия и Номер'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {req.passportSeriesNumber || <span className="text-slate-400 font-sans font-normal">{t.notSpecified || 'Не указано'}</span>}
                            </span>
                            {req.passportSeriesNumber && (
                              <button
                                type="button"
                                onClick={() => handleCopyValue(req.passportSeriesNumber!, `pass-${req.id}`)}
                                className="p-0.5 rounded text-slate-400 hover:text-black transition cursor-pointer"
                                title="Скопировать серию и номер паспорта"
                              >
                                {copiedId === `pass-${req.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Registration Address */}
                      {req.registrationAddress && (
                        <div className="pt-2 border-t border-slate-200/60">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Адрес прописки
                          </span>
                          <p className="text-[11px] text-slate-700 leading-snug">
                            {req.registrationAddress}
                          </p>
                        </div>
                      )}

                      {/* Attached Passport Scans */}
                      {(req.passportFrontScan || req.passportBackScan) && (
                        <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                            Скан-копии:
                          </span>
                          {req.passportFrontScan && (
                            <button
                              type="button"
                              onClick={() => setActiveScanZoom({ src: req.passportFrontScan!, title: 'Лицевая сторона паспорта' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                            >
                              <ZoomIn className="w-3 h-3 text-slate-400" />
                              <span>{t.frontSide || 'Лицевая сторона'}</span>
                            </button>
                          )}
                          {req.passportBackScan && (
                            <button
                              type="button"
                              onClick={() => setActiveScanZoom({ src: req.passportBackScan!, title: 'Обратная сторона паспорта' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                            >
                              <ZoomIn className="w-3 h-3 text-slate-400" />
                              <span>{t.backSide || 'Обратная сторона'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Payment Requisites / Bank Card */}
                    <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-slate-800 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.payoutCardIban || 'Карта / Счет для выплаты'}</span>
                        </div>
                        {req.bankName && (
                          <span className="text-[10px] font-bold bg-white/10 text-slate-200 px-2.5 py-0.5 rounded-md border border-white/10">
                            {req.bankName}
                          </span>
                        )}
                      </div>

                      {/* Card Number & Copy */}
                      <div className="flex items-center justify-between gap-3 bg-white/5 p-2.5 rounded-lg border border-white/10">
                        <span className="font-mono text-base font-extrabold tracking-wider text-white select-all">
                          {formatCardDisplay(req.cardNumberOrIban)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleCopyCard(req)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 shadow-xs"
                        >
                          {copiedId === `card-${req.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">{t.copiedBtn || 'Скопировано'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-600" />
                              <span>{t.copyBtn || 'Копировать'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Bank metadata: Transit account, MFO, INN */}
                      {(req.transitAccount || req.mfo || req.bankInn) && (
                        <div className="pt-2 border-t border-white/10 space-y-1.5 text-[11px]">
                          {req.transitAccount && (
                            <div className="flex items-center justify-between gap-2 font-mono">
                              <span className="text-[10px] text-slate-400 font-sans">Транзитный счёт:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-emerald-400 font-bold tracking-wide">{req.transitAccount}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyValue(req.transitAccount!, `transit-${req.id}`)}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                                  title="Скопировать транзитный счёт"
                                >
                                  {copiedId === `transit-${req.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          {(req.mfo || req.bankInn) && (
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                              {req.mfo && (
                                <span>
                                  МФО: <strong className="text-slate-200">{req.mfo}</strong>
                                </span>
                              )}
                              {req.bankInn && (
                                <span>
                                  ИНН банка: <strong className="text-slate-200">{req.bankInn}</strong>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium text-slate-400">
                      {t.submittedDate || 'Заполнено:'} {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : (t.today || 'Сегодня')}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(req.integrationId, `link-${req.id}`)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
                        title="Скопировать ссылку на форму анкеты"
                      >
                        {copiedId === `link-${req.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRequisitesForDoc(req)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{t.viewContractBtn || 'Посмотреть договор'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* TAB 2: PENDING INTEGRATIONS (DEALS AWAITING REQUISITES) */}
      {activeTab === 'pending' && (
        filteredPending.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center space-y-3 shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">{t.noPendingDeals || 'Все блогеры уже заполнили реквизиты!'}</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {t.pendingDealsSub || 'Когда появятся новые интеграции, здесь можно будет в 1 клик скопировать и отправить блогерам ссылки на анкету реквизитов.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-900 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{pendingIntegrations.length}</strong> {t.pendingDealsTitle || 'сделок ожидают заполнения реквизитов'}. Отправьте блогеру ссылку, чтобы он внёс номер карты и паспорт.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPending.map((item) => {
                const proj = projects.find(p => String(p.id) === String(item.projectId));
                const isCopied = copiedId === `pending-${item.id}`;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-black text-white uppercase tracking-wider">
                          {item.platform}
                        </span>
                        {proj && (
                          <span className="text-[11px] font-bold text-slate-500 truncate max-w-[140px]">
                            {proj.name}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base">
                          {item.bloggerName}
                        </h4>
                        {item.telegramUsername && (
                          <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                            @{item.telegramUsername.replace(/^@/, '')}
                          </p>
                        )}
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Сумма сделки:</span>
                        <span className="font-extrabold text-slate-900 font-mono">
                          {(item.totalAmount || item.pricePerSlot || 0).toLocaleString()} UZS
                        </span>
                      </div>
                    </div>

                    {/* Actions for pending item */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {/* Copy Link Button */}
                        <button
                          type="button"
                          onClick={() => handleCopyLink(item.id, `pending-${item.id}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Скопировано!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-300" />
                              <span>Ссылка</span>
                            </>
                          )}
                        </button>

                        {/* Telegram Share Button */}
                        <a
                          href={getTelegramShareUrl(item)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                          title="Отправить в Telegram"
                        >
                          <Send className="w-3.5 h-3.5 text-sky-600" />
                          <span>В Telegram</span>
                        </a>
                      </div>

                      {/* Manual Fill */}
                      <button
                        type="button"
                        onClick={() => onOpenRequisitesPage?.(item.id)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                        <span>Внести реквизиты вручную</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* MODAL: SEND REQUISITES LINK */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base sm:text-lg">
                    {t.sendRequisitesModalTitle || 'Отправка ссылки на форму реквизитов'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t.sendRequisitesModalSub || 'Выберите блогера или скопируйте персональную ссылку для заполнения анкеты'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSendModalOpen(false)}
                className="text-slate-400 hover:text-black font-bold text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Content: Personal Link for selected deal */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  {t.selectBloggerLabel || 'Выберите интеграцию / блогера:'}
                </label>
                <select
                  value={selectedIntegrationIdForLink}
                  onChange={(e) => setSelectedIntegrationIdForLink(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black focus:bg-white"
                >
                  <option value="">{t.selectBloggerPlaceholder || '-- Выберите блогера --'}</option>
                  {(availableIntegrationsForLink.length > 0 ? availableIntegrationsForLink : integrations.slice(0, 10)).map((i) => {
                    const p = projects.find(pr => String(pr.id) === String(i.projectId));
                    const isFilled = allRequisites.some(r => String(r.integrationId) === String(i.id));
                    return (
                      <option key={i.id} value={i.id}>
                        {i.bloggerName} ({i.platform}) {p ? `• ${p.name}` : ''} {isFilled ? '✓ Заполнено' : '⏳ Ожидает'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Display Generated Link */}
              {selectedIntegrationIdForLink ? (
                (() => {
                  const currentIntegration = integrations.find(i => String(i.id) === String(selectedIntegrationIdForLink));
                  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tezi.uz';
                  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
                  const personalUrl = `${origin}${path}?view=requisites&token=${selectedIntegrationIdForLink}`;

                  return (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        {t.personalLinkSection || 'Персональная ссылка для сделки:'}
                      </span>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-800 break-all select-all">
                        {personalUrl}
                      </div>

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {/* Copy Link */}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(personalUrl);
                            setCopiedModalLink(true);
                            setTimeout(() => setCopiedModalLink(false), 2000);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          {copiedModalLink ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span className="text-emerald-400">{t.copiedBtn || 'Скопировано!'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 text-slate-300" />
                              <span>{t.copyLinkBtn || 'Скопировать ссылку'}</span>
                            </>
                          )}
                        </button>

                        {/* Telegram Direct Send */}
                        {currentIntegration && (
                          <a
                            href={getTelegramShareUrl(currentIntegration)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            <Send className="w-4 h-4 text-sky-600" />
                            <span>{t.openInTelegramBtn || 'В Telegram'}</span>
                          </a>
                        )}

                        {/* Open in new tab / fill */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsSendModalOpen(false);
                            onOpenRequisitesPage?.(selectedIntegrationIdForLink);
                          }}
                          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
                          title="Открыть форму для заполнения"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : null}

              {/* Universal general link */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  {t.generalLinkSection || 'Общая ссылка (для любого блогера):'}
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700 truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?view=requisites` : 'https://tezi.uz/?view=requisites'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tezi.uz';
                      const path = typeof window !== 'undefined' ? window.location.pathname : '/';
                      navigator.clipboard.writeText(`${origin}${path}?view=requisites`);
                      setCopiedGeneralLink(true);
                      setTimeout(() => setCopiedGeneralLink(false), 2000);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer shrink-0"
                  >
                    {copiedGeneralLink ? 'Скопировано!' : 'Копировать'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsSendModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {t.closeBtn || 'Закрыть'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract / Agreement Memo Modal */}
      {selectedRequisitesForDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                {selectedRequisitesForDoc.taxStatus === 'card_transfer'
                  ? (t.contractModalCardTitle ? t.contractModalCardTitle.replace('{name}', selectedRequisitesForDoc.bloggerName) : `Реквизиты перевода на карту (${selectedRequisitesForDoc.bloggerName})`)
                  : (t.contractModalServiceTitle ? t.contractModalServiceTitle.replace('{name}', selectedRequisitesForDoc.bloggerName) : `Договор оказания услуг (${selectedRequisitesForDoc.bloggerName})`)}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRequisitesForDoc(null)}
                className="text-slate-400 hover:text-black font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 font-serif text-xs leading-relaxed text-slate-800 space-y-3">
              <div className="text-center font-bold uppercase border-b pb-2">
                {selectedRequisitesForDoc.taxStatus === 'card_transfer'
                  ? (t.contractDocTypeCard || 'РЕКВИЗИТЫ ДЛЯ ПРЯМОГО ПЕРЕВОДА НА КАРТУ')
                  : (t.contractDocTypeService || 'ДОГОВОР-ОФЕРТА НА ОКАЗАНИЕ УСЛУГ')}
              </div>
              <p>
                <strong>{t.contractExecutor || 'Исполнитель / Получатель:'}</strong> {selectedRequisitesForDoc.fullName} ({t.channelLabel || 'Канал'} {selectedRequisitesForDoc.bloggerName})
              </p>
              <p>
                <strong>{t.formatLabel || 'Формат:'}</strong> {selectedRequisitesForDoc.taxStatus === 'card_transfer' ? (t.directCardFormatText || 'Прямой перевод на карту') : (t.officialContractIndividualText || 'Официальный договор с физ. лицом')}
              </p>
              {(selectedRequisitesForDoc.pinflOrTin || selectedRequisitesForDoc.passportSeriesNumber) && (
                <p>
                  <strong>{t.pinflOrTin || 'ПИНФЛ / ИНН'}:</strong> {selectedRequisitesForDoc.pinflOrTin || '—'} | <strong>{t.passportLabel || 'Паспорт:'}</strong> {selectedRequisitesForDoc.passportSeriesNumber || '—'}
                </p>
              )}
              {selectedRequisitesForDoc.registrationAddress && (
                <p>
                  <strong>Адрес прописки:</strong> {selectedRequisitesForDoc.registrationAddress}
                </p>
              )}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 font-sans">
                <span className="text-[11px] font-bold text-slate-900 block">{t.bankRequisitesTitle || 'Банковские реквизиты:'}</span>
                <p><strong>{t.cardLabel || 'Карта:'}</strong> {selectedRequisitesForDoc.cardNumberOrIban}</p>
                {selectedRequisitesForDoc.bankName && <p><strong>{t.bankCbuLabel || 'Банк / ЦБУ:'}</strong> {selectedRequisitesForDoc.bankName}</p>}
                {selectedRequisitesForDoc.bankInn && <p><strong>{t.bankInnLabel || 'ИНН банка:'}</strong> {selectedRequisitesForDoc.bankInn}</p>}
                {selectedRequisitesForDoc.mfo && <p><strong>{t.mfoLabel || 'МФО'}:</strong> {selectedRequisitesForDoc.mfo}</p>}
                {selectedRequisitesForDoc.transitAccount && <p><strong>{t.transitAccountLabel || 'Транзитный счёт:'}</strong> <span className="font-mono">{selectedRequisitesForDoc.transitAccount}</span></p>}
                {selectedRequisitesForDoc.phone && <p><strong>{t.phoneLabel || 'Телефон:'}</strong> {selectedRequisitesForDoc.phone}</p>}
              </div>

              {/* Attached Passport Scans */}
              {(selectedRequisitesForDoc.passportFrontScan || selectedRequisitesForDoc.passportBackScan) && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 font-sans">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {t.attachedPassportScans || 'Прикреплённые копии паспорта / ID-карты:'}
                  </span>
                  <div className="grid grid-cols-2 gap-2 font-sans">
                    {selectedRequisitesForDoc.passportFrontScan ? (
                      <div
                        onClick={() => setActiveScanZoom({ src: selectedRequisitesForDoc.passportFrontScan!, title: t.frontSideTitle || 'Лицевая сторона паспорта' })}
                        className="group relative rounded-xl border border-slate-200 overflow-hidden cursor-pointer bg-white"
                      >
                        <img src={selectedRequisitesForDoc.passportFrontScan} alt={t.frontSide || 'Лицевая сторона'} className="w-full h-24 object-cover group-hover:scale-105 transition duration-150" />
                        <div className="p-1 text-center bg-white/95 text-[10px] font-bold text-slate-700 border-t border-slate-100 flex items-center justify-between px-2">
                          <span>{t.frontSide || 'Лицевая сторона'}</span>
                          <ZoomIn className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    ) : null}

                    {selectedRequisitesForDoc.passportBackScan ? (
                      <div
                        onClick={() => setActiveScanZoom({ src: selectedRequisitesForDoc.passportBackScan!, title: t.backSideTitle || 'Обратная сторона паспорта' })}
                        className="group relative rounded-xl border border-slate-200 overflow-hidden cursor-pointer bg-white"
                      >
                        <img src={selectedRequisitesForDoc.passportBackScan} alt={t.backSide || 'Обратная сторона'} className="w-full h-24 object-cover group-hover:scale-105 transition duration-150" />
                        <div className="p-1 text-center bg-white/95 text-[10px] font-bold text-slate-700 border-t border-slate-100 flex items-center justify-between px-2">
                          <span>{t.backSide || 'Обратная сторона'}</span>
                          <ZoomIn className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-600 pt-2 border-t font-sans">
                {selectedRequisitesForDoc.taxStatus === 'card_transfer'
                  ? (t.contractDisclaimerCard || 'Перевод осуществляется на указанную банковскую карту после согласования выхода рекламных материалов.')
                  : (t.contractDisclaimerService || 'Настоящий документ подтверждает согласие Исполнителя на оказание рекламных услуг и обработку персональных данных.')}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRequisitesForDoc(null)}
                className="px-5 py-2 bg-black text-white font-bold text-xs rounded-xl hover:bg-neutral-800 transition cursor-pointer"
              >
                {t.closeBtn || 'Закрыть'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {activeScanZoom && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4"
          onClick={() => setActiveScanZoom(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between text-white pb-3">
              <span className="font-bold text-sm">{activeScanZoom.title}</span>
              <button
                type="button"
                onClick={() => setActiveScanZoom(null)}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={activeScanZoom.src}
              alt={activeScanZoom.title}
              className="max-h-[80vh] w-auto max-w-full rounded-2xl border border-white/20 shadow-2xl object-contain bg-slate-900"
            />
          </div>
        </div>
      )}
    </div>
  );
}
