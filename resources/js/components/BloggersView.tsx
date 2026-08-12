/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Project, Integration } from '../data/mockData';
import { Language, translations } from '../translations';
import { 
  Users, 
  Search, 
  Filter, 
  ExternalLink, 
  Calendar, 
  Layers, 
  Coins, 
  ChevronDown, 
  ChevronUp, 
  Link as LinkIcon, 
  FolderKanban, 
  CheckCircle2, 
  Clock, 
  ArrowUpDown, 
  UserSquare2,
  Sparkles,
  Copy,
  Check,
  AlertTriangle
} from 'lucide-react';

interface BloggersViewProps {
  projects?: Project[];
  integrations?: Integration[];
  lang?: Language;
  userRole?: string | null;
}

export interface BloggerSummary {
  rawName: string;
  cleanName: string;
  displayName: string;
  bloggerPageLink?: string;
  projects: { project: Project; count: number }[];
  platforms: string[];
  totalIntegrations: number;
  totalSlots: number;
  totalSpend: number;
  latestDate: string;
  integrations: Integration[];
}

const BADGE_COLORS = [
  'bg-indigo-50 text-indigo-700 border-indigo-200/80 hover:bg-indigo-100',
  'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100',
  'bg-purple-50 text-purple-700 border-purple-200/80 hover:bg-purple-100',
  'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100',
  'bg-sky-50 text-sky-700 border-sky-200/80 hover:bg-sky-100',
  'bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100',
  'bg-teal-50 text-teal-700 border-teal-200/80 hover:bg-teal-100',
  'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80 hover:bg-fuchsia-100',
];

function getProjectBadgeStyle(index: number) {
  return BADGE_COLORS[index % BADGE_COLORS.length];
}

export default function BloggersView({
  projects = [],
  integrations = [],
  lang = 'ru',
  userRole
}: BloggersViewProps) {
  const currentLang = lang || 'ru';
  const t = translations[currentLang] || translations['ru'] || {};

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'integrations' | 'spend' | 'date'>('name');
  const [expandedBlogger, setExpandedBlogger] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const safeIntegrations = useMemo(() => Array.isArray(integrations) ? integrations : [], [integrations]);
  const safeProjects = useMemo(() => Array.isArray(projects) ? projects : [], [projects]);

  // Group integrations by blogger
  const bloggerSummaries = useMemo<BloggerSummary[]>(() => {
    const map = new Map<string, {
      rawName: string;
      displayName: string;
      bloggerPageLink?: string;
      projectMap: Map<string, { project: Project; count: number }>;
      platformsSet: Set<string>;
      integrations: Integration[];
      totalSlots: number;
      totalSpend: number;
      latestDate: string;
    }>();

    safeIntegrations.forEach((item) => {
      if (!item || !item.bloggerName || typeof item.bloggerName !== 'string') return;
      const raw = String(item.bloggerName).trim();
      if (!raw) return;

      const clean = raw.replace(/^[@#]/, '').toLowerCase();
      const formattedName = raw.startsWith('@') ? raw : `@${raw}`;

      let record = map.get(clean);
      if (!record) {
        record = {
          rawName: raw,
          displayName: formattedName,
          bloggerPageLink: item.bloggerPageLink ? String(item.bloggerPageLink) : undefined,
          projectMap: new Map(),
          platformsSet: new Set(),
          integrations: [],
          totalSlots: 0,
          totalSpend: 0,
          latestDate: item.startDate ? String(item.startDate) : ''
        };
        map.set(clean, record);
      }

      // Update blogger page link if available
      if (!record.bloggerPageLink && item.bloggerPageLink) {
        record.bloggerPageLink = String(item.bloggerPageLink);
      }

      // Add project reference
      const projIdStr = item.projectId ? String(item.projectId) : 'unassigned';
      const proj = safeProjects.find((p) => p && p.id !== undefined && String(p.id) === projIdStr);
      
      if (proj) {
        const projData = record.projectMap.get(projIdStr);
        if (projData) {
          projData.count += 1;
        } else {
          record.projectMap.set(projIdStr, { project: proj, count: 1 });
        }
      } else {
        const fallbackProj: Project = {
          id: projIdStr,
          name: currentLang === 'ru' ? 'Общий проект' : currentLang === 'uz' ? 'Umumiy loyiha' : 'General Project',
          description: '',
          createdAt: ''
        };
        const projData = record.projectMap.get(projIdStr);
        if (projData) {
          projData.count += 1;
        } else {
          record.projectMap.set(projIdStr, { project: fallbackProj, count: 1 });
        }
      }

      // Add platform
      if (item.platform && typeof item.platform === 'string') {
        record.platformsSet.add(item.platform);
      }

      // Add integration item
      record.integrations.push(item);
      const slots = Number(item.slotsCount) || 0;
      const spend = Number(item.totalAmount) || 0;
      record.totalSlots += isNaN(slots) ? 0 : slots;
      record.totalSpend += isNaN(spend) ? 0 : spend;

      // Latest date
      if (item.startDate && String(item.startDate) > record.latestDate) {
        record.latestDate = String(item.startDate);
      }
    });

    const result: BloggerSummary[] = Array.from(map.entries()).map(([cleanName, data]) => {
      return {
        rawName: data.rawName,
        cleanName,
        displayName: data.displayName,
        bloggerPageLink: data.bloggerPageLink,
        projects: Array.from(data.projectMap.values()),
        platforms: Array.from(data.platformsSet),
        totalIntegrations: data.integrations.length,
        totalSlots: data.totalSlots,
        totalSpend: data.totalSpend,
        latestDate: data.latestDate,
        integrations: data.integrations
      };
    });

    return result;
  }, [safeIntegrations, safeProjects, currentLang]);

  // Filtered and Sorted summaries
  const filteredBloggers = useMemo(() => {
    return bloggerSummaries.filter((blogger) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = (blogger.displayName || '').toLowerCase().includes(query) || (blogger.cleanName || '').includes(query);
        const matchesProject = blogger.projects.some((p) => p.project && p.project.name && p.project.name.toLowerCase().includes(query));
        if (!matchesName && !matchesProject) return false;
      }

      // Project filter
      if (selectedProjectId !== 'all') {
        const matchesProj = blogger.projects.some((p) => p.project && String(p.project.id) === selectedProjectId);
        if (!matchesProj) return false;
      }

      // Platform filter
      if (selectedPlatform !== 'all') {
        const matchesPlat = blogger.platforms.includes(selectedPlatform);
        if (!matchesPlat) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        return (a.cleanName || '').localeCompare(b.cleanName || '');
      }
      if (sortBy === 'integrations') {
        return b.totalIntegrations - a.totalIntegrations;
      }
      if (sortBy === 'spend') {
        return b.totalSpend - a.totalSpend;
      }
      if (sortBy === 'date') {
        return (b.latestDate || '').localeCompare(a.latestDate || '');
      }
      return 0;
    });
  }, [bloggerSummaries, searchQuery, selectedProjectId, selectedPlatform, sortBy]);

  // Total summary stats
  const totalUniqueBloggers = bloggerSummaries.length;
  const totalSpendAll = useMemo(() => bloggerSummaries.reduce((acc, curr) => acc + (curr.totalSpend || 0), 0), [bloggerSummaries]);
  const totalIntegrationsAll = safeIntegrations.length;
  const totalProjectsWithIntegrations = useMemo(() => {
    const set = new Set<string>();
    safeIntegrations.forEach(i => { if (i && i.projectId) set.add(String(i.projectId)); });
    return set.size;
  }, [safeIntegrations]);

  const handleCopyCabinetLink = (token?: string) => {
    if (!token) return;
    try {
      const url = `${window.location.origin}/c/${token}`;
      navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Quick summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs">
        <div className="bg-neutral-50 border border-neutral-200/70 p-3 rounded-xl text-center">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            {currentLang === 'ru' ? 'Блогеры' : currentLang === 'uz' ? 'Bloggerlar' : 'Bloggers'}
          </span>
          <span className="text-base font-black text-neutral-900">
            {totalUniqueBloggers}
          </span>
        </div>

        <div className="bg-neutral-50 border border-neutral-200/70 p-3 rounded-xl text-center">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            {currentLang === 'ru' ? 'Проекты' : currentLang === 'uz' ? 'Loyihalar' : 'Projects'}
          </span>
          <span className="text-base font-black text-neutral-900">
            {totalProjectsWithIntegrations}
          </span>
        </div>

        <div className="bg-neutral-50 border border-neutral-200/70 p-3 rounded-xl text-center">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            {currentLang === 'ru' ? 'Сделки' : currentLang === 'uz' ? 'Bitimlar' : 'Deals'}
          </span>
          <span className="text-base font-black text-neutral-900">
            {totalIntegrationsAll}
          </span>
        </div>

        <div className="bg-neutral-50 border border-neutral-200/70 p-3 rounded-xl text-center">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            {currentLang === 'ru' ? 'Общий расход' : currentLang === 'uz' ? 'Jami xarajat' : 'Total Spent'}
          </span>
          <span className="text-base font-black text-emerald-600">
            {(totalSpendAll || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs space-y-3 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              currentLang === 'ru' ? 'Поиск блогера по имени или проекту...' :
              currentLang === 'uz' ? 'Blogger ismi yoki loyiha bo‘yicha qidiruv...' :
              'Search blogger by name or project...'
            }
            className="w-full pl-10 pr-4 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Project Filter */}
          <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs">
            <FolderKanban className="w-3.5 h-3.5 text-neutral-400 mr-1.5 shrink-0" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent font-medium text-neutral-700 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">{currentLang === 'ru' ? 'Все проекты' : currentLang === 'uz' ? 'Barcha loyihalar' : 'All Projects'}</option>
              {safeProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Platform Filter */}
          <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-neutral-400 mr-1.5 shrink-0" />
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="bg-transparent font-medium text-neutral-700 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">{currentLang === 'ru' ? 'Все платформы' : currentLang === 'uz' ? 'Barcha platformalar' : 'All Platforms'}</option>
              <option value="Telegram">Telegram</option>
              <option value="Instagram">Instagram</option>
              <option value="YouTube">YouTube</option>
              <option value="MAX">MAX</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 mr-1.5 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-medium text-neutral-700 text-xs focus:outline-none cursor-pointer"
            >
              <option value="name">{currentLang === 'ru' ? 'По имени (А-Я)' : currentLang === 'uz' ? 'Ism bo‘yicha' : 'By Name'}</option>
              <option value="integrations">{currentLang === 'ru' ? 'По кол-ву сделок' : currentLang === 'uz' ? 'Bitimlar soni bo‘yicha' : 'By Deals Count'}</option>
              <option value="spend">{currentLang === 'ru' ? 'По бюджету' : currentLang === 'uz' ? 'Byudjet bo‘yicha' : 'By Total Spent'}</option>
              <option value="date">{currentLang === 'ru' ? 'По последней дате' : currentLang === 'uz' ? 'Oxirgi sana bo‘yicha' : 'By Recent Date'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bloggers List View */}
      {filteredBloggers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-neutral-200/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-neutral-800 text-base">
            {currentLang === 'ru' ? 'Блогеры не найдены' : currentLang === 'uz' ? 'Bloggerlar topilmadi' : 'No Bloggers Found'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            {searchQuery || selectedProjectId !== 'all' || selectedPlatform !== 'all'
              ? (currentLang === 'ru' ? 'Попробуйте изменить параметры поиска или фильтров.' : currentLang === 'uz' ? 'Qidiruv parametrlarini o‘zgartirib ko‘ring.' : 'Try adjusting your search query or filters.')
              : (currentLang === 'ru' ? 'Пока нет ни одной проведенной интеграции с блогерами.' : currentLang === 'uz' ? 'Hali bloggerlar bilan integratsiyalar o‘tkazilmadi.' : 'No influencer integrations logged yet.')
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            <span>
              {currentLang === 'ru' ? `Найдено блогеров: ${filteredBloggers.length}` : currentLang === 'uz' ? `Topilgan bloggerlar: ${filteredBloggers.length}` : `Bloggers found: ${filteredBloggers.length}`}
            </span>
          </div>

          {filteredBloggers.map((blogger) => {
            const isExpanded = expandedBlogger === blogger.cleanName;
            const displayNameStr = blogger.displayName || '@blogger';
            const avatarInitial = displayNameStr.replace(/^[@#]/, '').slice(0, 2).toUpperCase() || 'BL';

            return (
              <div
                key={blogger.cleanName}
                className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-2xs hover:border-neutral-300 transition-all duration-150"
              >
                {/* Blogger Row */}
                <div 
                  onClick={() => setExpandedBlogger(isExpanded ? null : blogger.cleanName)}
                  className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/50 transition duration-150"
                >
                  {/* Left: Avatar & Name + Project Badges */}
                  <div className="flex items-start md:items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-black text-white font-extrabold text-sm flex items-center justify-center shrink-0 uppercase shadow-xs">
                      {avatarInitial}
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-neutral-900 text-sm tracking-tight truncate">
                          {displayNameStr}
                        </span>

                        {blogger.bloggerPageLink && (
                          <a
                            href={blogger.bloggerPageLink.startsWith('http') ? blogger.bloggerPageLink : `https://${blogger.bloggerPageLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-black bg-neutral-100 hover:bg-neutral-200 px-2 py-0.5 rounded-md transition"
                            title={currentLang === 'ru' ? 'Перейти на страницу блогера' : 'View Blogger Profile'}
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="hidden sm:inline">{currentLang === 'ru' ? 'Профиль' : 'Profile'}</span>
                          </a>
                        )}
                      </div>

                      {/* Project Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-1">
                          {currentLang === 'ru' ? 'Проекты:' : currentLang === 'uz' ? 'Loyihalar:' : 'Projects:'}
                        </span>

                        {blogger.projects.map((pGroup, idx) => (
                          <span
                            key={pGroup.project ? pGroup.project.id : idx}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition cursor-default ${getProjectBadgeStyle(idx)}`}
                            title={`${pGroup.project ? pGroup.project.name : 'Project'} (${pGroup.count} ${currentLang === 'ru' ? 'интеграций' : 'deals'})`}
                          >
                            <FolderKanban className="w-3 h-3 opacity-70" />
                            <span>{pGroup.project ? pGroup.project.name : 'Project'}</span>
                            {pGroup.count > 1 && (
                              <span className="text-[10px] font-extrabold opacity-80 bg-black/10 px-1.5 py-0.2 rounded-full">
                                {pGroup.count}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Middle & Right: Platform Badges, Stats & Expand Toggle */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100">
                    {/* Platforms */}
                    <div className="flex items-center gap-1.5">
                      {(blogger.platforms || []).map((plat) => (
                        <span
                          key={plat}
                          className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200"
                        >
                          {plat}
                        </span>
                      ))}
                    </div>

                    {/* Stats summary */}
                    <div className="text-right">
                      <div className="text-xs font-black text-neutral-900">
                        {blogger.totalIntegrations} {currentLang === 'ru' ? (blogger.totalIntegrations === 1 ? 'сделка' : blogger.totalIntegrations < 5 ? 'сделки' : 'сделок') : currentLang === 'uz' ? 'bitim' : 'deals'}
                        <span className="text-neutral-400 font-normal ml-1">({blogger.totalSlots || 0} {currentLang === 'ru' ? 'слотов' : 'slots'})</span>
                      </div>
                      <div className="text-[11px] font-extrabold text-emerald-600">
                        {(blogger.totalSpend || 0).toLocaleString()}
                      </div>
                    </div>

                    {/* Expand Chevron button */}
                    <button
                      type="button"
                      className="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded-lg transition"
                      title={isExpanded ? "Collapse" : "Expand Details"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Integrations List Accordion */}
                {isExpanded && (
                  <div className="border-t border-neutral-200/80 bg-neutral-50/70 p-4 md:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-neutral-500" />
                        <span>
                          {currentLang === 'ru' ? 'История интеграций с блогером' : currentLang === 'uz' ? 'Blogger bilan integratsiyalar tarixi' : 'Integration History'}
                        </span>
                      </h4>
                      <span className="text-[10px] text-neutral-400 font-medium">
                        {currentLang === 'ru' ? 'Всего записей:' : 'Total entries:'} {blogger.integrations.length}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-100/80 border-b border-neutral-200 text-[10px] font-extrabold uppercase text-neutral-500">
                          <tr>
                            <th className="px-3.5 py-2.5">{currentLang === 'ru' ? 'Проект' : 'Project'}</th>
                            <th className="px-3.5 py-2.5">{currentLang === 'ru' ? 'Платформа' : 'Platform'}</th>
                            <th className="px-3.5 py-2.5">{currentLang === 'ru' ? 'Слоты' : 'Slots'}</th>
                            <th className="px-3.5 py-2.5">{currentLang === 'ru' ? 'Цена / Слот' : 'Price / Slot'}</th>
                            <th className="px-3.5 py-2.5">{currentLang === 'ru' ? 'Итого' : 'Total'}</th>
                            <th className="px-3.5 py-2.5">{currentLang === 'ru' ? 'Даты' : 'Dates'}</th>
                            <th className="px-3.5 py-2.5">{currentLang === 'ru' ? 'Статус' : 'Status'}</th>
                            <th className="px-3.5 py-2.5 text-right">{currentLang === 'ru' ? 'Кабинет' : 'Cabinet'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                          {blogger.integrations.map((item) => {
                            const proj = safeProjects.find((p) => p && p.id !== undefined && String(p.id) === String(item.projectId));
                            return (
                              <tr key={item.id} className="hover:bg-neutral-50/80 transition duration-100">
                                <td className="px-3.5 py-3 font-bold text-neutral-900">
                                  {proj ? proj.name : (currentLang === 'ru' ? 'Общий проект' : 'General')}
                                </td>
                                <td className="px-3.5 py-3">
                                  <span className="font-semibold text-neutral-800">{item.platform}</span>
                                </td>
                                <td className="px-3.5 py-3">
                                  {item.paidSlotsCount ?? item.slotsCount} / {item.slotsCount}
                                </td>
                                <td className="px-3.5 py-3">
                                  {Number(item.pricePerSlot || 0).toLocaleString()}
                                </td>
                                <td className="px-3.5 py-3 font-bold text-neutral-900">
                                  {Number(item.totalAmount || 0).toLocaleString()}
                                </td>
                                <td className="px-3.5 py-3 text-[11px] text-neutral-500 whitespace-nowrap">
                                  {item.startDate || '-'} {item.endDate ? `→ ${item.endDate}` : ''}
                                </td>
                                <td className="px-3.5 py-3">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                    item.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : item.status === 'paused'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {item.status === 'completed' ? (
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                    ) : (
                                      <Clock className="w-2.5 h-2.5" />
                                    )}
                                    {item.status}
                                  </span>
                                </td>
                                <td className="px-3.5 py-3 text-right whitespace-nowrap">
                                  {item.bloggerCabinetToken ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyCabinetLink(item.bloggerCabinetToken)}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-700 bg-neutral-100 hover:bg-black hover:text-white px-2.5 py-1 rounded-lg transition"
                                      title={currentLang === 'ru' ? 'Скопировать ссылку на Кабинет Блогера' : 'Copy Cabinet Link'}
                                    >
                                      {copiedToken === item.bloggerCabinetToken ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-400" />
                                          <span className="text-emerald-400">{currentLang === 'ru' ? 'Скопировано!' : 'Copied!'}</span>
                                        </>
                                      ) : (
                                        <>
                                          <LinkIcon className="w-3 h-3" />
                                          <span>{currentLang === 'ru' ? 'Кабинет' : 'Cabinet'}</span>
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-neutral-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
