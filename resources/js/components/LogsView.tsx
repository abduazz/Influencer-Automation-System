/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Language } from '../translations';
import { 
  ScrollText, 
  RefreshCw, 
  ExternalLink, 
  Maximize2, 
  Minimize2, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface LogsViewProps {
  lang: Language;
}

export default function LogsView({ lang }: LogsViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(1);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    setIsIframeLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-neutral-900 p-4 overflow-hidden' : ''}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4 text-left bg-white rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
            <ScrollText className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-black tracking-tight">
                Log Viewer
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-800 border border-neutral-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                {lang === 'uz' ? 'Faqat Super Admin' : lang === 'ru' ? 'Только Super Admin' : 'Super Admin Only'}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              {lang === 'ru' 
                ? 'Полный просмотр логов, ошибок, уровней и стектрейсов через opcodesio/log-viewer' 
                : lang === 'uz'
                ? 'Tizim xatoliklari, server loglari va nosozliklarni tahlil qilish (opcodesio/log-viewer)'
                : 'Inspect runtime errors, diagnostic data, and application logs'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Open in New Window */}
          <a
            href="/log-viewer"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            title={lang === 'uz' ? 'Yangi oynada ochish' : lang === 'ru' ? 'Открыть в новой вкладке' : 'Open in new tab'}
          >
            <ExternalLink className="w-3.5 h-3.5 text-neutral-600" />
            <span className="hidden sm:inline">
              {lang === 'uz' ? 'Yangi oyna' : lang === 'ru' ? 'В новом окne' : 'Open New Tab'}
            </span>
          </a>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title={lang === 'ru' ? 'Обновить' : lang === 'uz' ? 'Yangilash' : 'Refresh'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isIframeLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {lang === 'uz' ? 'Yangilash' : lang === 'ru' ? 'Обновить' : 'Refresh'}
            </span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{lang === 'uz' ? 'Chiqish' : 'Exit'}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{lang === 'uz' ? 'To\'liq ekran' : 'Fullscreen'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Embedded Log Viewer Container */}
      <div className={`relative bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
        isFullscreen ? 'h-[calc(100vh-130px)]' : 'h-[calc(100vh-220px)] min-h-[700px]'
      }`}>
        {isIframeLoading && (
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-bold text-neutral-600">
            <RefreshCw className="w-4 h-4 animate-spin text-black" />
            <span>{lang === 'uz' ? 'Log Viewer yuklanmoqda...' : 'Loading Log Viewer...'}</span>
          </div>
        )}

        <iframe
          key={iframeKey}
          ref={iframeRef}
          src="/log-viewer"
          title="Laravel Log Viewer"
          className="w-full h-full border-0 bg-white"
          onLoad={() => setIsIframeLoading(false)}
        />
      </div>
    </div>
  );
}
