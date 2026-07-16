/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Project, 
  Integration,
  BloggerSubmission
} from '../data/mockData';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  HelpCircle, 
  Coins, 
  Layers, 
  Users, 
  Calendar, 
  Tv2, 
  FileCode,
  Check,
  AlertCircle,
  Sparkles,
  X,
  Link
} from 'lucide-react';
import { Language, translations } from '../translations';

interface DashboardViewProps {
  projects: Project[];
  integrations: Integration[];
  submissions: BloggerSubmission[];
  onAddProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  onEditProject?: (id: string, name: string, description: string, telegramThreadId?: string) => void;
  onDeleteProject: (id: string) => void;
  onAddIntegration: (integration: Omit<Integration, 'id' | 'totalAmount'>) => void;
  onEditIntegration: (id: string, integration: Partial<Integration>) => void;
  onDeleteIntegration: (id: string) => void;
  lang: Language;
  allowedMetrics?: string[];
  userRole?: string | null;
}

export default function DashboardView({
  projects,
  integrations,
  submissions,
  onAddProject,
  onEditProject,
  onDeleteProject,
  onAddIntegration,
  onEditIntegration,
  onDeleteIntegration,
  lang,
  allowedMetrics = ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
  userRole
}: DashboardViewProps) {
  // Current active project selection
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  
  const t = translations[lang] || translations['ru'] || {};
  
  // Modals / forms state
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddIntegrationModal, setShowAddIntegrationModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [selectedIntegrationForDetails, setSelectedIntegrationForDetails] = useState<Integration | null>(null);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // New Project Form state
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectThreadId, setNewProjectThreadId] = useState('');

  // Edit Project Form state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [editProjectThreadId, setEditProjectThreadId] = useState('');

  // New / Editing Integration Form state
  const [bloggerName, setBloggerName] = useState('');
  const [startDate, setStartDate] = useState('2026-07-10');
  const [endDate, setEndDate] = useState('2026-07-17');
  const [platform, setPlatform] = useState<'Telegram' | 'Instagram' | 'YouTube' | 'MAX'>('Telegram');
  const [referralLink, setReferralLink] = useState('');
  const [pricePerSlot, setPricePerSlot] = useState<number>(150);
  const [slotsCount, setSlotsCount] = useState<number>(1);
  const [calculatedTotal, setCalculatedTotal] = useState<number>(150);

  const [customizeSlots, setCustomizeSlots] = useState<boolean>(false);
  const [slotGroups, setSlotGroups] = useState<{ quantity: number; platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX'; format: string }[]>([]);

  const getDefaultFormat = (plat: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX') => {
    if (plat === 'Instagram') return 'Stories';
    if (plat === 'Telegram') return 'Post';
    if (plat === 'YouTube') return 'Release';
    return 'Post';
  };

  const groupSlots = (flatConfigs: SlotConfig[]): { quantity: number; platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX'; format: string }[] => {
    const groups: { quantity: number; platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX'; format: string }[] = [];
    flatConfigs.forEach(slot => {
      const existing = groups.find(g => g.platform === slot.platform && g.format === slot.format);
      if (existing) {
        existing.quantity += 1;
      } else {
        groups.push({ quantity: 1, platform: slot.platform, format: slot.format });
      }
    });
    return groups;
  };

  // Recalculate dynamic total amount on input change
  useEffect(() => {
    setCalculatedTotal(pricePerSlot * slotsCount);
  }, [pricePerSlot, slotsCount]);

  // Reset slots configuration customization if slotsCount changes
  useEffect(() => {
    setCustomizeSlots(false);
    setSlotGroups([]);
  }, [slotsCount]);

  // Set form defaults when opening modal for editing or creating
  const openAddIntegration = () => {
    setBloggerName('');
    setStartDate('2026-07-10');
    setEndDate('2026-07-17');
    setPlatform('Telegram');
    setReferralLink('');
    setPricePerSlot(150);
    setSlotsCount(1);
    setCalculatedTotal(150);
    setCustomizeSlots(false);
    setSlotGroups([]);
    setShowAddIntegrationModal(true);
  };

  const openEditIntegration = (integration: Integration) => {
    setEditingIntegration(integration);
    setBloggerName(integration.bloggerName);
    setStartDate(integration.startDate);
    setEndDate(integration.endDate);
    setPlatform(integration.platform);
    setReferralLink(integration.referralLink);
    setPricePerSlot(integration.pricePerSlot);
    setSlotsCount(integration.slotsCount);
    setCalculatedTotal(integration.totalAmount);
    if (integration.slotsConfig && integration.slotsConfig.length > 0) {
      setCustomizeSlots(true);
      setSlotGroups(groupSlots(integration.slotsConfig));
    } else {
      setCustomizeSlots(false);
      setSlotGroups([]);
    }
  };

  // Submit operations
  const handleSubmitProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onAddProject({
      name: newProjectName,
      description: newProjectDesc,
      telegramThreadId: newProjectThreadId,
    });
    setNewProjectName('');
    setNewProjectDesc('');
    setNewProjectThreadId('');
    setShowAddProjectModal(false);
  };

  const handleSubmitEditProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !editProjectName.trim()) return;
    if (onEditProject) {
      onEditProject(selectedProject.id, editProjectName, editProjectDesc, editProjectThreadId);
    }
    setShowEditProjectModal(false);
  };

  const handleSubmitIntegration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bloggerName.trim() || !startDate || !endDate) return;

    let finalSlotsConfig: SlotConfig[] = [];
    if (customizeSlots) {
      const currentSum = slotGroups.reduce((acc, g) => acc + g.quantity, 0);
      if (currentSum !== slotsCount) {
        alert(lang === 'ru' 
          ? `Пожалуйста, настройте все слоты. Настроено ${currentSum} из ${slotsCount}.` 
          : lang === 'uz' 
          ? `Iltimos, barcha slotlarni sozlang. Sozlangan: ${currentSum} ta (${slotsCount} tadan).` 
          : `Please configure all slots. Configured ${currentSum} out of ${slotsCount}.`
        );
        return;
      }
      slotGroups.forEach(g => {
        for (let i = 0; i < g.quantity; i++) {
          finalSlotsConfig.push({ platform: g.platform, format: g.format });
        }
      });
    } else {
      for (let i = 0; i < slotsCount; i++) {
        finalSlotsConfig.push({
          platform: platform,
          format: getDefaultFormat(platform)
        });
      }
    }

    if (editingIntegration) {
      onEditIntegration(editingIntegration.id, {
        bloggerName,
        startDate,
        endDate,
        platform,
        referralLink,
        pricePerSlot,
        slotsCount,
        totalAmount: pricePerSlot * slotsCount,
        slotsConfig: finalSlotsConfig
      });
      setEditingIntegration(null);
    } else {
      onAddIntegration({
        projectId: selectedProjectId,
        bloggerName,
        startDate,
        endDate,
        platform,
        referralLink,
        pricePerSlot,
        slotsCount,
        status: 'active',
        slotsConfig: finalSlotsConfig
      });
    }
    setShowAddIntegrationModal(false);
  };

  // Resolve project metadata
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const activeProjectIntegrations = selectedProject
    ? integrations.filter(i => i.projectId === selectedProject.id)
    : [];

  // Filter integrations by Start Date range
  const filteredIntegrations = activeProjectIntegrations.filter((item) => {
    if (filterStartDate && item.startDate < filterStartDate) return false;
    if (filterEndDate && item.startDate > filterEndDate) return false;
    return true;
  });

  // Selected Project Statistics Calculators (filtered by date)
  const totalSpend = filteredIntegrations.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalRemainingToPay = filteredIntegrations.reduce((acc, curr) => acc + Math.max(0, curr.totalAmount - (curr.paidAmount || 0)), 0);
  const totalSlotsCount = filteredIntegrations.reduce((acc, curr) => acc + curr.slotsCount, 0);
  const totalPublishedSlots = filteredIntegrations.reduce((sum, item) => {
    const sub = (submissions || []).find(s => String(s.integrationId) === String(item.id));
    const slotsSubmitted = (sub && sub.data) ? Object.values(sub.data).filter(v => typeof v === 'string' && v.trim() !== '').length : 0;
    return sum + slotsSubmitted;
  }, 0);
  const totalRemainingSlots = Math.max(0, totalSlotsCount - totalPublishedSlots);

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-neutral-900">
      {/* Project Directory Header */}
      <div className="flex justify-between items-center border-b border-neutral-200 pb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-black text-black tracking-tight">{t.projectDirectory}</h2>
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider bg-neutral-100 px-2 py-0.5 rounded">
            {projects.length} {t.totalSuffix}
          </span>
        </div>
        
        <button
          id="add-project-btn"
          onClick={() => setShowAddProjectModal(true)}
          className="flex items-center gap-1.5 bg-black hover:bg-neutral-900 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition duration-150 shadow-sm"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>{t.newProject}</span>
        </button>
      </div>

      {/* Project Directory Grid */}
      <div className="flex flex-wrap gap-2.5">
        {projects.map((proj) => {
          const isSelected = selectedProjectId === proj.id;

          return (
            <button
              key={proj.id}
              onClick={() => setSelectedProjectId(proj.id)}
              id={`project-btn-${proj.id}`}
              className={`px-4 py-2 text-xs font-extrabold rounded-lg border transition duration-150 text-left flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-black border-black text-white shadow-sm'
                  : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-800'
              }`}
            >
              <span>{proj.name}</span>
              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>}
            </button>
          );
        })}
        {projects.length === 0 && (
          <div className="w-full p-8 text-center bg-white border border-dashed border-neutral-200 rounded-xl">
            <AlertCircle className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-neutral-600">{t.noProjectsFound}</p>
            <p className="text-[11px] text-neutral-400 mt-1">{t.createProjectPrompt}</p>
          </div>
        )}
      </div>

      {/* Date Filter Bar */}
      {selectedProject && (
        <div className="bg-white border border-neutral-200 p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-neutral-700">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-black shrink-0" />
            <span className="font-bold text-black text-[11px] uppercase tracking-wider">
              {lang === 'ru' ? 'Фильтр по дате начала' : lang === 'uz' ? 'Boshlanish sanasi bo‘yicha filtr' : 'Filter by Start Date'}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400 font-bold uppercase text-[9px]">{lang === 'ru' ? 'С' : lang === 'uz' ? 'Dan' : 'From'}</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-black transition duration-150 font-medium"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400 font-bold uppercase text-[9px]">{lang === 'ru' ? 'По' : lang === 'uz' ? 'Gacha' : 'To'}</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-black transition duration-150 font-medium"
              />
            </div>
            {(filterStartDate || filterEndDate) && (
              <button
                onClick={() => {
                  setFilterStartDate('');
                  setFilterEndDate('');
                }}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-lg transition border border-neutral-200 cursor-pointer"
              >
                {lang === 'ru' ? 'Сбросить' : lang === 'uz' ? 'Tozalash' : 'Reset'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Analytics Mini Bar */}
      <div className="flex flex-wrap items-center gap-4 md:gap-8 border border-neutral-200 bg-white p-4 rounded-xl shadow-xs">
        {allowedMetrics.includes('deals') && (
          <div className="text-left min-w-[100px]">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{t.bloggerDeals}</p>
            <p className="text-xl font-black text-black">{filteredIntegrations.length}</p>
          </div>
        )}
        {allowedMetrics.includes('spend') && (
          <div className="text-left border-l border-neutral-100 pl-4 md:pl-8 min-w-[100px]">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{t.allocatedSpend}</p>
            <p className="text-xl font-black text-black">{totalSpend.toLocaleString()}</p>
          </div>
        )}
        {allowedMetrics.includes('financial_metrics') && (
          <div className="text-left border-l border-neutral-100 pl-4 md:pl-8 min-w-[100px]">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{t.metricRemainingToPay}</p>
            <p className="text-xl font-black text-rose-600">{totalRemainingToPay.toLocaleString()}</p>
          </div>
        )}
        {allowedMetrics.includes('total_slots') && (
          <div className="text-left border-l border-neutral-100 pl-4 md:pl-8 min-w-[100px]">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{t.totalSlotsLabel}</p>
            <p className="text-xl font-black text-black">{totalSlotsCount}</p>
          </div>
        )}
        {allowedMetrics.includes('slots_published') && (
          <div className="text-left border-l border-neutral-100 pl-4 md:pl-8 min-w-[100px]">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{t.metricSlotsPublished}</p>
            <p className="text-xl font-black text-emerald-600">{totalPublishedSlots}</p>
          </div>
        )}
        {allowedMetrics.includes('slots_remaining') && (
          <div className="text-left border-l border-neutral-100 pl-4 md:pl-8 min-w-[100px]">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{t.metricSlotsRemaining}</p>
            <p className="text-xl font-black text-amber-600">{totalRemainingSlots}</p>
          </div>
        )}
      </div>

      {/* Primary Panels Layout */}
      <div className="w-full">
        {/* Selected Project Integrations Manager (Filament RelationManager simulation) */}
        <div className="w-full">
          {selectedProject ? (
            <div className="space-y-6">
              {/* Project Info Block - Displayed below when opened */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{t.selectedCampaignDetails}</span>
                    {userRole === 'super_admin' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditProjectName(selectedProject.name);
                            setEditProjectDesc(selectedProject.description || '');
                            setEditProjectThreadId(selectedProject.telegramThreadId || '');
                            setShowEditProjectModal(true);
                          }}
                          className="text-neutral-400 hover:text-black p-1 rounded transition duration-150 cursor-pointer"
                          title={lang === 'ru' ? 'Редактировать проект' : lang === 'uz' ? 'Loyihani tahrirlash' : 'Edit Project'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(t.confirmDeleteProject)) {
                              onDeleteProject(selectedProject.id);
                              if (projects.length > 1) {
                                const remaining = projects.filter(p => p.id !== selectedProject.id);
                                setSelectedProjectId(remaining[0].id);
                              } else {
                                setSelectedProjectId('');
                              }
                            }
                          }}
                          id={`delete-project-${selectedProject.id}`}
                          className="text-neutral-400 hover:text-red-600 p-1 rounded transition duration-150 cursor-pointer"
                          title={t.deleteProjectTooltip}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-black">{selectedProject.name}</h3>
                  <p className="text-xs text-neutral-500 max-w-3xl leading-relaxed">
                    {selectedProject.description || t.noDescription}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider shrink-0">
                  <span className="px-2.5 py-1 rounded bg-white border border-neutral-200 text-neutral-600">
                    {integrations.filter(i => i.projectId === selectedProject.id).length} {t.integrationsCount}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-black text-white">
                    {t.spend}: {integrations.filter(i => i.projectId === selectedProject.id).reduce((acc, curr) => acc + curr.totalAmount, 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Integrations Table Card */}
              <div className="bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
                {/* RelationManager Title & Header */}
                <div className="border-b border-neutral-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-neutral-50/50">
                  <div>
                    <h3 className="text-sm font-black text-black">
                      {selectedProject.name} <span className="text-neutral-400 font-normal">→ {t.integrationsTitle}</span>
                    </h3>
                  </div>

                <button
                  id="add-integration-btn"
                  onClick={openAddIntegration}
                  className="flex items-center gap-1.5 bg-black hover:bg-neutral-950 text-white font-bold text-xs px-3 py-2 rounded-lg transition duration-150 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  <span>{t.newIntegration}</span>
                </button>
              </div>

              {/* Integrations Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold text-neutral-500 uppercase tracking-wider select-none">
                      <th className="py-3 px-6 whitespace-nowrap">{t.bloggerColumn}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t.startDateColumn}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t.priceColumn}</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">
                        {lang === 'ru' ? 'Купленные слоты' : lang === 'uz' ? 'Sotib olingan slotlar' : 'Bought Slots'}
                      </th>
                      <th className="py-3 px-4 whitespace-nowrap">{t.totalSumColumn}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t.metricPaidToBlogger}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t.metricRemainingToPay}</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">{t.metricSlotsPublished}</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">{t.metricSlotsRemaining}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                    {filteredIntegrations.map((item) => {
                      const sub = (submissions || []).find(s => String(s.integrationId) === String(item.id));
                      const slotsSubmitted = (sub && sub.data) ? Object.values(sub.data).filter(v => typeof v === 'string' && v.trim() !== '').length : 0;
                      const slotsRemaining = Math.max(0, item.slotsCount - slotsSubmitted);

                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => {
                            console.log("Clicked integration row:", item);
                            setSelectedIntegrationForDetails(item);
                          }}
                          className="hover:bg-neutral-50/60 transition duration-150 cursor-pointer"
                        >
                          {/* Blogger Name */}
                          <td className="py-3.5 px-6 font-bold text-black whitespace-nowrap">
                            {item.bloggerName}
                          </td>

                          {/* Start Date */}
                          <td className="py-3.5 px-4 text-[11px] text-neutral-600 font-medium whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" /> {item.startDate}
                            </span>
                          </td>

                          {/* Price Per Slot */}
                          <td className="py-3.5 px-4 font-semibold text-neutral-600 whitespace-nowrap">
                            {item.pricePerSlot.toLocaleString('ru-RU')}
                          </td>

                          {/* Bought Slots */}
                          <td className="py-3.5 px-4 text-center font-bold text-black whitespace-nowrap">
                            {item.slotsCount}
                          </td>

                          {/* Total Sum */}
                          <td className="py-3.5 px-4 font-extrabold text-black whitespace-nowrap">
                            {item.totalAmount.toLocaleString('ru-RU')}
                          </td>

                          {/* Paid to Blogger */}
                          <td className="py-3.5 px-4 font-bold text-emerald-600 whitespace-nowrap">
                            {(item.paidAmount || 0).toLocaleString('ru-RU')}
                          </td>

                          {/* Remaining to Pay */}
                          <td className="py-3.5 px-4 font-bold text-rose-600 whitespace-nowrap">
                            {Math.max(0, item.totalAmount - (item.paidAmount || 0)).toLocaleString('ru-RU')}
                          </td>

                          {/* Slots Published */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-extrabold text-[10px] border border-emerald-100/50">
                              {slotsSubmitted}
                            </span>
                          </td>

                          {/* Slots Remaining */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-amber-50 text-amber-700 font-extrabold text-[10px] border border-amber-100/50">
                              {slotsRemaining}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredIntegrations.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-12 px-6 text-center">
                          <AlertCircle className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
                          <p className="text-xs font-bold text-neutral-600">{t.noIntegrationsYet}</p>
                          <p className="text-[11px] text-neutral-400 mt-1">
                            {t.createIntegrationPrompt}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          ) : (
            <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl shadow-xs">
              <p className="text-xs text-neutral-500">{t.createProjectPrompt}</p>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL 1: ADD PROJECT --- */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-100">
            <div className="bg-white px-6 py-4 flex justify-between items-center text-black border-b border-neutral-200">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-black" /> {t.addProjectTitle}
              </h3>
              <button 
                onClick={() => setShowAddProjectModal(false)}
                className="text-neutral-400 hover:text-black font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProject} className="p-6 space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  {t.projectNameLabel}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.projectNamePlaceholder}
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  {t.projectDescLabel}
                </label>
                <textarea
                  placeholder={t.projectDescPlaceholder}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  {lang === 'ru' ? 'Telegram ID Темы (Thread ID)' : lang === 'uz' ? 'Telegram Mavzu ID (Thread ID)' : 'Telegram Thread ID'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12345"
                  value={newProjectThreadId}
                  onChange={(e) => setNewProjectThreadId(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddProjectModal(false)}
                  className="flex-1 py-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold text-xs rounded-lg transition duration-150"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-lg transition duration-150"
                >
                  {t.createBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 1B: EDIT PROJECT --- */}
      {showEditProjectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-100">
            <div className="bg-white px-6 py-4 flex justify-between items-center text-black border-b border-neutral-200">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-black" /> {lang === 'ru' ? 'Редактировать проект' : lang === 'uz' ? 'Loyihani tahrirlash' : 'Edit Project'}
              </h3>
              <button 
                onClick={() => setShowEditProjectModal(false)}
                className="text-neutral-400 hover:text-black font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEditProject} className="p-6 space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  {t.projectNameLabel}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.projectNamePlaceholder}
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  {t.projectDescLabel}
                </label>
                <textarea
                  placeholder={t.projectDescPlaceholder}
                  value={editProjectDesc}
                  onChange={(e) => setEditProjectDesc(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  {lang === 'ru' ? 'Telegram ID Темы (Thread ID)' : lang === 'uz' ? 'Telegram Mavzu ID (Thread ID)' : 'Telegram Thread ID'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12345"
                  value={editProjectThreadId}
                  onChange={(e) => setEditProjectThreadId(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditProjectModal(false)}
                  className="flex-1 py-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold text-xs rounded-lg transition duration-150"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-lg transition duration-150"
                >
                  {lang === 'ru' ? 'Сохранить' : lang === 'uz' ? 'Saqlash' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADD/EDIT INTEGRATION --- */}
      {(showAddIntegrationModal || editingIntegration) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-neutral-200 w-full max-w-2xl overflow-hidden animate-in fade-in duration-100">
            <div className="bg-white px-6 py-4 flex justify-between items-center text-black border-b border-neutral-200">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                {editingIntegration ? t.editIntegration : t.newIntegration}
              </h3>
              <button 
                onClick={() => {
                  setShowAddIntegrationModal(false);
                  setEditingIntegration(null);
                }}
                className="text-neutral-400 hover:text-black font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitIntegration} className="p-6 space-y-4 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.bloggerColumn} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Alex Fitness Hub"
                    value={bloggerName}
                    onChange={(e) => setBloggerName(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.platformColumn} *
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as any)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  >
                    <option value="Telegram">Telegram</option>
                    <option value="Instagram">Instagram</option>
                    <option value="YouTube">YouTube</option>
                    <option value="MAX">MAX</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  {t.referralLinkField}
                </label>
                <input
                  type="url"
                  placeholder="https://saas-ai.com/join?utm_source=alex_fit"
                  value={referralLink}
                  onChange={(e) => setReferralLink(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.startDateColumn} *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.endDateColumn} *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.pricePerSlotField} *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={pricePerSlot}
                    onChange={(e) => setPricePerSlot(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150 font-bold text-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                    {t.slotsCountField} *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={slotsCount}
                    onChange={(e) => setSlotsCount(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-neutral-200 focus:border-black rounded-lg text-xs focus:outline-none transition duration-150 font-bold text-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1.5">
                    {t.totalSumField}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={calculatedTotal.toLocaleString('ru-RU')}
                    className="w-full px-4 py-2 bg-neutral-100 border border-neutral-200 rounded-lg text-xs font-bold text-black select-none"
                  />
                </div>
              </div>

              {/* Checkbox to Toggle Individual Slots Configuration */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="customize-slots-checkbox"
                  checked={customizeSlots}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setCustomizeSlots(checked);
                    if (checked && slotGroups.length === 0) {
                      setSlotGroups([{ quantity: slotsCount, platform: platform, format: getDefaultFormat(platform) }]);
                    }
                  }}
                  className="w-3.5 h-3.5 accent-black rounded border-neutral-300 focus:ring-black cursor-pointer"
                />
                <label htmlFor="customize-slots-checkbox" className="text-[10px] font-bold text-neutral-600 select-none cursor-pointer">
                  {t.customizeSlotsLabel}
                </label>
              </div>

              {/* Grouped Slots Configurer */}
              {customizeSlots && (
                <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-left space-y-2">
                  <div className="flex justify-between items-center border-b border-neutral-200 pb-1.5">
                    <label className="block text-[9px] font-black text-neutral-500 uppercase tracking-wide">
                      {t.configureSlotsTitle}
                    </label>
                    <span className="text-[9px] font-bold text-neutral-400">
                      {slotGroups.reduce((acc, g) => acc + g.quantity, 0)} / {slotsCount}
                    </span>
                  </div>
                  
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {slotGroups.map((group, index) => (
                      <div key={index} className="flex items-center gap-1.5 p-1.5 bg-white border border-neutral-150 rounded-lg text-xs">
                        {/* Quantity input */}
                        <input
                          type="number"
                          required
                          min={1}
                          max={slotsCount}
                          value={group.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value));
                            const otherSum = slotGroups.reduce((acc, g, idx) => idx === index ? acc : acc + g.quantity, 0);
                            if (otherSum + val > slotsCount) {
                              alert(lang === 'ru' 
                                ? `Количество настроенных слотов не должно превышать общее количество (${slotsCount})!` 
                                : lang === 'uz' 
                                ? `Sozlangan slotlar soni umumiy slotlar sonidan (${slotsCount}) oshib ketmasligi kerak!` 
                                : `Configured slots count cannot exceed total slots count (${slotsCount})!`
                              );
                              return;
                            }
                            const nextGroups = [...slotGroups];
                            nextGroups[index].quantity = val;
                            setSlotGroups(nextGroups);
                          }}
                          className="w-12 bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-[10px] font-bold text-black focus:outline-none text-center"
                          title="Quantity"
                        />

                        {/* Platform selector */}
                        <select
                          value={group.platform}
                          onChange={(e) => {
                            const platVal = e.target.value as 'Telegram' | 'Instagram' | 'YouTube' | 'MAX';
                            const nextGroups = [...slotGroups];
                            nextGroups[index] = {
                              ...nextGroups[index],
                              platform: platVal,
                              format: getDefaultFormat(platVal)
                            };
                            setSlotGroups(nextGroups);
                          }}
                          className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-[10px] font-bold text-black focus:outline-none"
                        >
                          <option value="Telegram">Telegram</option>
                          <option value="Instagram">Instagram</option>
                          <option value="YouTube">YouTube</option>
                          <option value="MAX">MAX</option>
                        </select>

                        {/* Format Selector */}
                        <select
                          value={group.format}
                          onChange={(e) => {
                            const nextGroups = [...slotGroups];
                            nextGroups[index].format = e.target.value;
                            setSlotGroups(nextGroups);
                          }}
                          className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-[10px] font-bold text-black focus:outline-none flex-1"
                        >
                          {group.platform === 'Instagram' && (
                            <>
                              <option value="Reels">Instagram Reels</option>
                              <option value="Stories">Instagram Stories</option>
                              <option value="Post">Instagram Post</option>
                            </>
                          )}
                          {group.platform === 'Telegram' && (
                            <>
                              <option value="Post">Telegram Post</option>
                              <option value="Stories">Telegram Stories</option>
                            </>
                          )}
                          {group.platform === 'YouTube' && (
                            <>
                              <option value="Release">YouTube Release</option>
                              <option value="Shorts">YouTube Shorts</option>
                              <option value="Integration">YouTube Integration</option>
                            </>
                          )}
                          {group.platform === 'MAX' && (
                            <>
                              <option value="Post">MAX Post</option>
                              <option value="Integration">MAX Integration</option>
                            </>
                          )}
                        </select>

                        {/* Delete group button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSlotGroups(slotGroups.filter((_, idx) => idx !== index));
                          }}
                          className="text-red-500 hover:bg-neutral-100 p-1 rounded text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add group button */}
                  <button
                    type="button"
                    onClick={() => {
                      const currentSum = slotGroups.reduce((acc, g) => acc + g.quantity, 0);
                      if (currentSum + 1 > slotsCount) {
                        alert(lang === 'ru' 
                          ? `Количество настроенных слотов не должно превышать общее количество (${slotsCount})!` 
                          : lang === 'uz' 
                          ? `Sozlangan slotlar soni umumiy slotlar sonidan (${slotsCount}) oshib ketmasligi kerak!` 
                          : `Configured slots count cannot exceed total slots count (${slotsCount})!`
                        );
                        return;
                      }
                      setSlotGroups([...slotGroups, { quantity: 1, platform: platform, format: getDefaultFormat(platform) }]);
                    }}
                    className="w-full py-1.5 text-[10px] font-extrabold text-neutral-600 hover:text-black border border-dashed border-neutral-300 rounded hover:border-neutral-400 bg-white transition"
                  >
                    + {lang === 'ru' ? 'Добавить группу слотов' : lang === 'uz' ? 'Slotlar guruhini qo‘shish' : 'Add Slot Group'}
                  </button>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddIntegrationModal(false);
                    setEditingIntegration(null);
                  }}
                  className="flex-1 py-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold text-xs rounded-lg transition duration-150"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-lg transition duration-150"
                >
                  {editingIntegration ? t.saveChangesBtn : t.addIntegrationBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Integration Info Modal */}
      {selectedIntegrationForDetails && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all duration-200 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] text-left border border-neutral-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <div>
                <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">
                  {t.integrationDetailsTitle || 'Integration Details'}
                </span>
                <span className="font-extrabold text-[13px] text-black uppercase tracking-tight">
                  {selectedIntegrationForDetails.bloggerName || ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIntegrationForDetails(null)}
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
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">{t.platformColumn || 'Platform'}</p>
                  <p className="font-bold text-neutral-800 mt-0.5">
                    {selectedIntegrationForDetails.platform || ''}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">
                    {(t.startDateColumn || 'Start Date') + ' / ' + (t.endDateColumn || 'End Date')}
                  </p>
                  <p className="font-bold text-neutral-800 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                    {(selectedIntegrationForDetails.startDate || '') + ' — ' + (selectedIntegrationForDetails.endDate || '')}
                  </p>
                </div>
              </div>

              {/* Financial Metrics */}
              <div className="border border-neutral-100 rounded-xl p-4 space-y-2.5">
                <h4 className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider border-b border-neutral-50 pb-1.5">
                  Финансы / Financials
                </h4>
                <div className="space-y-1.5">
                  <div className="flex justify-between py-0.5">
                    <span className="text-neutral-500">{t.priceColumn || 'Price'}:</span>
                    <span className="font-bold text-neutral-800">
                      {Number(selectedIntegrationForDetails.pricePerSlot || 0).toLocaleString('ru-RU')} UZS
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-neutral-500">{t.slotsColumn || 'Slots'}:</span>
                    <span className="font-bold text-neutral-800">
                      {Number(selectedIntegrationForDetails.slotsCount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5 border-t border-neutral-50 pt-1.5">
                    <span className="text-neutral-500">{t.totalSumColumn || 'Total Sum'}:</span>
                    <span className="font-black text-black">
                      {Number(selectedIntegrationForDetails.totalAmount || 0).toLocaleString('ru-RU')} UZS
                    </span>
                  </div>
                  {(allowedMetrics || []).includes('financial_metrics') && (
                    <>
                      <div className="flex justify-between py-0.5">
                        <span className="text-neutral-500">{t.metricPaidToBlogger || 'Paid'}:</span>
                        <span className="font-extrabold text-emerald-600">
                          {Number(selectedIntegrationForDetails.paidAmount || 0).toLocaleString('ru-RU')} UZS
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-t border-neutral-50 pt-1.5">
                        <span className="text-neutral-500 font-bold">{t.metricRemainingToPay || 'Remaining'}:</span>
                        <span className="font-black text-rose-600">
                          {Math.max(0, Number(selectedIntegrationForDetails.totalAmount || 0) - Number(selectedIntegrationForDetails.paidAmount || 0)).toLocaleString('ru-RU')} UZS
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Links */}
              <div className="space-y-3">
                {selectedIntegrationForDetails.referralLink && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">{t.referralLinkField || 'UTM Link'}</p>
                    <div className="flex items-center gap-2 bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                      <span className="font-mono text-neutral-800 font-medium break-all flex-1 select-all">{selectedIntegrationForDetails.referralLink}</span>
                      <a
                        href={selectedIntegrationForDetails.referralLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 bg-white hover:bg-neutral-100 rounded border border-neutral-200 text-neutral-600 transition shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">
                    {lang === 'ru' ? 'Ссылка для отчета блогера' : lang === 'uz' ? 'Blogger hisoboti havolasi' : 'Blogger Execution Report Link'}
                  </p>
                  {(() => {
                    const cabinetUrl = `${window.location.origin}/?cabinet=true&id=${selectedIntegrationForDetails.bloggerCabinetToken || selectedIntegrationForDetails.id}`;
                    return (
                      <div className="flex items-center gap-2 bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                        <span className="font-mono text-neutral-800 font-medium break-all flex-1 select-all">{cabinetUrl}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(cabinetUrl);
                            alert(lang === 'ru' ? 'Ссылка скопирована!' : lang === 'uz' ? 'Havola nusxalandi!' : 'Link copied!');
                          }}
                          className="p-1 bg-white hover:bg-neutral-100 rounded border border-neutral-200 text-neutral-600 transition shrink-0 cursor-pointer"
                          title="Copy link"
                        >
                          <Link className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Slots deliverables / submissions list */}
              {selectedIntegrationForDetails.slotsConfig && Array.isArray(selectedIntegrationForDetails.slotsConfig) && selectedIntegrationForDetails.slotsConfig.length > 0 && (
                <div className="border border-neutral-100 rounded-xl p-4 space-y-2.5">
                  <h4 className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider border-b border-neutral-50 pb-1.5">
                    Публикации / Deliverables
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedIntegrationForDetails.slotsConfig.map((slot, index) => {
                      if (!slot) return null;
                      const sub = (Array.isArray(submissions) ? submissions : []).find(s => String(s.integrationId) === String(selectedIntegrationForDetails.id));
                      const slotKey = `slot_${index + 1}`;
                      const submissionUrl = (sub && sub.data) ? sub.data[slotKey] : undefined;

                      return (
                        <div key={index} className="flex justify-between items-center py-1.5 border-b border-neutral-50 last:border-b-0">
                          <div>
                            <span className="font-bold text-neutral-700">{(t.slotNumberLabel || 'Slot') + ' #' + (index + 1)}: </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-neutral-100 border border-neutral-200">
                              {slot.platform || ''} {slot.format || ''}
                            </span>
                          </div>
                          <div>
                            {submissionUrl ? (
                              <a
                                href={submissionUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-600 hover:underline"
                              >
                                <span>{t.publicationLinkLabel || 'Link'}</span>
                                <ExternalLink className="w-3 h-3 text-blue-500" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-neutral-400 italic font-medium">{t.notPublishedLabel || 'Not published'}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
              {/* Actions: Edit & Delete */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIntegrationForDetails(null);
                    openEditIntegration(selectedIntegrationForDetails);
                  }}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-[10px] uppercase tracking-wide rounded-lg transition flex items-center gap-1 cursor-pointer border border-neutral-200"
                >
                  <Edit3 className="w-3.5 h-3.5 text-neutral-600" />
                  <span>{lang === 'ru' ? 'Редактировать' : lang === 'uz' ? 'Tahrirlash' : 'Edit'}</span>
                </button>
                {userRole === 'super_admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t.confirmDeleteIntegration)) {
                        onDeleteIntegration(selectedIntegrationForDetails.id);
                        setSelectedIntegrationForDetails(null);
                      }
                    }}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] uppercase tracking-wide rounded-lg transition flex items-center gap-1 cursor-pointer border border-red-100"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>{lang === 'ru' ? 'Удалить' : lang === 'uz' ? 'O‘chirish' : 'Delete'}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedIntegrationForDetails(null)}
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
