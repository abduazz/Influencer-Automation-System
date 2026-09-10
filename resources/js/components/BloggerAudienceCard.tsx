/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Integration, SubscriberHistoryItem } from '../data/mockData';
import { Language, translations } from '../translations';
import { 
  Users, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  LineChart, 
  X, 
  Check, 
  Coins
} from 'lucide-react';

interface BloggerAudienceCardProps {
  integration: Integration;
  lang?: Language;
  onRefreshSubscribers?: (integrationId: string) => Promise<void>;
  onAddManualSnapshot?: (integrationId: string, date: string, count: number, note?: string) => Promise<void>;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
}

export default function BloggerAudienceCard({
  integration,
  lang = 'ru',
  onRefreshSubscribers,
  onAddManualSnapshot,
  isCollapsible = false,
  defaultExpanded = true,
}: BloggerAudienceCardProps) {
  const t = translations[lang] || translations['ru'];
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showManualForm, setShowManualForm] = useState<boolean>(false);
  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [manualCount, setManualCount] = useState<string>('');
  const [manualNote, setManualNote] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; item: SubscriberHistoryItem; index: number; delta: number } | null>(null);

  const currentCount = integration.subscribersCount ?? null;
  const history: SubscriberHistoryItem[] = useMemo(() => {
    const list = Array.isArray(integration.subscribersHistory) ? [...integration.subscribersHistory] : [];
    return list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [integration.subscribersHistory]);

  // Calculations for growth and metrics
  const stats = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        delta: 0,
        deltaPercent: 0,
        tier: getAudienceTier(currentCount || 0),
        cpfs: calculateCpfs(integration.pricePerSlot, currentCount),
        firstDate: null,
        latestDate: integration.subscribersUpdatedAt ? formatDate(integration.subscribersUpdatedAt) : null
      };
    }

    const latest = history[history.length - 1];
    const prev = history.length > 1 ? history[history.length - 2] : null;
    const first = history[0];

    const current = currentCount ?? latest.count;
    const delta = prev ? current - prev.count : 0;
    const deltaPercent = prev && prev.count > 0 ? (delta / prev.count) * 100 : 0;
    const totalGrowth = first && first.count > 0 ? ((current - first.count) / first.count) * 100 : 0;

    return {
      delta,
      deltaPercent,
      totalGrowth,
      tier: getAudienceTier(current),
      cpfs: calculateCpfs(integration.pricePerSlot, current),
      firstDate: formatDate(first.date),
      latestDate: formatDate(latest.date),
      minCount: Math.min(...history.map(h => h.count)),
      maxCount: Math.max(...history.map(h => h.count)),
    };
  }, [history, currentCount, integration.pricePerSlot, integration.subscribersUpdatedAt]);

  function getAudienceTier(count: number) {
    if (count <= 0) return { label: t.audTierNew || 'Новый', color: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
    if (count < 15000) return { label: 'Nano (<15K)', color: 'bg-neutral-100 text-neutral-700 border-neutral-200' };
    if (count < 100000) return { label: 'Micro (15K-100K)', color: 'bg-neutral-100 text-neutral-800 border-neutral-200' };
    if (count < 500000) return { label: 'Mid-tier (100K-500K)', color: 'bg-neutral-100 text-neutral-800 border-neutral-200' };
    if (count < 1000000) return { label: 'Macro (500K-1M)', color: 'bg-neutral-100 text-neutral-900 border-neutral-300 font-black' };
    return { label: 'Celebrity (1M+)', color: 'bg-black text-white border-black' };
  }

  function calculateCpfs(pricePerSlot?: number, count?: number | null): string | null {
    if (!pricePerSlot || !count || count <= 0) return null;
    const cpfs = (pricePerSlot / count) * 1000;
    if (cpfs < 1) {
      return cpfs.toFixed(2);
    }
    return Math.round(cpfs).toLocaleString();
  }

  function formatSubscribersCount(num?: number | null): string {
    if (num === null || num === undefined || isNaN(num)) return '—';
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 1000000) {
      const val = abs / 1000000;
      const formatted = (val % 1 === 0 ? val : parseFloat(val.toFixed(2))).toString();
      return `${sign}${formatted}M`;
    }
    if (abs >= 1000) {
      const val = abs / 1000;
      const formatted = (val % 1 === 0 ? val : parseFloat(val.toFixed(2))).toString();
      const unit = lang === 'ru' ? ' к' : 'K';
      return `${sign}${formatted}${unit}`;
    }
    return `${sign}${abs}`;
  }

  function formatDate(dStr?: string | null): string {
    if (!dStr) return '';
    try {
      const cleanStr = dStr.split('T')[0].split(' ')[0];
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${day}/${month}`;
      }
      const date = new Date(dStr);
      if (isNaN(date.getTime())) return dStr;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}`;
    } catch {
      return dStr;
    }
  }

  const handleRefreshClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRefreshing || !onRefreshSubscribers) return;
    setIsRefreshing(true);
    try {
      await onRefreshSubscribers(integration.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    const parsed = parseInt(manualCount.replace(/\s+/g, ''), 10);
    if (isNaN(parsed) || parsed < 0) {
      setManualError(t.audErrorEnterNumber || 'Введите число');
      return;
    }
    if (!manualDate) {
      setManualError(t.audErrorSpecifyDate || 'Укажите дату');
      return;
    }

    if (onAddManualSnapshot) {
      setIsSavingManual(true);
      try {
        await onAddManualSnapshot(integration.id, manualDate, parsed, manualNote || undefined);
        setShowManualForm(false);
        setManualCount('');
        setManualNote('');
      } catch (err: any) {
        setManualError(err?.message || (lang === 'uz' ? 'Xatolik' : lang === 'en' ? 'Error' : 'Ошибка'));
      } finally {
        setIsSavingManual(false);
      }
    }
  };

  // SVG Chart Geometry Calculations
  const chartGeometry = useMemo(() => {
    if (history.length < 2) return null;

    const width = 340;
    const height = 150;
    const padX = 28;
    const padTop = 18;
    const padBottom = 26;

    const counts = history.map(h => h.count);
    const minVal = Math.min(...counts);
    const maxVal = Math.max(...counts);
    const range = maxVal - minVal || 1;
    const viewMin = Math.max(0, minVal - range * 0.1);
    const viewMax = maxVal + range * 0.15;
    const viewRange = viewMax - viewMin || 1;

    const chartW = width - padX * 2;
    const chartH = height - padTop - padBottom;

    const points = history.map((item, i) => {
      const x = padX + (i / (history.length - 1)) * chartW;
      const y = padTop + chartH - ((item.count - viewMin) / viewRange) * chartH;
      const prevItem = i > 0 ? history[i - 1] : null;
      const delta = prevItem ? item.count - prevItem.count : 0;
      return { x, y, item, index: i, delta };
    });

    const pathD = points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x},${height - padBottom} L ${points[0].x},${height - padBottom} Z`;

    return {
      width,
      height,
      points,
      pathD,
      areaD,
      padX,
      padTop,
      padBottom,
      viewMin,
      viewMax
    };
  }, [history]);

  return (
    <div className="w-full text-neutral-800">
      {/* Optional Collapsible Header Trigger */}
      {isCollapsible && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer ${
            isExpanded 
              ? 'bg-black text-white border-black shadow-xs' 
              : 'bg-white hover:bg-neutral-100 text-neutral-800 border-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{t.audAnalysisAndChart || 'Анализ аудитории и график'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isExpanded ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-600'}`}>
              {isFlipped ? (t.audDiagram || 'Диаграмма') : (t.audJournal || 'Журнал')}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>
      )}

      {/* Main Container */}
      {(isExpanded || !isCollapsible) && (
        <div className="rounded-xl bg-white border border-neutral-200 shadow-2xs overflow-hidden">
          
          {/* Top Header Bar */}
          <div className="px-3.5 py-2.5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                {isFlipped ? <LineChart className="w-3.5 h-3.5 text-black" /> : <Users className="w-3.5 h-3.5 text-black" />}
                {isFlipped ? (t.audGrowthChart || 'График роста') : (t.audAudience || 'Аудитория')}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${stats.tier.color}`}>
                {stats.tier.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Refresh API Button */}
              {onRefreshSubscribers && (
                <button
                  type="button"
                  onClick={handleRefreshClick}
                  disabled={isRefreshing}
                  title={t.audRefreshTooltip || 'Запустить замер подписчиков через API'}
                  className={`p-1.5 rounded-lg text-neutral-500 hover:text-black hover:bg-neutral-200/70 transition cursor-pointer ${
                    isRefreshing ? 'animate-spin text-black' : ''
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Segmented Flip Switch */}
              <div className="flex items-center bg-neutral-200/70 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsFlipped(false)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    !isFlipped ? 'bg-black text-white shadow-2xs' : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  {t.audJournal || 'Журнал'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFlipped(true)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    isFlipped ? 'bg-black text-white shadow-2xs' : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  {t.audDiagram || 'График'}
                </button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-3.5">
            {/* FRONT SIDE: Current Stats & Log */}
            {!isFlipped ? (
              <div className="space-y-3">
                {/* Highlight Numbers Box */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                      {t.audCurrentSubscribers || 'Текущие подписчики'}
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span 
                        className="text-2xl font-black text-black tracking-tight"
                        title={currentCount ? `${currentCount.toLocaleString()} ${t.audSubscribersUnit || 'подписчиков'}` : undefined}
                      >
                        {currentCount ? formatSubscribersCount(currentCount) : '—'}
                      </span>
                    </div>
                  </div>

                  {stats.delta !== 0 && (
                    <div className={`text-right px-2.5 py-1 rounded-lg border text-xs font-bold ${
                      stats.delta > 0 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      <div>{stats.delta > 0 ? `+${formatSubscribersCount(stats.delta)}` : formatSubscribersCount(stats.delta)}</div>
                      <div className="text-[9px] font-bold opacity-80">
                        {stats.delta > 0 ? `+${stats.deltaPercent.toFixed(1)}%` : `${stats.deltaPercent.toFixed(1)}%`}
                      </div>
                    </div>
                  )}
                </div>

                {/* Economics (CPFS / CPM) */}
                {stats.cpfs && (
                  <div className="flex items-center justify-between text-xs px-1 text-neutral-500 font-bold">
                    <span className="flex items-center gap-1 text-neutral-400">
                      <Coins className="w-3.5 h-3.5 text-neutral-400" />
                      {t.audCostPer1kReach || 'Стоимость на 1,000 охвата:'}
                    </span>
                    <span className="text-neutral-900 font-black">
                      ~{stats.cpfs} UZS / 1K
                    </span>
                  </div>
                )}

                {/* Action toolbar */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-100">
                  <span className="font-extrabold text-neutral-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    {t.audSnapshotRecords || 'Записи замеров'} ({history.length})
                  </span>
                  
                  {onAddManualSnapshot && (
                    <button
                      type="button"
                      onClick={() => setShowManualForm(!showManualForm)}
                      className="flex items-center gap-1 text-xs font-bold text-black hover:underline cursor-pointer"
                    >
                      {showManualForm && <X className="w-3 h-3" />}
                      <span>{showManualForm ? (t.audCancelBtn || 'Отмена') : (t.audAddSnapshotBtn || '+ Добавить замер')}</span>
                    </button>
                  )}
                </div>

                {/* Inline Add Manual Checkpoint Form */}
                {showManualForm && (
                  <form onSubmit={handleSaveManual} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">{t.audDateLabel || 'Дата'}</label>
                        <input
                          type="date"
                          value={manualDate}
                          onChange={(e) => setManualDate(e.target.value)}
                          className="w-full text-xs font-bold px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">{t.audSubscribersLabel || 'Подписчики'}</label>
                        <input
                          type="number"
                          placeholder="125000"
                          value={manualCount}
                          onChange={(e) => setManualCount(e.target.value)}
                          className="w-full text-xs font-bold px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder={t.audNotePlaceholder || 'Заметка к замеру (опционально)'}
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        className="w-full text-xs font-bold px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                    {manualError && (
                      <p className="text-[10px] text-rose-600 font-bold">{manualError}</p>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowManualForm(false)}
                        className="px-2.5 py-1 text-xs font-bold text-neutral-500 hover:bg-neutral-200 rounded-lg cursor-pointer"
                      >
                        {t.audCancelBtn || 'Отмена'}
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingManual}
                        className="px-3 py-1 text-xs font-bold bg-black text-white rounded-lg hover:bg-neutral-800 cursor-pointer flex items-center gap-1"
                      >
                        {isSavingManual ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        {t.audSaveBtn || 'Сохранить'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Timeline list */}
                <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-neutral-100">
                  {history.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-xs text-neutral-400 font-bold">{t.audNoHistory || 'Нет истории замеров'}</p>
                      {onRefreshSubscribers && (
                        <button
                          type="button"
                          onClick={handleRefreshClick}
                          disabled={isRefreshing}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-black underline cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                          {t.audRunFirstCheck || 'Запустить первую проверку'}
                        </button>
                      )}
                    </div>
                  ) : (
                    [...history].reverse().map((item, idx, arr) => {
                      const nextItemInTime = idx < arr.length - 1 ? arr[idx + 1] : null;
                      const diff = nextItemInTime ? item.count - nextItemInTime.count : 0;
                      return (
                        <div key={item.date + '-' + idx} className="pt-1.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-neutral-400 font-semibold min-w-[70px]">
                              {formatDate(item.date)}
                            </span>
                            <span className="font-bold text-neutral-900" title={item.count.toLocaleString()}>
                              {formatSubscribersCount(item.count)}
                            </span>
                            {item.source && (
                              <span className="text-[8px] font-bold uppercase px-1 py-0.2 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">
                                {item.source === 'youtube_public' ? 'YouTube'
                                  : item.source === 'telegram_public' ? 'Telegram'
                                  : item.source === 'api' || item.source === 'meta_api' ? 'Meta API'
                                  : item.source === 'manual' ? (t.audSourceManual || 'Ручной')
                                  : item.source === 'mock_api' ? (t.audSourceTest || 'Тест')
                                  : (t.audSourceHistory || 'История')}
                              </span>
                            )}
                          </div>

                          {diff !== 0 && (
                            <span className={`text-[10px] font-bold ${diff > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {diff > 0 ? `+${formatSubscribersCount(diff)}` : formatSubscribersCount(diff)}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* BACK SIDE: Minimalist Monochrome SVG Chart */
              <div>
                {chartGeometry ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold text-neutral-400">
                        {stats.firstDate} → {stats.latestDate}
                      </span>
                      {stats.totalGrowth !== undefined && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          stats.totalGrowth >= 0 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {t.audGrowthLabel || 'Прирост:'} {stats.totalGrowth >= 0 ? `+${stats.totalGrowth.toFixed(1)}%` : `${stats.totalGrowth.toFixed(1)}%`}
                        </span>
                      )}
                    </div>

                    <div className="relative w-full bg-neutral-50 rounded-xl border border-neutral-200 p-2 overflow-hidden">
                      <svg
                        viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                        className="w-full h-auto overflow-visible"
                      >
                        <defs>
                          <linearGradient id={`growthGrad-${integration.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#000000" stopOpacity="0.08" />
                            <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Guidelines */}
                        <line
                          x1={chartGeometry.padX}
                          y1={chartGeometry.padTop}
                          x2={chartGeometry.width - chartGeometry.padX}
                          y2={chartGeometry.padTop}
                          stroke="#e5e5e5"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1={chartGeometry.padX}
                          y1={chartGeometry.height - chartGeometry.padBottom}
                          x2={chartGeometry.width - chartGeometry.padX}
                          y2={chartGeometry.height - chartGeometry.padBottom}
                          stroke="#d4d4d4"
                        />

                        {/* Area */}
                        <path
                          d={chartGeometry.areaD}
                          fill={`url(#growthGrad-${integration.id})`}
                        />

                        {/* Line */}
                        <path
                          d={chartGeometry.pathD}
                          fill="none"
                          stroke="#000000"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Dots */}
                        {chartGeometry.points.map((pt, i) => (
                          <g 
                            key={i} 
                            onMouseEnter={() => setHoveredPoint(pt)}
                            onMouseLeave={() => setHoveredPoint(null)}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={hoveredPoint?.index === i ? 5.5 : 3.5}
                              fill="#ffffff"
                              stroke="#000000"
                              strokeWidth="2.5"
                              className="transition-all duration-150"
                            />
                          </g>
                        ))}

                        {/* Labels */}
                        <text
                          x={chartGeometry.padX}
                          y={chartGeometry.height - 8}
                          textAnchor="start"
                          fontSize="9"
                          fill="#737373"
                          fontWeight="700"
                        >
                          {formatDate(history[0]?.date)}
                        </text>
                        <text
                          x={chartGeometry.width - chartGeometry.padX}
                          y={chartGeometry.height - 8}
                          textAnchor="end"
                          fontSize="9"
                          fill="#737373"
                          fontWeight="700"
                        >
                          {formatDate(history[history.length - 1]?.date)}
                        </text>
                      </svg>

                      {/* Tooltip */}
                      {hoveredPoint && (
                        <div 
                          className="absolute bg-black text-white text-[10px] font-bold rounded-lg px-2 py-1 shadow-md pointer-events-none z-10 -translate-x-1/2 -translate-y-full"
                          style={{
                            left: `${(hoveredPoint.x / chartGeometry.width) * 100}%`,
                            top: `${(hoveredPoint.y / chartGeometry.height) * 100 - 8}%`
                          }}
                        >
                          <p className="font-extrabold">{formatSubscribersCount(hoveredPoint.item.count)}</p>
                          <p className="text-neutral-400 text-[9px]">
                            {formatDate(hoveredPoint.item.date)}
                            {hoveredPoint.delta !== 0 && (
                              <span className={hoveredPoint.delta > 0 ? ' text-emerald-300 ml-1' : ' text-rose-300 ml-1'}>
                                ({hoveredPoint.delta > 0 ? `+${formatSubscribersCount(hoveredPoint.delta)}` : formatSubscribersCount(hoveredPoint.delta)})
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Stats footer */}
                    <div className="grid grid-cols-3 gap-1 text-center bg-neutral-50 p-2 rounded-xl border border-neutral-200 text-[10px] font-bold">
                      <div>
                        <span className="text-neutral-400 block">{t.audMinLabel || 'Минимум'}</span>
                        <strong className="text-neutral-900" title={stats.minCount?.toLocaleString()}>{formatSubscribersCount(stats.minCount)}</strong>
                      </div>
                      <div className="border-x border-neutral-200">
                        <span className="text-neutral-400 block">{t.audMaxLabel || 'Максимум'}</span>
                        <strong className="text-neutral-900" title={stats.maxCount?.toLocaleString()}>{formatSubscribersCount(stats.maxCount)}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-400 block">{t.audSnapshotsCountLabel || 'Замеров'}</span>
                        <strong className="text-black">{history.length}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center space-y-2">
                    <LineChart className="w-8 h-8 text-neutral-300 mx-auto" />
                    <p className="text-xs text-neutral-500 font-bold">{t.audMin2Required || 'Нужно минимум 2 замера для графика'}</p>
                    {onRefreshSubscribers && (
                      <button
                        type="button"
                        onClick={handleRefreshClick}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-black text-white rounded-lg text-xs font-bold hover:bg-neutral-800 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {t.audRunCheckApi || 'Запустить проверку через API'}
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsFlipped(false)}
                  className="mt-2.5 w-full py-1 text-center text-[11px] font-bold text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                >
                  {t.audBackToLog || '← Вернуться к журналу'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
