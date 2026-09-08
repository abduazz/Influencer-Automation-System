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
  X
} from 'lucide-react';

interface BloggerRequisitesDirectoryViewProps {
  requisitesList?: BloggerRequisites[];
  integrations?: Integration[];
  projects?: Project[];
  lang?: Language;
  onOpenRequisitesPage?: (integrationId: string) => void;
}

export default function BloggerRequisitesDirectoryView({
  requisitesList = [],
  integrations = [],
  projects = [],
  lang = 'ru',
  onOpenRequisitesPage
}: BloggerRequisitesDirectoryViewProps) {
  const currentLang = lang || 'ru';
  const t = translations[currentLang] || translations['ru'];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaxStatus, setSelectedTaxStatus] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedRequisitesForDoc, setSelectedRequisitesForDoc] = useState<BloggerRequisites | null>(null);
  const [activeScanZoom, setActiveScanZoom] = useState<{ src: string; title: string } | null>(null);

  // Combine requisites attached to integrations with standalone requisitesList
  const allRequisites = useMemo(() => {
    const map = new Map<string, BloggerRequisites>();

    // From integrations
    integrations.forEach((item) => {
      if (item.requisites) {
        map.set(item.requisites.id || item.id, item.requisites);
      }
    });

    // From array
    requisitesList.forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    });

    return Array.from(map.values());
  }, [requisitesList, integrations]);

  // Filtered list
  const filteredRequisites = useMemo(() => {
    return allRequisites.filter((item) => {
      const matchSearch = item.bloggerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.pinflOrTin.includes(searchQuery) ||
        item.cardNumberOrIban.includes(searchQuery);

      const matchTax = selectedTaxStatus === 'all' || item.taxStatus === selectedTaxStatus;
      return matchSearch && matchTax;
    });
  }, [allRequisites, searchQuery, selectedTaxStatus]);

  const handleCopyCard = (req: BloggerRequisites) => {
    navigator.clipboard.writeText(req.cardNumberOrIban.replace(/\s+/g, ''));
    setCopiedId(req.id);
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-black rounded-xl text-white">
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

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
            {t.totalRequisites || 'Всего реквизитов'}: <span className="text-black font-extrabold">{allRequisites.length}</span>
          </div>
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
            placeholder={t.searchRequisitesPlaceholder || 'Поиск по каналу, ФИО, ПИНФЛ, карте...'}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black focus:bg-white"
          />
        </div>

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
      </div>

      {/* Requisites Directory Grid / Table */}
      {filteredRequisites.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center space-y-3 shadow-xs">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">{t.noRequisitesFound || 'Заполненные реквизиты не найдены'}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t.noRequisitesFoundSub || 'Когда блогеры заполнят анкету реквизитов по высланным ссылкам, их анкеты и паспортные данные появятся в этом реестре.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRequisites.map((req) => {
            const int = integrations.find(i => i.id === req.integrationId);

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 text-base">
                        {req.bloggerName}
                      </h3>
                      {getTaxBadge(req.taxStatus)}
                    </div>
                    <p className="text-xs font-semibold text-slate-600 mt-1">
                      {req.fullName}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
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

                  <div className="col-span-2 bg-slate-900 text-white p-3.5 rounded-xl space-y-1 flex items-center justify-between shadow-inner">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {t.payoutCardIban || 'Карта / Счет для выплаты'}
                      </span>
                      <span className="font-mono font-extrabold text-sm text-indigo-300">
                        {req.cardNumberOrIban}
                      </span>
                      {req.bankName && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
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
                      onClick={() => handleCopyCard(req)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedId === req.id ? (
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

                {/* Footer action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-400">
                    {t.submittedDate || 'Заполнено:'} {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : (t.today || 'Сегодня')}
                  </span>

                  <button
                    onClick={() => setSelectedRequisitesForDoc(req)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-black hover:text-white text-slate-800 font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t.viewContractBtn || 'Посмотреть договор'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contract Modal */}
      {selectedRequisitesForDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                {selectedRequisitesForDoc.taxStatus === 'card_transfer'
                  ? (t.contractModalCardTitle ? t.contractModalCardTitle.replace('{name}', selectedRequisitesForDoc.bloggerName) : `Реквизиты перевода на карту (${selectedRequisitesForDoc.bloggerName})`)
                  : (t.contractModalServiceTitle ? t.contractModalServiceTitle.replace('{name}', selectedRequisitesForDoc.bloggerName) : `Договор оказания услуг (${selectedRequisitesForDoc.bloggerName})`)}
              </h3>
              <button
                onClick={() => setSelectedRequisitesForDoc(null)}
                className="text-slate-400 hover:text-black font-bold text-lg"
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
