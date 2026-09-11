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

    // From array fetched from API / backend
    requisitesList.forEach((item) => {
      if (item && item.id) {
        map.set(item.id, item);
      }
    });

    // From integrations
    integrations.forEach((item) => {
      if (item.requisites) {
        const key = item.requisites.id || `req-${item.id}`;
        if (!map.has(key)) {
          map.set(key, { ...item.requisites, integrationId: item.requisites.integrationId || item.id });
        }
      }
    });

    return Array.from(map.values());
  }, [requisitesList, integrations]);

  // Integrations waiting for requisites
  const pendingIntegrations = useMemo(() => {
    return integrations.filter((item) => {
      const hasRequisites = !!item.requisites || allRequisites.some(r => String(r.integrationId) === String(item.id));
      return !hasRequisites;
    });
  }, [integrations, allRequisites]);

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

  const getTaxBadge = (status: BloggerRequisites['taxStatus']) => {
    switch (status) {
      case 'card_transfer':
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">{t.taxStatusCardTransfer || '💳 Перевод на карту'}</span>;
      case 'contract':
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{t.taxStatusContract || '📄 Официальный договор'}</span>;
      case 'self_employed':
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{t.taxStatusSelfEmployed || 'Самозанятый'}</span>;
      case 'individual_entrepreneur':
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{t.taxStatusIE || 'ИП'}</span>;
      case 'llc':
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">{t.taxStatusLLC || 'ООО / Юр. лицо'}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{t.taxStatusIndividual || 'Физ. лицо'}</span>;
    }
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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-black rounded-xl text-white shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {t.bloggerRequisitesTitle || 'Реквизиты и Договоры Блогеров'}
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              {t.bloggerRequisitesSub || 'База данных заполненных анкет, паспортных данных и карт для выплат'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              {t.totalRequisites || 'Заполнено'}: <span className="text-black font-extrabold">{allRequisites.length}</span>
            </span>
            <span className="px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200 text-xs font-bold text-amber-800">
              {t.tabPendingRequisites || 'Ожидают'}: <span className="text-amber-900 font-extrabold">{pendingIntegrations.length}</span>
            </span>
          </div>

          {/* Action: Send Requisites Link */}
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
            className="flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Send className="w-4 h-4 text-emerald-400" />
            <span>{t.sendRequisitesLinkBtn || 'Отправить ссылку на реквизиты'}</span>
          </button>

          {/* Action: Fill Manually */}
          <button
            type="button"
            onClick={() => onOpenRequisitesPage?.()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
            title="Заполнить реквизиты вручную"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            <span>{t.fillManuallyBtn || 'Заполнить вручную'}</span>
          </button>
        </div>
      </div>

      {/* Tabs: Filled vs Pending */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
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
              <option value="individual">{t.taxStatusIndividual || 'Физ. лицо'}</option>
              <option value="self_employed">{t.taxStatusSelfEmployed || 'Самозанятый'}</option>
              <option value="individual_entrepreneur">{t.taxStatusIE || 'ИП'}</option>
              <option value="llc">{t.taxStatusLLC || 'ООО / Юр. лицо'}</option>
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
                  className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  {/* Header info */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-slate-900 text-base">
                          {req.bloggerName}
                        </h3>
                        {getTaxBadge(req.taxStatus)}
                        {int?.platform && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {int.platform}
                          </span>
                        )}
                        {proj && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600">
                            {proj.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mt-1">
                        {req.fullName}
                      </p>
                      {(req.phone || req.telegramHandle) && (
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          {req.phone && <span>📞 {req.phone}</span>}
                          {req.telegramHandle && <span>✈️ {req.telegramHandle}</span>}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {(req.passportFrontScan || req.passportBackScan) && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <FileCheck className="w-3 h-3 text-emerald-600" />
                          {req.passportFrontScan && req.passportBackScan ? (t.passportBothSides || 'Паспорт (2 стороны)') : (t.passportOneSide || 'Паспорт (1 сторона)')}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" /> {t.verifiedBadge || 'Проверено'}
                      </span>
                    </div>
                  </div>

                  {/* Passport & Bank details */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {t.pinflOrTin || 'ПИНФЛ / ИНН'}
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {req.pinflOrTin || t.notSpecified || 'Не указан'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {t.passportSeriesNumber || 'Серия и Номер'}
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {req.passportSeriesNumber || t.notSpecified || 'Не указано'}
                      </span>
                    </div>

                    {req.registrationAddress && (
                      <div className="col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px] text-slate-600">
                        <span className="font-bold text-slate-400 uppercase text-[9px] block mb-0.5">Адрес прописки:</span>
                        {req.registrationAddress}
                      </div>
                    )}

                    <div className="col-span-2 bg-slate-900 text-white p-3.5 rounded-xl space-y-1 flex items-center justify-between shadow-inner">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {t.payoutCardIban || 'Карта / Счет для выплаты'}
                        </span>
                        <span className="font-mono font-extrabold text-sm text-indigo-300 tracking-wide">
                          {req.cardNumberOrIban}
                        </span>
                        {req.bankName && (
                          <span className="text-[10px] text-slate-300 block mt-0.5">
                            {req.bankName} {req.mfo ? `• ${t.mfoLabel || 'МФО'}: ${req.mfo}` : ''} {req.bankInn ? `• ${t.innLabel || 'ИНН'}: ${req.bankInn}` : ''}
                          </span>
                        )}
                        {req.transitAccount && (
                          <span className="text-[10px] text-indigo-300 block mt-0.5 font-mono">
                            {t.transitAccountLabel || 'Транзитный счёт:'} {req.transitAccount}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyCard(req)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedId === `card-${req.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">{t.copiedBtn || 'Скопировано'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>{t.copyBtn || 'Копировать'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Passport Scans Thumbnails (if uploaded) */}
                  {(req.passportFrontScan || req.passportBackScan) && (
                    <div className="flex items-center gap-3 pt-1">
                      {req.passportFrontScan && (
                        <div 
                          onClick={() => setActiveScanZoom({ src: req.passportFrontScan!, title: 'Лицевая сторона' })}
                          className="flex items-center gap-1.5 p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer text-[10px] font-bold text-slate-700"
                        >
                          <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.frontSide || 'Лицевая сторона'}</span>
                        </div>
                      )}
                      {req.passportBackScan && (
                        <div 
                          onClick={() => setActiveScanZoom({ src: req.passportBackScan!, title: 'Обратная сторона' })}
                          className="flex items-center gap-1.5 p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer text-[10px] font-bold text-slate-700"
                        >
                          <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.backSide || 'Обратная сторона'}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400">
                      {t.submittedDate || 'Заполнено:'} {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : (t.today || 'Сегодня')}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(req.integrationId, `link-${req.id}`)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                        title="Скопировать ссылку на анкету"
                      >
                        {copiedId === `link-${req.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Ссылка</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRequisitesForDoc(req)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-black hover:text-white text-slate-800 font-bold text-xs rounded-lg transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
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
                  {integrations.map((i) => {
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
