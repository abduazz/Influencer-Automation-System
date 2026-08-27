/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AllowedUser, Project } from '../data/mockData';
import { translations, Language } from '../translations';
import { Users, UserPlus, Shield, Mail, Trash2, Key, Info, Pencil, FolderKanban, ChevronDown, ChevronUp, Search, Filter, Layout, BarChart2 } from 'lucide-react';

interface AccessManagementViewProps {
  allowedUsers: AllowedUser[];
  projects?: Project[];
  onAddUser: (name: string, email: string, role: AllowedUser['role'], allowedMetrics?: string[], allowedPages?: string[], allowedProjects?: string[]) => Promise<void>;
  onEditUser: (id: string, name: string, role: AllowedUser['role'], allowedMetrics?: string[], allowedPages?: string[], allowedProjects?: string[]) => Promise<void>;
  onRemoveUser: (id: string) => Promise<void>;
  currentUserEmail: string;
  lang: Language;
}

export default function AccessManagementView({
  allowedUsers,
  projects = [],
  onAddUser,
  onEditUser,
  onRemoveUser,
  currentUserEmail,
  lang,
}: AccessManagementViewProps) {
  const t = translations[lang];

  // Form states
  const [editingUser, setEditingUser] = useState<AllowedUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<AllowedUser['role']>('pr_manager');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Allowed Metrics state
  const [metricsPermissions, setMetricsPermissions] = useState<Record<string, boolean>>({
    deals: true,
    spend: true,
    total_slots: true,
    slots_published: true,
    slots_remaining: true,
    financial_metrics: true,
    set_limit: false
  });

  // Allowed Pages state
  const [pagesPermissions, setPagesPermissions] = useState<Record<string, boolean>>({
    super_admin: false,
    projects: true,
    bloggers: true,
    reports: true,
    bulk_purchases: true,
    reports_feed: true,
    other_expenses: true
  });

  // Allowed Projects state
  const [projectsPermissions, setProjectsPermissions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (projects || []).forEach(p => { initial[p.id] = true; });
    return initial;
  });

  // Accordion state
  const [openAccordion, setOpenAccordion] = useState<'projects' | 'pages' | 'metrics' | null>('projects');

  // Search & Role filter for active users list
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');

  const selectedProjectsCount = Object.values(projectsPermissions).filter(Boolean).length;
  const selectedPagesCount = Object.values(pagesPermissions).filter(Boolean).length;
  const selectedMetricsCount = Object.values(metricsPermissions).filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg(lang === 'ru' ? 'Пожалуйста, введите имя!' : lang === 'uz' ? 'Iltimos, ismni kiriting!' : 'Please enter a name!');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    if (!editingUser) {
      // Validate email format or handle (e.g. chief1)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidEmail = emailRegex.test(cleanEmail) || !cleanEmail.includes('@');
      if (!isValidEmail) {
        setErrorMsg(lang === 'ru' ? 'Некорректный формат email или логина!' : lang === 'uz' ? 'Email yoki login formati noto‘g‘ri!' : 'Invalid email or handle format!');
        return;
      }

      // Check if email already exists in list (case-insensitive)
      const exists = allowedUsers.some((u) => u.email.toLowerCase() === cleanEmail || u.email.toLowerCase() === `${cleanEmail}@tezi.uz`);
      if (exists) {
        setErrorMsg(t.emailAlreadyExists);
        return;
      }
    }

    const resolvedEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@tezi.uz`;

    const allowedMetrics = Object.entries(metricsPermissions)
      .filter(([_, allowed]) => allowed)
      .map(([name]) => name);

    const allowedPages = Object.entries(pagesPermissions)
      .filter(([_, allowed]) => allowed)
      .map(([name]) => name);

    const allowedProjects = Object.entries(projectsPermissions)
      .filter(([_, allowed]) => allowed)
      .map(([id]) => id);

    const determinedRole = selectedRole;

    try {
      if (editingUser) {
        await onEditUser(editingUser.id, cleanName, determinedRole, allowedMetrics, allowedPages, allowedProjects);
        setSuccessMsg(
          lang === 'ru'
            ? 'Доступ успешно обновлен!'
            : lang === 'uz'
            ? 'Ruxsat muvaffaqiyatli yangilandi!'
            : 'Access updated successfully!'
        );
        setEditingUser(null);
      } else {
        await onAddUser(cleanName, resolvedEmail, determinedRole, allowedMetrics, allowedPages, allowedProjects);
        setSuccessMsg(t.addSuccessToast.replace('{email}', resolvedEmail));
      }

      setEmail('');
      setName('');
      setSelectedRole('pr_manager');
      setMetricsPermissions({
        deals: true,
        spend: true,
        total_slots: true,
        slots_published: true,
        slots_remaining: true,
        financial_metrics: true,
        set_limit: false
      });
      setPagesPermissions({
        super_admin: false,
        projects: true,
        bloggers: true,
        reports: true,
        bulk_purchases: true,
        reports_feed: true,
        other_expenses: true
      });
      const resetProjects: Record<string, boolean> = {};
      (projects || []).forEach(p => { resetProjects[p.id] = true; });
      setProjectsPermissions(resetProjects);

      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.toLowerCase().includes('already exists') || message.toLowerCase().includes('taken')) {
        setErrorMsg(t.emailAlreadyExists);
      } else {
        setErrorMsg(
          lang === 'ru'
            ? `Не удалось сохранить доступ: ${message || 'Проверьте подключение к серверу.'}`
            : lang === 'uz'
            ? `Ruxsatni saqlab bo‘lmadi: ${message || 'Server bilan ulanishni tekshiring.'}`
            : `Failed to save access: ${message || 'Please check server connection.'}`
        );
      }
    }
  };

  const handleDelete = async (user: AllowedUser) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (user.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      setErrorMsg(t.cannotDeleteSelf);
      return;
    }

    const confirmMsg = lang === 'ru' 
      ? `Вы уверены, что хотите закрыть доступ для ${user.email}?` 
      : lang === 'uz' 
      ? `Haqiqatan ham ${user.email} uchun ruxsatni bekor qilmoqchimisiz?` 
      : `Are you sure you want to revoke access for ${user.email}?`;

    if (confirm(confirmMsg)) {
      try {
        await onRemoveUser(user.id);
        setSuccessMsg(t.removeSuccessToast);

        setTimeout(() => {
          setSuccessMsg(null);
        }, 4000);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        setErrorMsg(
          lang === 'ru'
            ? `Не удалось удалить доступ: ${message || 'Проверьте подключение к серверу.'}`
            : lang === 'uz'
            ? `Ruxsatni o‘chirib bo‘lmadi: ${message || 'Server bilan ulanishni tekshiring.'}`
            : `Failed to revoke access: ${message || 'Please check server connection.'}`
        );
      }
    }
  };

  const getRoleBadgeColor = (userRole: string) => {
    switch (userRole) {
      case 'super_admin':
        return 'bg-neutral-900 text-white border-neutral-900';
      case 'pr_manager':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'product_manager':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'executive':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-neutral-50 text-neutral-600 border-neutral-200';
    }
  };

  const getRoleLabel = (userRole: string) => {
    switch (userRole) {
      case 'super_admin':
        return t.roleSuperAdmin;
      case 'pr_manager':
        return t.rolePRManager;
      case 'product_manager':
        return t.roleProductManager;
      case 'executive':
        return t.roleExecutive;
      default:
        return userRole;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-5 text-left">
        <div>
          <h2 className="text-xl font-black text-black tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-black" />
            {t.accessManagementTitle}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {t.accessManagementDesc}
          </p>
        </div>
      </div>

      {/* Success / Error Banners */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold text-left animate-fade-in">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-bold text-left animate-fade-in">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Grant New Access */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-left shadow-2xs h-fit space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <UserPlus className="w-4 h-4 text-black" />
            <h3 className="font-bold text-black text-xs uppercase tracking-wider">
              {editingUser
                ? (lang === 'ru' ? 'Редактировать доступ' : lang === 'uz' ? 'Ruxsatni tahrirlash' : 'Edit Access')
                : t.addUserBtn}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                {t.userNameLabel}
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.userNamePlaceholder}
                  className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-black focus:outline-hidden transition duration-150"
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                {t.userEmailLabel}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={lang === 'ru' ? 'Email или логин (например chief1)...' : lang === 'uz' ? 'Email yoki login (masalan chief1)...' : 'Email or handle (e.g. chief1)...'}
                  className={`w-full border focus:border-black focus:bg-white rounded-lg pl-9 pr-3 py-2 text-xs font-medium focus:outline-hidden transition duration-150 ${
                    editingUser
                      ? 'bg-neutral-100 border-neutral-200 text-neutral-450 cursor-not-allowed'
                      : 'bg-neutral-50 border-neutral-200 text-black'
                  }`}
                  required
                  disabled={!!editingUser}
                />
              </div>
            </div>

            {/* Role Selection Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                {t.userRoleLabel}
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AllowedUser['role'])}
                className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-lg px-3 py-2 text-xs font-medium text-black focus:outline-hidden transition duration-150"
              >
                <option value="pr_manager">{t.rolePRManager}</option>
                <option value="product_manager">{t.roleProductManager}</option>
                <option value="executive">{t.roleExecutive}</option>
                <option value="super_admin">{t.roleSuperAdmin}</option>
              </select>
            </div>
                            {/* Accordion 1: Allowed Projects */}
            <div className="border border-neutral-200/80 rounded-xl overflow-hidden bg-neutral-50/50">
              <button
                type="button"
                onClick={() => setOpenAccordion(prev => prev === 'projects' ? null : 'projects')}
                className="w-full px-3.5 py-2.5 flex items-center justify-between bg-white hover:bg-neutral-50 transition cursor-pointer text-left border-b border-neutral-100"
              >
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-black shrink-0" />
                  <span className="text-xs font-bold text-neutral-900">
                    {lang === 'ru' ? 'Доступные проекты' : lang === 'uz' ? 'Ruxsat berilgan loyihalar' : 'Allowed Projects'}
                  </span>
                  <span className="text-[9px] font-extrabold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                    {projects.length > 0 ? `${selectedProjectsCount}/${projects.length}` : '0'}
                  </span>
                </div>
                {openAccordion === 'projects' ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </button>

              {openAccordion === 'projects' && (
                <div className="p-3 space-y-2.5 bg-neutral-50/40 animate-fade-in">
                  <div className="flex items-center justify-end">
                    {projects.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = projects.every(p => projectsPermissions[p.id]);
                          const newState: Record<string, boolean> = {};
                          projects.forEach(p => { newState[p.id] = !allSelected; });
                          setProjectsPermissions(newState);
                        }}
                        className="text-[9px] font-bold text-neutral-500 hover:text-black transition cursor-pointer lowercase"
                      >
                        {projects.every(p => projectsPermissions[p.id]) 
                          ? (lang === 'ru' ? 'снять все' : lang === 'uz' ? 'barchasini yechish' : 'deselect all')
                          : (lang === 'ru' ? 'выбрать все' : lang === 'uz' ? 'barchasini tanlash' : 'select all')}
                      </button>
                    )}
                  </div>

                  {projects.length === 0 ? (
                    <p className="text-[11px] text-neutral-400 italic p-2 bg-white rounded-lg border border-neutral-200/60">
                      {lang === 'ru' ? 'Проекты пока не созданы.' : lang === 'uz' ? 'Hali loyihalar yaratilmadi.' : 'No projects created yet.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {projects.map((proj) => {
                        const isChecked = projectsPermissions[proj.id] ?? true;

                        return (
                          <div key={proj.id} className="flex items-center justify-between p-2 rounded-lg border border-neutral-200/70 bg-white hover:border-neutral-300 transition">
                            <span className="text-[10px] font-bold text-neutral-800 truncate pr-1" title={proj.name}>
                              {proj.name}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setProjectsPermissions(prev => ({
                                  ...prev,
                                  [proj.id]: !prev[proj.id]
                                }));
                              }}
                              className={`w-7 h-3.5 rounded-full transition duration-200 relative shrink-0 ${
                                isChecked ? 'bg-black' : 'bg-neutral-200'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full bg-white absolute top-0.5 transition duration-200 shadow-xs ${
                                isChecked ? 'right-0.5' : 'left-0.5'
                              }`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Accordion 2: Allowed Pages */}
            <div className="border border-neutral-200/80 rounded-xl overflow-hidden bg-neutral-50/50">
              <button
                type="button"
                onClick={() => setOpenAccordion(prev => prev === 'pages' ? null : 'pages')}
                className="w-full px-3.5 py-2.5 flex items-center justify-between bg-white hover:bg-neutral-50 transition cursor-pointer text-left border-b border-neutral-100"
              >
                <div className="flex items-center gap-2">
                  <Layout className="w-4 h-4 text-black shrink-0" />
                  <span className="text-xs font-bold text-neutral-900">
                    {lang === 'ru' ? 'Доступные страницы' : lang === 'uz' ? 'Ruxsat berilgan bo‘limlar' : 'Allowed Menu Pages'}
                  </span>
                  <span className="text-[9px] font-extrabold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                    {selectedPagesCount}/7
                  </span>
                </div>
                {openAccordion === 'pages' ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </button>

              {openAccordion === 'pages' && (
                <div className="p-3 space-y-2 bg-neutral-50/40 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: 'super_admin', label: t.pageSuperAdmin },
                      { key: 'projects', label: t.pageProjects },
                      { key: 'bloggers', label: t.pageBloggers },
                      { key: 'reports', label: t.pageReports },
                      { key: 'bulk_purchases', label: lang === 'ru' ? 'Оптовые закупки' : lang === 'uz' ? 'Ommaviy xaridlar' : 'Bulk Purchases' },
                      { key: 'reports_feed', label: t.pageReportsFeed },
                      { key: 'other_expenses', label: t.pageOtherExpenses },
                    ].map((p) => {
                      const isChecked = pagesPermissions[p.key];

                      return (
                        <div key={p.key} className="flex items-center justify-between p-2 rounded-lg border border-neutral-200/70 bg-white hover:border-neutral-300 transition">
                          <span className="text-[10px] font-bold text-neutral-800 truncate pr-1">{p.label}</span>

                          <button
                            type="button"
                            onClick={() => {
                              setPagesPermissions(prev => ({
                                ...prev,
                                [p.key]: !prev[p.key]
                              }));
                            }}
                            className={`w-7 h-3.5 rounded-full transition duration-200 relative shrink-0 ${
                              isChecked ? 'bg-black' : 'bg-neutral-200'
                            }`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full bg-white absolute top-0.5 transition duration-200 shadow-xs ${
                              isChecked ? 'right-0.5' : 'left-0.5'
                            }`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Allowed Metrics */}
            <div className="border border-neutral-200/80 rounded-xl overflow-hidden bg-neutral-50/50">
              <button
                type="button"
                onClick={() => setOpenAccordion(prev => prev === 'metrics' ? null : 'metrics')}
                className="w-full px-3.5 py-2.5 flex items-center justify-between bg-white hover:bg-neutral-50 transition cursor-pointer text-left border-b border-neutral-100"
              >
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-black shrink-0" />
                  <span className="text-xs font-bold text-neutral-900">
                    {lang === 'ru' ? 'Метрики дешборда' : lang === 'uz' ? 'Boshqaruv ko‘rsatkichlari' : 'Dashboard Metrics'}
                  </span>
                  <span className="text-[9px] font-extrabold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                    {selectedMetricsCount}/7
                  </span>
                </div>
                {openAccordion === 'metrics' ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </button>

              {openAccordion === 'metrics' && (
                <div className="p-3 space-y-2 bg-neutral-50/40 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: 'deals', labelRu: 'Сделки', labelUz: 'Bitimlar', labelEn: 'Deals' },
                      { key: 'spend', labelRu: 'Расходы', labelUz: 'Xarajatlar', labelEn: 'Spend' },
                      { key: 'total_slots', labelRu: 'Всего слотов', labelUz: 'Jami slotlar', labelEn: 'Total Slots' },
                      { key: 'slots_published', labelRu: 'Слотов сдано', labelUz: 'Bajarilgan slotlar', labelEn: 'Published' },
                      { key: 'slots_remaining', labelRu: 'Остаток слотов', labelUz: 'Qolgan slotlar', labelEn: 'Remaining' },
                      { key: 'financial_metrics', labelRu: 'Выплаты', labelUz: 'To‘lovlar', labelEn: 'Payouts' },
                      { key: 'set_limit', labelRu: 'Лимиты', labelUz: 'Limitlar', labelEn: 'Set Limits' },
                    ].map((m) => {
                      const isChecked = metricsPermissions[m.key];
                      const label = lang === 'ru' ? m.labelRu : lang === 'uz' ? m.labelUz : m.labelEn;

                      return (
                        <div key={m.key} className="flex items-center justify-between p-2 rounded-lg border border-neutral-200/70 bg-white hover:border-neutral-300 transition">
                          <span className="text-[10px] font-bold text-neutral-800 truncate pr-1">{label}</span>

                          <button
                            type="button"
                            onClick={() => {
                              setMetricsPermissions(prev => ({
                                ...prev,
                                [m.key]: !prev[m.key]
                              }));
                            }}
                            className={`w-7 h-3.5 rounded-full transition duration-200 relative shrink-0 ${
                              isChecked ? 'bg-black' : 'bg-neutral-200'
                            }`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full bg-white absolute top-0.5 transition duration-200 shadow-xs ${
                              isChecked ? 'right-0.5' : 'left-0.5'
                            }`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Helper Explaining Roles */}
            <div className="p-3 bg-neutral-50 rounded-lg text-[11px] text-neutral-500 space-y-1 border border-neutral-100">
              <div className="flex items-center gap-1 font-bold text-neutral-700">
                <Info className="w-3.5 h-3.5 text-neutral-400" />
                <span>{lang === 'ru' ? 'Права доступа:' : lang === 'uz' ? 'Ruxsat darajalari:' : 'Access Info:'}</span>
              </div>
              <p>• <strong>{t.roleSuperAdmin}</strong>: {lang === 'ru' ? 'Полный доступ ко всем настройкам и проектам.' : lang === 'uz' ? 'Barcha sozlamalar va loyihalarga to‘liq kirish.' : 'Full system privileges.'}</p>
              <p>• <strong>{t.roleExecutive}</strong>: {lang === 'ru' ? 'Сводный дешборд бюджета и аналитики руководства.' : lang === 'uz' ? 'Rahbariyat moliyaviy va o‘zlashtirish hisoboti.' : 'Executive high-level budget overview.'}</p>
              <p>• <strong>{t.rolePRManager}</strong>: {lang === 'ru' ? 'Доступ к рабочим проектам и созданию отчетов.' : lang === 'uz' ? 'Loyihalar paneli va hisobotlar yaratish.' : 'Dashboard and report logging.'}</p>
              <p>• <strong>{t.roleProductManager}</strong>: {lang === 'ru' ? 'Доступ только к избранным проектам (без отчетов).' : lang === 'uz' ? 'Faqat tanlangan loyihalar paneliga kirish.' : 'Dashboard view only.'}</p>
            </div>

            {editingUser ? (
              <div className="flex gap-2 w-full">
                <button
                  type="submit"
                  className="w-1/2 bg-black hover:bg-neutral-800 text-white font-extrabold text-xs py-2.5 rounded-lg transition duration-150 shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  {t.saveChangesBtn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    setName('');
                    setEmail('');
                    setMetricsPermissions({
                      deals: true,
                      spend: true,
                      total_slots: true,
                      slots_published: true,
                      slots_remaining: true,
                      financial_metrics: true,
                      set_limit: false
                    });
                    setPagesPermissions({
                      super_admin: false,
                      projects: true,
                      reports: true,
                      reports_feed: true,
                      other_expenses: true
                    });
                  }}
                  className="w-1/2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-extrabold text-xs py-2.5 rounded-lg transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
              </div>
            ) : (
              <button
                type="submit"
                className="w-full bg-black hover:bg-neutral-800 text-white font-extrabold text-xs py-2.5 rounded-lg transition duration-150 shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                {t.addUserBtn}
              </button>
            )}
          </form>
        </div>

        {/* List of Active Authorized Members */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-left shadow-2xs lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-black" />
              <h3 className="font-bold text-black text-xs uppercase tracking-wider">{t.activeUsersTitle}</h3>
              <span className="text-[10px] font-black bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                {allowedUsers.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder={lang === 'ru' ? 'Поиск пользователя...' : lang === 'uz' ? 'Qidirish...' : 'Search user...'}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium focus:bg-white focus:border-black focus:outline-none transition"
              />
            </div>
          </div>

          {/* Role Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-neutral-100 text-[10px] font-bold">
            <span className="text-neutral-400 uppercase tracking-wider mr-1 text-[9px]">
              {lang === 'ru' ? 'Фильтр:' : lang === 'uz' ? 'Filtr:' : 'Filter:'}
            </span>
            {[
              { key: 'all', labelRu: 'Все', labelUz: 'Barchasi', labelEn: 'All' },
              { key: 'super_admin', labelRu: 'Админы', labelUz: 'Adminlar', labelEn: 'Admins' },
              { key: 'executive', labelRu: 'Руководство', labelUz: 'Rahbariyat', labelEn: 'Executives' },
              { key: 'pr_manager', labelRu: 'PR Менеджеры', labelUz: 'PR Menejerlar', labelEn: 'PR Managers' },
              { key: 'product_manager', labelRu: 'Product Менеджеры', labelUz: 'Product Menejerlar', labelEn: 'Product Managers' },
            ].map((f) => {
              const isActive = userRoleFilter === f.key;
              const label = lang === 'ru' ? f.labelRu : lang === 'uz' ? f.labelUz : f.labelEn;

              return (
                <button
                  key={f.key}
                  onClick={() => setUserRoleFilter(f.key)}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    isActive
                      ? 'bg-black text-white font-extrabold shadow-2xs'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                  <th className="py-2.5 px-4">{lang === 'ru' ? 'Сотрудник' : lang === 'uz' ? 'Xodim' : 'Member'}</th>
                  <th className="py-2.5 px-4">{lang === 'ru' ? 'Дата добавления' : lang === 'uz' ? 'Qo‘shilgan sana' : 'Date Authorized'}</th>
                  <th className="py-2.5 px-4 text-right">{t.actionsColumn}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-700">
                {allowedUsers
                  .filter((user) => {
                    const matchesSearch = !userSearchQuery ||
                      (user.name && user.name.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
                      user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
                    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
                    return matchesSearch && matchesRole;
                  })
                  .map((user) => {
                  const isSelf = user.email.toLowerCase() === currentUserEmail.toLowerCase();
                  return (
                    <tr key={user.id} className="hover:bg-neutral-50/30 transition duration-150">
                      <td className="py-3 px-4">
                        <div className="flex flex-col text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-neutral-900">{user.name || user.email.split('@')[0]}</span>
                            {isSelf && (
                              <span className="text-[8px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.2 animate-pulse">
                                {lang === 'ru' ? 'ВЫ' : lang === 'uz' ? 'SIZ' : 'YOU'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-400 font-semibold">{user.email}</span>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(user.allowedPages || ['projects', 'reports', 'reports_feed', 'other_expenses']).map((pageKey) => {
                              let pageLabel = pageKey;
                              if (pageKey === 'super_admin') pageLabel = t.pageSuperAdmin;
                              else if (pageKey === 'projects') pageLabel = t.pageProjects;
                              else if (pageKey === 'reports') pageLabel = t.pageReports;
                              else if (pageKey === 'reports_feed') pageLabel = t.pageReportsFeed;
                              else if (pageKey === 'other_expenses') pageLabel = t.pageOtherExpenses;
                              return (
                                <span key={pageKey} className="text-[8px] font-bold bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                                  {pageLabel}
                                </span>
                              );
                            })}
                            {/* Project Access Badges */}
                            {user.allowedProjects && user.allowedProjects.length > 0 && user.allowedProjects.length < projects.length ? (
                              user.allowedProjects.map((pId) => {
                                const pObj = projects.find(p => p.id === pId);
                                if (!pObj) return null;
                                return (
                                  <span key={pId} className="text-[8px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                                    {pObj.name}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[8px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                                {lang === 'ru' ? 'Все проекты' : lang === 'uz' ? 'Barcha loyihalar' : 'All Projects'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-neutral-500 text-[11px]">
                        {user.createdAt}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setName(user.name || '');
                              setEmail(user.email);
                              setSelectedRole(user.role);
                              
                              // Load metrics
                              const defaultMetrics = ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'];
                              const userMetrics = user.allowedMetrics || defaultMetrics;
                              setMetricsPermissions({
                                deals: userMetrics.includes('deals'),
                                spend: userMetrics.includes('spend'),
                                total_slots: userMetrics.includes('total_slots'),
                                slots_published: userMetrics.includes('slots_published'),
                                slots_remaining: userMetrics.includes('slots_remaining'),
                                financial_metrics: userMetrics.includes('financial_metrics'),
                                set_limit: userMetrics.includes('set_limit'),
                              });

                              // Load pages
                              const defaultPages = ['projects', 'reports', 'reports_feed', 'other_expenses'];
                              const userPages = user.allowedPages || defaultPages;
                              setPagesPermissions({
                                super_admin: user.role === 'super_admin' || userPages.includes('super_admin'),
                                projects: userPages.includes('projects'),
                                reports: userPages.includes('reports'),
                                reports_feed: userPages.includes('reports_feed'),
                                other_expenses: userPages.includes('other_expenses'),
                              });

                              // Load allowed projects
                              const userProjects = user.allowedProjects;
                              const projPerms: Record<string, boolean> = {};
                              (projects || []).forEach(p => {
                                projPerms[p.id] = !userProjects || userProjects.length === 0 || userProjects.includes(p.id);
                              });
                              setProjectsPermissions(projPerms);
                            }}
                            className="p-1.5 rounded text-neutral-400 hover:text-black hover:bg-neutral-100 transition duration-150 cursor-pointer"
                            title={lang === 'ru' ? 'Редактировать' : lang === 'uz' ? 'Tahrirlash' : 'Edit'}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={isSelf}
                            className={`p-1.5 rounded transition duration-150 ${
                              isSelf
                                ? 'text-neutral-300 cursor-not-allowed'
                                : 'text-neutral-400 hover:text-black hover:bg-neutral-100 cursor-pointer'
                            }`}
                            title={isSelf ? t.cannotDeleteSelf : t.revokeAccessBtn}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
