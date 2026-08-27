import React, { useState } from 'react';
import { Calendar, MessageSquare, Clock, Search, Trash2, X, ExternalLink, Link, LayoutGrid, Table, FileText, FileSpreadsheet } from 'lucide-react';
import { Project, Report, Integration } from '../data/mockData';
import { Language, translations } from '../translations';

interface ReportsFeedViewProps {
  projects: Project[];
  integrations: Integration[];
  reports: Report[];
  lang: Language;
  userRole?: string | null;
  onDeleteReport?: (id: string) => void;
  title?: string;
  description?: string;
}

export default function ReportsFeedView({ projects, integrations, reports, lang, userRole, onDeleteReport, title, description }: ReportsFeedViewProps) {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    const saved = localStorage.getItem('reports_feed_view_mode');
    return (saved === 'grid' || saved === 'table') ? saved : 'table';
  });

  const toggleViewMode = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('reports_feed_view_mode', mode);
  };

  const handleExportExcel = () => {
    const hasOther = filteredReports.some(r => r.paymentType === 'other');
    let headers: string[] = [];
    let rows: string[][] = [];

    if (hasOther) {
      // Other expenses columns
      headers = [
        '№',
        lang === 'ru' ? 'Назначение' : lang === 'uz' ? 'Vazifasi' : 'Purpose / Destination',
        lang === 'ru' ? 'Получатель / Расход' : lang === 'uz' ? 'Qabul qiluvchi / Xarajat' : 'Recipient / Expense Type',
        lang === 'ru' ? 'Платформа' : lang === 'uz' ? 'Platforma' : 'Platform',
        lang === 'ru' ? 'Сумма (UZS)' : lang === 'uz' ? 'Summa (UZS)' : 'Amount (UZS)',
        lang === 'ru' ? 'Дата' : lang === 'uz' ? 'Sana' : 'Date',
        lang === 'ru' ? 'Комментарии' : lang === 'uz' ? 'Izohlar' : 'Comments',
        lang === 'ru' ? 'Проект' : lang === 'uz' ? 'Loyiha' : 'Project',
        lang === 'ru' ? 'Создан кем' : lang === 'uz' ? 'Kim tomonidan' : 'Created By'
      ];

      rows = filteredReports.map((rep, idx) => {
        const resolvedProject = projects.find(p => String(p.id) === String(rep.projectId));
        const projName = resolvedProject ? resolvedProject.name : '—';
        return [
          String(idx + 1),
          rep.destination || '—',
          rep.channelBlogger || '—',
          '—',
          String(rep.totalAmount || 0),
          rep.date,
          rep.comments || '',
          projName,
          rep.createdBy || ''
        ];
      });
    } else {
      // Blogger integrations columns
      headers = [
        '№',
        lang === 'ru' ? 'Назначение / Реф. ссылка' : lang === 'uz' ? 'Vazifasi / Referal havola' : 'Purpose / Referral Link',
        lang === 'ru' ? 'Канал / Блогер' : lang === 'uz' ? 'Kanal / Blogger' : 'Channel / Blogger',
        lang === 'ru' ? 'Платформа' : lang === 'uz' ? 'Platforma' : 'Platform',
        lang === 'ru' ? 'Сумма (UZS)' : lang === 'uz' ? 'Jami summa (UZS)' : 'Total Amount (UZS)',
        lang === 'ru' ? 'Дата отчета' : lang === 'uz' ? 'Hisobot sanasi' : 'Report Date',
        lang === 'ru' ? 'Комментарии' : lang === 'uz' ? 'Izohlar' : 'Comments',
        lang === 'ru' ? 'Проект' : lang === 'uz' ? 'Loyiha' : 'Project',
        lang === 'ru' ? 'Тип оплаты' : lang === 'uz' ? 'To\'lov turi' : 'Payment Type',
        lang === 'ru' ? 'Всего слотов' : lang === 'uz' ? 'Jami slotlar' : 'Total Slots',
        lang === 'ru' ? 'Оплачено слотов' : lang === 'uz' ? 'To\'langan slotlar' : 'Paid Slots',
        lang === 'ru' ? 'Цена за слот (UZS)' : lang === 'uz' ? 'Slot narxi (UZS)' : 'Price per Slot (UZS)',
        lang === 'ru' ? 'Оплачено (UZS)' : lang === 'uz' ? 'To\'langan summa (UZS)' : 'Paid Amount (UZS)',
        lang === 'ru' ? 'Создан кем' : lang === 'uz' ? 'Kim tomonidan' : 'Created By',
        lang === 'ru' ? 'Ссылка на кабинет' : lang === 'uz' ? 'Kabinet havolasi' : 'Cabinet Link'
      ];

      rows = filteredReports.map((rep, idx) => {
        let projName = '—';
        if (rep.projectId) {
          const p = projects.find(proj => String(proj.id) === String(rep.projectId));
          projName = p ? p.name : '—';
        } else if (rep.slotsConfig && rep.slotsConfig.length > 0) {
          const counts: { [name: string]: number } = {};
          rep.slotsConfig.forEach((s) => {
            if (s.projectId) {
              const p = projects.find(proj => String(proj.id) === String(s.projectId));
              const name = p ? p.name : `Proj #${s.projectId}`;
              counts[name] = (counts[name] || 0) + 1;
            }
          });
          projName = Object.entries(counts).map(([name, cnt]) => `${name}: ${cnt}`).join(', ');
        }

        const isOther = rep.paymentType === 'other';
        const paymentTypeText = rep.paymentType === 'prepaid' ? (lang === 'ru' ? 'Предоплата' : lang === 'uz' ? 'Bo\'nak' : 'Prepayment')
          : rep.paymentType === 'full' ? (lang === 'ru' ? 'Полная оплата' : lang === 'uz' ? 'To\'liq to\'lov' : 'Full Payment')
          : rep.paymentType === 'remaining' ? (lang === 'ru' ? 'Доплата' : lang === 'uz' ? 'Qoldiq to\'lov' : 'Remaining Pay')
          : (lang === 'ru' ? 'Прочее' : lang === 'uz' ? 'Boshqa' : 'Other');

        const matchingInt = isOther ? null : (
          integrations.find(i => 
            String(i.projectId) === String(rep.projectId) &&
            i.bloggerName.toLowerCase() === rep.channelBlogger?.toLowerCase() &&
            i.platform.toLowerCase() === rep.platform?.toLowerCase()
          ) || integrations.find(i => 
            i.bloggerName.toLowerCase() === rep.channelBlogger?.toLowerCase()
          )
        );
        const token = matchingInt?.bloggerCabinetToken || matchingInt?.id;
        const cabinetUrl = token ? `${window.location.origin}/c/${token}` : '';

        return [
          String(idx + 1),
          rep.destination || '—',
          rep.channelBlogger || '—',
          rep.platform || '—',
          String(rep.totalAmount || 0),
          rep.date,
          rep.comments || '',
          projName,
          paymentTypeText,
          String(rep.slotsCount || 0),
          String(rep.paidSlotsCount || 0),
          String(rep.pricePerSlot || 0),
          String(rep.paidAmount || 0),
          rep.createdBy || '—',
          cabinetUrl || '—'
        ];
      });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const fileTitle = hasOther ? `Other_Expenses_Report_${dateStr}` : `Blogger_Integrations_Report_${dateStr}`;

    const excelContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Sheet1</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Nunito', Arial, sans-serif; font-size: 11pt; }
          table { border-collapse: collapse; width: 100%; }
          th { font-weight: bold; border: 1px solid #D1D5DB; padding: 8px; text-align: left; font-size: 11pt; color: #000000; }
          td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; font-size: 11pt; color: #000000; }
          .currency { text-align: right; mso-number-format: "#,##0"; }
          .number { text-align: center; mso-number-format: "0"; }
          .date { mso-number-format: "yyyy-mm-dd"; text-align: center; }
          .title-row { font-size: 14pt; font-weight: bold; color: #000000; padding-bottom: 12px; }
        </style>
      </head>
      <body>
        <div class="title-row">${hasOther ? (lang === 'ru' ? 'Отчет по прочим расходам' : lang === 'uz' ? 'Boshqa xarajatlar hisoboti' : 'Other Expenses Report') : (lang === 'ru' ? 'Отчет по интеграциям с блогерами' : lang === 'uz' ? 'Blogger integratsiyalari hisoboti' : 'Blogger Integrations Report')} (${dateStr})</div>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map((cell, idx) => {
                  let cellClass = '';
                  let formattedCell = cell;

                  if (hasOther) {
                    if (idx === 0) {
                      cellClass = 'class="number"';
                      formattedCell = Number(cell) || 0;
                    }
                    if (idx === 4) {
                      cellClass = 'class="currency"';
                      formattedCell = Number(cell) || 0;
                    }
                    if (idx === 5) {
                      cellClass = 'class="date"';
                    }
                  } else {
                    if (idx === 0 || idx === 9 || idx === 10) {
                      cellClass = 'class="number"';
                      formattedCell = Number(cell) || 0;
                    }
                    if (idx === 4 || idx === 11 || idx === 12) {
                      cellClass = 'class="currency"';
                      formattedCell = Number(cell) || 0;
                    }
                    if (idx === 5) {
                      cellClass = 'class="date"';
                    }
                  }

                  const safeVal = typeof formattedCell === 'string' 
                    ? formattedCell.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") 
                    : formattedCell;
                  return `<td ${cellClass}>${safeVal}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileTitle}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering reports based on search query and date period
  const filteredReports = reports.filter(rep => {
    const resolvedProject = projects.find(p => String(p.id) === String(rep.projectId));
    const multiProjectNames = rep.slotsConfig
      ? rep.slotsConfig.map(s => s.projectId ? projects.find(p => String(p.id) === String(s.projectId))?.name : '').filter(Boolean).join(' ')
      : '';
    const projectName = (resolvedProject?.name || '') + ' ' + multiProjectNames;
    const blogger = rep.channelBlogger || '';
    const destination = rep.destination || '';
    const comments = rep.comments || '';
    const searchLower = searchQuery.toLowerCase();

    const matchesSearch = (
      projectName.toLowerCase().includes(searchLower) ||
      blogger.toLowerCase().includes(searchLower) ||
      destination.toLowerCase().includes(searchLower) ||
      comments.toLowerCase().includes(searchLower)
    );

    const matchesDate = (!filterStartDate || rep.date >= filterStartDate) &&
                        (!filterEndDate || rep.date <= filterEndDate);

    return matchesSearch && matchesDate;
  });

  const renderProjectCell = (rep: Report) => {
    if (rep.projectId) {
      const p = projects.find(proj => String(proj.id) === String(rep.projectId));
      return p ? p.name : '—';
    }

    if (rep.slotsConfig && rep.slotsConfig.length > 0) {
      const counts: { [name: string]: number } = {};
      let reserve = 0;

      rep.slotsConfig.forEach((s) => {
        if (s.projectId) {
          const p = projects.find(proj => String(proj.id) === String(s.projectId));
          const name = p ? p.name : `Proj #${s.projectId}`;
          counts[name] = (counts[name] || 0) + 1;
        } else {
          reserve++;
        }
      });

      const entries = Object.entries(counts);
      if (entries.length > 0 || reserve > 0) {
        return (
          <div className="flex flex-wrap gap-1 items-center">
            {entries.map(([pName, cnt]) => (
              <span key={pName} className="px-1.5 py-0.5 text-[9px] font-bold bg-neutral-100 border border-neutral-200 rounded text-neutral-800">
                {pName}: {cnt}
              </span>
            ))}
            {reserve > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 border border-amber-200 rounded text-amber-800">
                {lang === 'ru' ? 'Резерв' : lang === 'uz' ? 'Zahira' : 'Reserve'}: {reserve}
              </span>
            )}
          </div>
        );
      }
    }

    return '—';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-neutral-900">
      {/* Page Header */}
      <div className="border-b border-neutral-200 pb-5 text-left flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Search Bar & View Toggle */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
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

          {/* Date range filters */}
          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-xl border border-neutral-200 text-xs text-neutral-600 shadow-3xs shrink-0">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider hidden lg:inline">
              {lang === 'ru' ? 'Период:' : lang === 'uz' ? 'Davr:' : 'Period:'}
            </span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="bg-transparent border-none p-0 text-[11px] font-medium w-[95px] text-neutral-700 focus:outline-none"
              title={t.startDateColumn}
            />
            <span className="text-neutral-300 select-none text-[10px]">—</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="bg-transparent border-none p-0 text-[11px] font-medium w-[95px] text-neutral-700 focus:outline-none"
              title={t.endDateColumn}
            />
            {(filterStartDate || filterEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setFilterStartDate('');
                  setFilterEndDate('');
                }}
                className="p-0.5 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-black transition cursor-pointer shrink-0"
                title={lang === 'ru' ? 'Сбросить даты' : lang === 'uz' ? 'Sanalarni tozalash' : 'Clear dates'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Export to Excel Button */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 hover:text-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer shadow-3xs hover:shadow-2xs shrink-0"
            title={t.exportExcel}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{t.exportExcel}</span>
          </button>

          <div className="hidden md:flex bg-neutral-100 p-0.5 rounded-xl border border-neutral-200 shrink-0">
            <button
              onClick={() => toggleViewMode('table')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-black shadow-3xs border border-neutral-200'
                  : 'text-neutral-500 hover:text-black'
              }`}
              title={t.viewTable}
            >
              <Table className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleViewMode('grid')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-black shadow-3xs border border-neutral-200'
                  : 'text-neutral-500 hover:text-black'
              }`}
              title={t.viewGrid}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Table of Reports (Desktop only when viewMode is table) */}
      {viewMode === 'table' && filteredReports.length > 0 && (
        <div className="hidden md:block overflow-hidden bg-white border border-neutral-200 rounded-2xl shadow-3xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold text-neutral-500 uppercase tracking-wider select-none">
                  <th className="px-5 py-3 font-extrabold">{t.reportDateField}</th>
                  <th className="px-5 py-3 font-extrabold">{t.campaignTitleField}</th>
                  <th className="px-5 py-3 font-extrabold">{t.tableHeaderBlogger}</th>
                  <th className="px-5 py-3 font-extrabold">{t.platformColumn}</th>
                  <th className="px-5 py-3 font-extrabold">{t.tableHeaderDetails}</th>
                  <th className="px-5 py-3 font-extrabold">{t.createdByField}</th>
                  <th className="px-5 py-3 font-extrabold text-right">{t.totalSumColumn}</th>
                  <th className="px-5 py-3 text-center font-extrabold">{t.tableHeaderReceipt}</th>
                  {userRole !== 'executive' && (
                    <th className="px-5 py-3 text-center font-extrabold">{t.tableHeaderCabinet}</th>
                  )}
                  {onDeleteReport && (
                    <th className="px-5 py-3 text-center font-extrabold">{t.tableHeaderActions}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {filteredReports.map((rep) => {
                  const resolvedProject = projects.find(p => p.id === rep.projectId);
                  const isOther = rep.paymentType === 'other';

                  // Match report to integration for blogger link lookup
                  const matchingInt = isOther ? null : (
                    integrations.find(i => 
                      i.projectId === rep.projectId &&
                      i.bloggerName.toLowerCase() === rep.channelBlogger?.toLowerCase() &&
                      i.platform.toLowerCase() === rep.platform?.toLowerCase()
                    ) || integrations.find(i => 
                      i.bloggerName.toLowerCase() === rep.channelBlogger?.toLowerCase()
                    )
                  );

                  const token = matchingInt?.bloggerCabinetToken || matchingInt?.id;
                  const cabinetUrl = token ? `${window.location.origin}/c/${token}` : '';

                  // Platform Badge Colors
                  let platformBadgeClass = "bg-neutral-50 text-neutral-600 border-neutral-200";
                  if (rep.platform === 'Telegram') {
                    platformBadgeClass = "bg-blue-50 text-blue-600 border-blue-100";
                  } else if (rep.platform === 'Instagram') {
                    platformBadgeClass = "bg-pink-50 text-pink-600 border-pink-100";
                  } else if (rep.platform === 'YouTube') {
                    platformBadgeClass = "bg-red-50 text-red-600 border-red-100";
                  }

                  return (
                    <tr
                      key={rep.id}
                      onClick={() => setSelectedReport(rep)}
                      className="hover:bg-neutral-50/80 transition-colors duration-150 cursor-pointer group"
                    >
                      {/* Date */}
                      <td className="px-5 py-4 whitespace-nowrap text-neutral-500 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          {rep.date}
                        </span>
                      </td>

                      {/* Project */}
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-neutral-700">
                        {renderProjectCell(rep)}
                      </td>

                      {/* Blogger / Expense */}
                      <td className="px-5 py-4 whitespace-nowrap font-extrabold text-black uppercase tracking-tight">
                        {isOther ? t.paymentOther : rep.channelBlogger}
                      </td>

                      {/* Platform */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isOther ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${platformBadgeClass}`}>
                            {rep.platform}
                          </span>
                        )}
                      </td>

                      {/* Details / Slots */}
                      <td className="px-5 py-4 max-w-xs truncate text-neutral-600 font-medium">
                        {isOther ? (
                          <span className="italic text-neutral-500">{rep.destination}</span>
                        ) : (
                          <span>
                            {rep.slotsCount} slots × {Number(rep.pricePerSlot).toLocaleString('ru-RU')}
                          </span>
                        )}
                      </td>

                      {/* Created By */}
                      <td className="px-5 py-4 whitespace-nowrap text-neutral-500 font-medium">
                        {rep.createdBy || '—'}
                      </td>

                      {/* Total Sum */}
                      <td className="px-5 py-4 whitespace-nowrap text-right font-black text-black">
                        {Number(rep.totalAmount).toLocaleString('ru-RU')} UZS
                      </td>

                      {/* Receipt */}
                      <td className="px-5 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        {rep.receipt ? (
                          <button
                            onClick={() => setSelectedReport(rep)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-md transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{lang === 'ru' ? 'Чек' : lang === 'uz' ? 'Chek' : 'View'}</span>
                          </button>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>

                      {/* Cabinet (Hidden for executive role) */}
                      {userRole !== 'executive' && (
                        <td className="px-5 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          {cabinetUrl ? (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(cabinetUrl);
                                alert(lang === 'ru' ? 'Ссылка кабинета скопирована!' : lang === 'uz' ? 'Kabinet havolasi nusxalandi!' : 'Cabinet link copied!');
                              }}
                              className="inline-flex items-center justify-center p-1.5 text-black hover:bg-neutral-100 border border-neutral-200 rounded-lg transition shadow-2xs cursor-pointer"
                              title={lang === 'ru' ? 'Копировать ссылку' : lang === 'uz' ? 'Havolani nusxalash' : 'Copy cabinet link'}
                            >
                              <Link className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                      )}

                      {/* Actions */}
                      {onDeleteReport && (
                        <td className="px-5 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onDeleteReport(rep.id)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                            title={lang === 'ru' ? 'Удалить отчет' : lang === 'uz' ? 'Hisobotni o\'chirish' : 'Delete report'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid of Report Cards (Visible on mobile, or when viewMode is grid) */}
      <div className={`${viewMode === 'table' ? 'md:hidden' : ''} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`}>
        {filteredReports.map((rep) => {
          const resolvedProject = projects.find(p => p.id === rep.projectId);
          const isOther = rep.paymentType === 'other';

          // Match report to integration for blogger link lookup
          const matchingInt = isOther ? null : (
            integrations.find(i => 
              i.projectId === rep.projectId &&
              i.bloggerName.toLowerCase() === rep.channelBlogger?.toLowerCase() &&
              i.platform.toLowerCase() === rep.platform?.toLowerCase()
            ) || integrations.find(i => 
              i.bloggerName.toLowerCase() === rep.channelBlogger?.toLowerCase()
            )
          );

          const token = matchingInt?.bloggerCabinetToken || matchingInt?.id;
          const cabinetUrl = token ? `${window.location.origin}/c/${token}` : '';

          return (
            <div
              key={rep.id}
              onClick={() => setSelectedReport(rep)}
              className="p-4 bg-white border border-neutral-200 rounded-xl shadow-3xs hover:border-black cursor-pointer transition duration-150 flex flex-col justify-between group"
            >
              <div>
                <div className="flex justify-between items-start gap-2.5 mb-2.5 pb-2.5 border-b border-neutral-100">
                  <div className="text-left">
                    <h4 className="font-extrabold text-xs text-black uppercase tracking-tight group-hover:text-neutral-600 transition">
                      {isOther ? t.paymentOther : rep.channelBlogger}
                    </h4>
                    <div className="text-[9px] text-neutral-400 font-medium mt-0.5 flex items-center gap-1">
                      <span>{t.campaignTitleField}:</span> <div className="text-neutral-700 font-bold">{renderProjectCell(rep)}</div>
                    </div>
                    {rep.createdBy && (
                      <p className="text-[9px] text-neutral-400 font-medium mt-0.5">
                        {t.createdByField}: <span className="text-neutral-700 font-bold">{rep.createdBy}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8px] bg-neutral-50 font-black px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-neutral-400" /> {rep.date}
                    </span>
                    {onDeleteReport && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteReport(rep.id);
                        }}
                        title={lang === 'ru' ? 'Удалить отчет' : lang === 'uz' ? 'Hisobotni o\'chirish' : 'Delete report'}
                        className="p-1 rounded text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors duration-150 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 py-1 text-[10px] text-left border border-neutral-100 rounded-lg p-2 bg-neutral-50/50">
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
                      {isOther ? `${Number(rep.totalAmount).toLocaleString('ru-RU')}` : `${rep.slotsCount} x ${Number(rep.pricePerSlot).toLocaleString('ru-RU')}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">{t.totalSumColumn}</span>
                    <span className="font-bold text-black">{Number(rep.totalAmount).toLocaleString('ru-RU')}</span>
                  </div>
                </div>

                {/* Compact screenshot indicator if present */}
                {rep.receipt && (
                  <div className="mt-2.5 text-[9px] text-neutral-400 font-bold flex items-center gap-1 uppercase">
                    <span>🖼️ {lang === 'ru' ? 'Скриншот прикреплен' : lang === 'uz' ? 'Skrinshot biriktirilgan' : 'Screenshot Attached'}</span>
                  </div>
                )}

                {/* Blogger Cabinet Link Section (Hidden for executive role) */}
                {userRole !== 'executive' && cabinetUrl && (
                  <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between gap-2">
                    <span className="text-[9px] text-neutral-400 font-extrabold uppercase tracking-wide">
                      {lang === 'ru' ? 'Линк блогера:' : lang === 'uz' ? 'Blogger havolasi:' : 'Cabinet Link:'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(cabinetUrl);
                        alert(lang === 'ru' ? 'Ссылка кабинета скопирована!' : lang === 'uz' ? 'Kabinet havolasi nusxalandi!' : 'Cabinet link copied!');
                      }}
                      className="text-[9px] font-black text-black hover:underline flex items-center gap-1 cursor-pointer bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded px-2 py-1 transition"
                    >
                      <Link className="w-2.5 h-2.5 text-black" />
                      <span>{lang === 'ru' ? 'Копировать' : lang === 'uz' ? 'Nusxalash' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>
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

      {/* Detailed Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all duration-200 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] text-left border border-neutral-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <div>
                <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">
                  {lang === 'ru' ? 'Детали отчета' : lang === 'uz' ? 'Hisobot tafsilotlari' : 'Report Details'}
                </span>
                <span className="font-extrabold text-[13px] text-black uppercase tracking-tight">
                  {selectedReport.paymentType === 'other' ? t.paymentOther : selectedReport.channelBlogger}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-1 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-black transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Main Fields Grid */}
              <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200/50">
                <div>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">{t.campaignTitleField}</p>
                  <p className="font-bold text-neutral-800 mt-0.5">
                    {projects.find(p => p.id === selectedReport.projectId)?.name || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">{t.reportDateField}</p>
                  <p className="font-bold text-neutral-800 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" /> {selectedReport.date}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">{t.platformColumn}</p>
                  <p className="font-bold text-neutral-800 mt-0.5">
                    {selectedReport.paymentType === 'other' ? '—' : selectedReport.platform}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">{t.paymentTypeLabel}</p>
                  <p className="font-bold text-neutral-800 mt-0.5 uppercase text-[10px]">
                    {selectedReport.paymentType === 'prepaid' ? t.paymentPrepaid : 
                     selectedReport.paymentType === 'full' ? t.paymentFull : 
                     t.paymentOther}
                  </p>
                </div>
                {selectedReport.createdBy && (
                  <div className="col-span-2 border-t border-neutral-200/60 pt-2">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">{t.createdByField}</p>
                    <p className="font-bold text-neutral-800 mt-0.5">
                      {selectedReport.createdBy}
                    </p>
                  </div>
                )}
              </div>

              {/* Financial calculations */}
              <div className="border border-neutral-100 rounded-xl p-4 space-y-2.5">
                <h4 className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider border-b border-neutral-50 pb-1.5">
                  {lang === 'ru' ? 'Финансовые показатели' : lang === 'uz' ? 'Moliyaviy ko‘rsatkichlar' : 'Financials'}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {selectedReport.paymentType !== 'other' && (
                    <>
                      <div className="flex justify-between py-0.5">
                        <span className="text-neutral-500">{lang === 'ru' ? 'Всего слотов' : lang === 'uz' ? 'Jami slotlar' : 'Total Slots'}:</span>
                        <span className="font-bold text-neutral-800">{selectedReport.slotsCount}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-neutral-500">{lang === 'ru' ? 'Цена за слот' : lang === 'uz' ? 'Slot narxi' : 'Price per Slot'}:</span>
                        <span className="font-bold text-neutral-800">{Number(selectedReport.pricePerSlot).toLocaleString('ru-RU')} UZS</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-t border-neutral-50 pt-1.5">
                        <span className="text-neutral-500">{t.prepaidLabel}:</span>
                        <span className="font-bold text-neutral-800">{selectedReport.paidSlotsCount} slot(s)</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-neutral-500">{lang === 'ru' ? 'Оплачено' : lang === 'uz' ? 'To‘langan' : 'Paid Amount'}:</span>
                        <span className="font-extrabold text-emerald-600">{(Number(selectedReport.paidSlotsCount) * Number(selectedReport.pricePerSlot)).toLocaleString('ru-RU')} UZS</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between py-0.5 border-t border-neutral-50 pt-1.5 col-span-2 text-sm border-t border-neutral-150 pt-2">
                    <span className="font-bold text-black">{t.totalSumColumn}:</span>
                    <span className="font-black text-black">{Number(selectedReport.totalAmount).toLocaleString('ru-RU')} UZS</span>
                  </div>
                </div>
              </div>

              {/* Destination/Purpose */}
              <div className="space-y-1 text-left">
                <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">
                  {t.purposeField}
                </p>
                <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 font-bold text-black">
                  {selectedReport.paymentType === 'other' 
                    ? selectedReport.destination 
                    : `${selectedReport.platform} блогер интеграция`}
                </div>
              </div>

              {/* Referral Link (only for blogger integrations) */}
              {selectedReport.paymentType !== 'other' && selectedReport.destination && (
                <div className="space-y-1 text-left">
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">
                    {lang === 'ru' ? 'Реферальная ссылка' : lang === 'uz' ? 'Referral havolasi' : 'Referral Link'}
                  </p>
                  <div className="flex items-center gap-2 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                    <span className="font-mono text-black font-bold break-all flex-1 select-all">{selectedReport.destination}</span>
                    {selectedReport.destination.startsWith('http') && (
                      <a
                        href={selectedReport.destination}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 bg-white hover:bg-neutral-100 rounded border border-neutral-200 text-neutral-600 transition shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Comments */}
              {selectedReport.comments && (
                <div className="space-y-1 text-left">
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">
                    {lang === 'ru' ? 'Комментарии к отчету' : lang === 'uz' ? 'Hisobot izohlari' : 'Comments'}
                  </p>
                  <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100 text-neutral-700 italic leading-relaxed">
                    "{selectedReport.comments}"
                  </div>
                </div>
              )}

              {/* Screenshot/Receipt */}
              {selectedReport.receipt && (
                <div className="space-y-1.5 text-left border-t border-neutral-100 pt-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">
                      {lang === 'ru' ? 'Чек / Скриншот' : lang === 'uz' ? 'Chek / Skrinshot' : 'Receipt / Screenshot'}
                    </p>
                    {selectedReport.receipt.startsWith('http') && (
                      <a
                        href={selectedReport.receipt}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-blue-600 hover:underline uppercase flex items-center gap-0.5"
                      >
                        {lang === 'ru' ? 'Открыть оригинал' : lang === 'uz' ? 'Originalini ochish' : 'Open Original'} ↗
                      </a>
                    )}
                  </div>

                  <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50 flex items-center justify-center p-2 max-h-64">
                    {selectedReport.receipt.startsWith('data:image/') ? (
                      <img 
                        src={selectedReport.receipt} 
                        alt="Receipt proof" 
                        className="max-w-full max-h-60 object-contain rounded cursor-pointer hover:opacity-95" 
                        onClick={() => {
                          const w = window.open();
                          if (w) w.document.write(`<img src="${selectedReport.receipt}" style="max-width:100%; height:auto;" />`);
                        }}
                      />
                    ) : (
                      <div className="py-6 text-center text-neutral-500 font-medium">
                        <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-1.5" />
                        <p>{lang === 'ru' ? 'Прикрепленный документ (PDF/Файл)' : lang === 'uz' ? 'Biriktirilgan hujjat (PDF/Fayl)' : 'Attached Document (PDF/File)'}</p>
                        <a href={selectedReport.receipt} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline mt-1 block">
                          Download/View File
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold text-xs rounded-lg transition cursor-pointer"
              >
                {lang === 'ru' ? 'Закрыть' : lang === 'uz' ? 'Yopish' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
