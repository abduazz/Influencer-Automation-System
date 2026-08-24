/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LogEntry, fetchLogs, clearLogs } from '../services/api';
import { Language, translations } from '../translations';
import { Terminal, RefreshCw, Trash2, Search, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';

interface LogsViewProps {
  lang: Language;
}

export default function LogsView({ lang }: LogsViewProps) {
  const t = translations[lang];
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLogs();
      setLogs(data);
    } catch (err) {
      setError(lang === 'ru' ? 'Не удалось загрузить логи.' : 'Failed to load logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleClear = async () => {
    const confirmMsg = lang === 'ru' 
      ? 'Вы уверены, что хотите очистить файл логов?' 
      : 'Are you sure you want to clear the log file?';
    if (!confirm(confirmMsg)) return;

    try {
      await clearLogs();
      setLogs([]);
      setExpandedIndex(null);
    } catch (err) {
      alert(lang === 'ru' ? 'Не удалось очистить логи.' : 'Failed to clear logs.');
    }
  };

  // Filter logic
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(search.toLowerCase()) || 
                          log.timestamp.includes(search);
    const matchesLevel = selectedLevel === 'ALL' || log.level === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'WARNING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DEBUG':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-neutral-50 text-neutral-600 border-neutral-200';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-5 text-left">
        <div>
          <h2 className="text-xl font-black text-black tracking-tight flex items-center gap-2">
            <Terminal className="w-5 h-5 text-black" />
            {lang === 'ru' ? 'Системные логи' : 'System Logs'}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {lang === 'ru' 
              ? 'Просмотр системных логов, ошибок и отладочной информации из laravel.log.' 
              : 'Inspect system logs, runtime errors, and diagnostic data from laravel.log.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {lang === 'ru' ? 'Обновить' : 'Refresh'}
          </button>
          <button
            onClick={handleClear}
            disabled={loading || logs.length === 0}
            className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {lang === 'ru' ? 'Очистить' : 'Clear Logs'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-bold text-left">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'ru' ? 'Поиск по логам...' : 'Search logs...'}
            className="w-full bg-white border border-neutral-200 focus:border-black rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-black focus:outline-hidden transition"
          />
        </div>

        <div className="flex gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 shrink-0">
          {['ALL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => {
                setSelectedLevel(lvl);
                setExpandedIndex(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition ${
                selectedLevel === lvl
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal logs list */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm text-left">
        <div className="bg-neutral-950 px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between text-[10px] font-bold font-mono text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
            <span className="ml-2 font-bold uppercase tracking-wider">laravel.log</span>
          </div>
          <div>
            {filteredLogs.length} {lang === 'ru' ? 'записей' : 'entries'}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-neutral-500 text-xs font-mono font-bold flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            {lang === 'ru' ? 'Загрузка...' : 'Loading logs...'}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 text-xs font-mono font-bold">
            {lang === 'ru' ? 'Логи не найдены.' : 'No log entries found.'}
          </div>
        ) : (
          <div className="divide-y divide-neutral-800 max-h-[600px] overflow-y-auto font-mono text-[11px] leading-relaxed text-neutral-300">
            {filteredLogs.map((log, index) => {
              const isExpanded = expandedIndex === index;
              
              // Extract the first line of the message for the header preview
              const firstLine = log.message.split("\n")[0];
              const hasStacktrace = log.message.includes("\n");

              return (
                <div key={index} className="hover:bg-neutral-850/40 transition">
                  {/* Log Header row */}
                  <div
                    onClick={() => hasStacktrace && setExpandedIndex(isExpanded ? null : index)}
                    className={`flex items-start gap-3 p-3 cursor-pointer select-none ${
                      hasStacktrace ? 'hover:text-white' : 'cursor-default'
                    }`}
                  >
                    {/* Expand icon */}
                    <div className="w-4 h-4 shrink-0 flex items-center justify-center text-neutral-500">
                      {hasStacktrace && (
                        isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-[10px] text-neutral-500 shrink-0 font-bold">
                      {log.timestamp || '—'}
                    </div>

                    {/* Level badge */}
                    <div className={`px-2 py-0.2 rounded border text-[9px] font-bold shrink-0 flex items-center gap-1 ${getLevelBadgeColor(log.level)}`}>
                      {getLevelIcon(log.level)}
                      <span>{log.level}</span>
                    </div>

                    {/* Log content preview */}
                    <div className="flex-1 min-w-0 font-medium break-all">
                      {firstLine}
                    </div>
                  </div>

                  {/* Expanded multi-line stacktrace/details */}
                  {isExpanded && (
                    <div className="px-10 pb-4 pt-1 bg-neutral-950/80 border-t border-neutral-850/50 text-[10px] text-neutral-400 whitespace-pre-wrap break-all overflow-x-auto leading-relaxed">
                      {log.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
