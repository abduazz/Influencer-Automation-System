/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar, MessageSquare, Clock, Search } from 'lucide-react';
import { Project, Report } from '../data/mockData';
import { Language, translations } from '../translations';

interface ReportsFeedViewProps {
  projects: Project[];
  reports: Report[];
  lang: Language;
}

export default function ReportsFeedView({ projects, reports, lang }: ReportsFeedViewProps) {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering reports based on search query
  const filteredReports = reports.filter(rep => {
    const resolvedProject = projects.find(p => p.id === rep.projectId);
    const projectName = resolvedProject?.name || '';
    const blogger = rep.channelBlogger || '';
    const destination = rep.destination || '';
    const comments = rep.comments || '';
    const searchLower = searchQuery.toLowerCase();

    return (
      projectName.toLowerCase().includes(searchLower) ||
      blogger.toLowerCase().includes(searchLower) ||
      destination.toLowerCase().includes(searchLower) ||
      comments.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-neutral-900">
      {/* Page Header */}
      <div className="border-b border-neutral-200 pb-5 text-left flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-black tracking-tight">{t.reportsListTab}</h2>
          <p className="text-xs text-neutral-500">
            {lang === 'ru' ? 'Просматривайте и фильтруйте все ранее отправленные финансовые отчеты.' : 
             lang === 'uz' ? 'Ilgari topshirilgan barcha moliyaviy hisobotlarni ko‘rish va filtrlash.' : 
             'Browse and filter all previously submitted financial reports.'}
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-neutral-400" />
          </span>
          <input
            type="text"
            placeholder={lang === 'ru' ? 'Поиск отчетов...' : lang === 'uz' ? 'Hisobotlarni qidirish...' : 'Search reports...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 focus:bg-white rounded-xl text-xs focus:outline-none focus:border-black text-black shadow-3xs transition"
          />
        </div>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.map((rep) => {
          const resolvedProject = projects.find(p => p.id === rep.projectId);
          const isOther = rep.paymentType === 'other';

          return (
            <div
              key={rep.id}
              className="p-5 bg-white border border-neutral-200 rounded-2xl shadow-3xs hover:border-black transition duration-150 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-3 mb-3 pb-3 border-b border-neutral-100">
                  <div className="text-left">
                    <h4 className="font-extrabold text-sm text-black">
                      {isOther ? t.paymentOther : rep.channelBlogger}
                    </h4>
                    <p className="text-[10px] text-neutral-400 font-medium mt-0.5">
                      {t.campaignTitleField}: <span className="text-neutral-700 font-bold">{resolvedProject?.name || '—'}</span>
                    </p>
                    {isOther && (
                      <p className="text-[10px] text-neutral-500 font-medium mt-1">
                        {t.purposeField}: <span className="text-neutral-800 font-bold">{rep.destination}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] bg-neutral-50 font-bold px-2 py-0.5 rounded-md border border-neutral-200 text-neutral-500 flex items-center gap-1 shrink-0">
                    <Calendar className="w-3 h-3 text-neutral-400" /> {rep.date}
                  </span>
                </div>

                {!isOther && (
                  <p className="text-[10px] text-neutral-500 font-medium mb-3 text-left">
                    {t.referralLinkField}: <span className="text-neutral-800 font-bold">{rep.destination}</span>
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 py-1.5 text-[11px] text-left">
                  <div>
                    <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">{t.platformColumn}</span>
                    <span className="font-bold text-neutral-800">
                      {isOther ? '—' : rep.platform}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">
                      {isOther ? t.sumField : `${t.slotsColumn} x ${t.priceColumn}`}
                    </span>
                    <span className="font-bold text-neutral-800">
                      {isOther ? `${rep.totalAmount}` : `${rep.slotsCount} x ${rep.pricePerSlot}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">{t.totalSumColumn}</span>
                    <span className="font-bold text-black">{rep.totalAmount}</span>
                  </div>
                </div>

                {rep.comments && (
                  <div className="text-[11px] text-neutral-600 bg-neutral-50 p-3 rounded-xl flex items-start gap-2 border border-neutral-150 mt-3 text-left">
                    <MessageSquare className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
                    <p className="italic">"{rep.comments}"</p>
                  </div>
                )}
              </div>

              {rep.receipt && (
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                  <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                    {lang === 'ru' ? 'Чек / Скриншот:' : lang === 'uz' ? 'Chek / Skrinshot:' : 'Receipt / Screenshot:'}
                  </span>
                  <a 
                    href={rep.receipt} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[9px] font-black text-blue-600 hover:text-blue-800 hover:underline uppercase flex items-center gap-1 cursor-pointer"
                  >
                    {lang === 'ru' ? 'Открыть ↗' : lang === 'uz' ? 'Ochish ↗' : 'Open ↗'}
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredReports.length === 0 && (
        <div className="p-12 text-center bg-white border border-dashed border-neutral-200 rounded-2xl max-w-md mx-auto">
          <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-extrabold text-neutral-600">{t.noReportsTitle}</p>
          <p className="text-xs text-neutral-400 mt-1">
            {lang === 'ru' ? 'Отчеты не найдены. Попробуйте изменить параметры поиска.' : 
             lang === 'uz' ? 'Hisobotlar topilmadi. Qidiruv parametrlarini o‘zgartirib ko‘ring.' : 
             'No reports matching search query were found.'}
          </p>
        </div>
      )}
    </div>
  );
}
