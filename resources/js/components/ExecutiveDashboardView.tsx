/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project, Integration } from '../data/mockData';
import { Language, translations } from '../translations';
import { 
  Building2, 
  TrendingUp, 
  PieChart, 
  Wallet, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck,
  Search
} from 'lucide-react';

interface ExecutiveDashboardViewProps {
  projects: Project[];
  integrations: Integration[];
  lang: Language;
}

export default function ExecutiveDashboardView({
  projects,
  integrations,
  lang,
}: ExecutiveDashboardViewProps) {
  const t = translations[lang] || translations['ru'];

  const [searchQuery, setSearchQuery] = useState('');

  // Calculate project financial metrics
  const projectSummaries = projects.map((project) => {
    const projectIntegrations = integrations.filter(
      (i) => String(i.projectId) === String(project.id)
    );

    // Sum total spend from integrations
    const totalSpent = projectIntegrations.reduce((acc, curr) => {
      const amount = Number(curr.totalAmount) || 0;
      return acc + amount;
    }, 0);

    const limit = Number(project.monthlyLimit) || 0;
    const remaining = Math.max(0, limit - totalSpent);
    const utilizationPct = limit > 0 ? Math.min(100, Math.round((totalSpent / limit) * 100)) : 0;
    const isOverLimit = limit > 0 && totalSpent > limit;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      limit,
      totalSpent,
      remaining,
      utilizationPct,
      isOverLimit,
      integrationsCount: projectIntegrations.length,
    };
  });

  // Calculate aggregate portfolio stats
  const totalPortfolioLimit = projectSummaries.reduce((acc, p) => acc + p.limit, 0);
  const totalPortfolioSpent = projectSummaries.reduce((acc, p) => acc + p.totalSpent, 0);
  const totalPortfolioRemaining = Math.max(0, totalPortfolioLimit - totalPortfolioSpent);
  const portfolioUtilizationPct = totalPortfolioLimit > 0 
    ? Math.min(100, Math.round((totalPortfolioSpent / totalPortfolioLimit) * 100))
    : 0;

  // Filter projects by search
  const filteredProjects = projectSummaries.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatCurrency = (val: number) => {
    return Math.round(val).toLocaleString();
  };

  return (
    <div className="space-y-8 antialiased font-sans pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/5 to-transparent pointer-events-none" />
        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-neutral-200 border border-white/10">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {lang === 'ru' ? 'Панель Руководства' : lang === 'uz' ? 'Rahbariyat Paneli' : 'Executive Dashboard'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            {lang === 'ru'
              ? 'Сводный финансовый отчет по проектам'
              : lang === 'uz'
              ? 'Loyihalar bo‘yicha umumiy moliyaviy hisobot'
              : 'Executive Project Budget Overview'}
          </h1>
        </div>
      </div>

      {/* Aggregate Portfolio KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Card 1: Total Limit */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {lang === 'ru' ? 'Общий лимит' : lang === 'uz' ? 'Umumiy limit' : 'Total Budget Limit'}
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-neutral-900">
              {formatCurrency(totalPortfolioLimit)}
            </div>
            <p className="text-[11px] text-neutral-500 font-medium mt-1">
              {projects.length} {lang === 'ru' ? 'активных проектов' : lang === 'uz' ? 'faol loyihalar' : 'active projects'}
            </p>
          </div>
        </div>

        {/* Card 2: Total Spent */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {lang === 'ru' ? 'Всего потрачено' : lang === 'uz' ? 'Jami sarflandi' : 'Total Spend'}
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-neutral-900">
              {formatCurrency(totalPortfolioSpent)}
            </div>
            <p className="text-[11px] text-neutral-500 font-medium mt-1">
              {portfolioUtilizationPct}% {lang === 'ru' ? 'от лимита' : lang === 'uz' ? 'limitdan' : 'of total budget'}
            </p>
          </div>
        </div>

        {/* Card 3: Total Remaining */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {lang === 'ru' ? 'Остаток бюджета' : lang === 'uz' ? 'Qoldiq byudjet' : 'Remaining Balance'}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <PieChart className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">
              {formatCurrency(totalPortfolioRemaining)}
            </div>
            <p className="text-[11px] text-neutral-500 font-medium mt-1">
              {lang === 'ru' ? 'Доступно к расходу' : lang === 'uz' ? 'Sarf qilish uchun mavjud' : 'Available for campaigns'}
            </p>
          </div>
        </div>

        {/* Card 4: Portfolio Utilization */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {lang === 'ru' ? 'Освоение портфеля' : lang === 'uz' ? 'Portfolio o‘zlashtirilishi' : 'Portfolio Utilization'}
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-neutral-900">
              {portfolioUtilizationPct}%
            </div>
            <div className="w-full bg-neutral-100 h-2 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  portfolioUtilizationPct > 90 ? 'bg-red-500' : portfolioUtilizationPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${portfolioUtilizationPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Projects Overview Section */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
          <div>
            <h2 className="text-lg font-black text-neutral-900 tracking-tight">
              {lang === 'ru' ? 'Сводка по проектам' : lang === 'uz' ? 'Loyihalar ko‘rinishi' : 'Projects Financial Breakdown'}
            </h2>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">
              {lang === 'ru' 
                ? 'Финансовое состояние и лимиты по каждому активному проекту' 
                : lang === 'uz'
                ? 'Har bir faol loyiha bo‘yicha moliyaviy holat va limitlar'
                : 'Budget allocations and current spend per project'}
            </p>
          </div>

          {/* Search filter */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ru' ? 'Поиск проекта...' : lang === 'uz' ? 'Loyiha qidiruvi...' : 'Search project...'}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:bg-white focus:border-black focus:outline-hidden transition"
            />
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((p) => (
            <div 
              key={p.id}
              className="bg-neutral-50/70 border border-neutral-200/80 hover:border-neutral-300 rounded-2xl p-6 transition duration-150 flex flex-col justify-between space-y-5"
            >
              {/* Project Header */}
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-extrabold text-neutral-900 text-base tracking-tight truncate">
                    {p.name}
                  </h3>
                  {p.isOverLimit ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 shrink-0">
                      <AlertTriangle className="w-3 h-3" />
                      {lang === 'ru' ? 'Превышение' : lang === 'uz' ? 'Oshib ketdi' : 'Over limit'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      {lang === 'ru' ? 'В норме' : lang === 'uz' ? 'Me’yorda' : 'On Track'}
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs text-neutral-500 font-medium line-clamp-2">
                    {p.description}
                  </p>
                )}
              </div>

              {/* Budget Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-neutral-500">
                    {lang === 'ru' ? 'Освоено:' : lang === 'uz' ? 'O‘zlashtirildi:' : 'Spent:'}
                  </span>
                  <span className="text-neutral-900">
                    {p.utilizationPct}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      p.isOverLimit ? 'bg-red-500' : p.utilizationPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, p.utilizationPct)}%` }}
                  />
                </div>
              </div>

              {/* Project Financial Breakdown Grid */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-neutral-200/60 text-left">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    {lang === 'ru' ? 'Лимит' : lang === 'uz' ? 'Limit' : 'Limit'}
                  </div>
                  <div className="text-xs font-extrabold text-neutral-900">
                    {p.limit > 0 ? formatCurrency(p.limit) : '—'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    {lang === 'ru' ? 'Потрачено' : lang === 'uz' ? 'Sarflandi' : 'Spent'}
                  </div>
                  <div className="text-xs font-extrabold text-neutral-900">
                    {formatCurrency(p.totalSpent)}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    {lang === 'ru' ? 'Остаток' : lang === 'uz' ? 'Qoldiq' : 'Remaining'}
                  </div>
                  <div className={`text-xs font-extrabold ${p.remaining === 0 && p.limit > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {p.limit > 0 ? formatCurrency(p.remaining) : '—'}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredProjects.length === 0 && (
            <div className="col-span-full py-12 text-center text-neutral-400 space-y-2">
              <Building2 className="w-8 h-8 mx-auto stroke-1" />
              <p className="text-xs font-semibold">
                {lang === 'ru' ? 'Проекты не найдены' : lang === 'uz' ? 'Loyihalar topilmadi' : 'No projects found'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
