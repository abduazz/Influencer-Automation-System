/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AllowedUser } from '../data/mockData';
import { translations, Language } from '../translations';
import { Users, UserPlus, Shield, Mail, Trash2, Key, Info, Pencil } from 'lucide-react';

interface AccessManagementViewProps {
  allowedUsers: AllowedUser[];
  onAddUser: (name: string, email: string, role: 'super_admin' | 'pr_manager' | 'product_manager', allowedMetrics?: string[]) => Promise<void>;
  onEditUser: (id: string, name: string, role: 'super_admin' | 'pr_manager' | 'product_manager', allowedMetrics?: string[]) => Promise<void>;
  onRemoveUser: (id: string) => Promise<void>;
  currentUserEmail: string;
  lang: Language;
}

export default function AccessManagementView({
  allowedUsers,
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
  const [role, setRole] = useState<'super_admin' | 'pr_manager' | 'product_manager'>('pr_manager');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Allowed Metrics state
  const [metricsPermissions, setMetricsPermissions] = useState<Record<string, boolean>>({
    deals: true,
    spend: true,
    total_slots: true,
    slots_published: true,
    slots_remaining: true,
    financial_metrics: true
  });

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
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setErrorMsg(lang === 'ru' ? 'Некорректный формат email!' : lang === 'uz' ? 'Email formati noto‘g‘ri!' : 'Invalid email format!');
        return;
      }

      // Check if email already exists in list (case-insensitive)
      const exists = allowedUsers.some((u) => u.email.toLowerCase() === cleanEmail);
      if (exists) {
        setErrorMsg(t.emailAlreadyExists);
        return;
      }
    }

    const allowedMetrics = Object.entries(metricsPermissions)
      .filter(([_, allowed]) => allowed)
      .map(([name]) => name);

    try {
      if (editingUser) {
        await onEditUser(editingUser.id, cleanName, role, allowedMetrics);
        setSuccessMsg(
          lang === 'ru'
            ? 'Доступ успешно обновлен!'
            : lang === 'uz'
            ? 'Ruxsat muvaffaqiyatli yangilandi!'
            : 'Access updated successfully!'
        );
        setEditingUser(null);
      } else {
        await onAddUser(cleanName, cleanEmail, role, allowedMetrics);
        setSuccessMsg(t.addSuccessToast.replace('{email}', cleanEmail));
      }

      setEmail('');
      setName('');
      setMetricsPermissions({
        deals: true,
        spend: true,
        total_slots: true,
        slots_published: true,
        slots_remaining: true,
        financial_metrics: true
      });

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
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.userEmailPlaceholder}
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

            {/* Role Picker Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                {t.userRoleLabel}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-lg px-3 py-2 text-xs font-bold text-black focus:outline-hidden transition duration-150"
              >
                <option value="pr_manager">{t.rolePRManager}</option>
                <option value="product_manager">{t.roleProductManager}</option>
                <option value="super_admin">{t.roleSuperAdmin}</option>
              </select>
            </div>

            {/* Allowed Dashboard Metrics Checklist */}
            <div className="space-y-2 border-t border-neutral-100 pt-3">
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                {lang === 'ru' ? 'Разрешенные метрики на дешборде:' : lang === 'uz' ? 'Ruxsat berilgan ko‘rsatkichlar:' : 'Allowed Dashboard Metrics:'}
              </label>
              
              <div className="space-y-2">
                {[
                  { key: 'deals', labelRu: 'Сделки с блогерами', labelUz: 'Bloggerlar bilan bitimlar', labelEn: 'Blogger Deals' },
                  { key: 'spend', labelRu: 'Бюджет проекта (Расходы)', labelUz: 'Loyiha budjeti (Xarajatlar)', labelEn: 'Allocated Spend' },
                  { key: 'total_slots', labelRu: 'Всего куплено слотов', labelUz: 'Jami sotib olingan slotlar', labelEn: 'Total Slots' },
                  { key: 'slots_published', labelRu: 'Выполнено слотов', labelUz: 'Bajarilgan slotlar', labelEn: 'Slots Published' },
                  { key: 'slots_remaining', labelRu: 'Осталось выполнить слотов', labelUz: 'Bajarilishi kerak bo‘lgan slotlar', labelEn: 'Slots Remaining' },
                  { key: 'financial_metrics', labelRu: 'Выплаты блогерам (таблица)', labelUz: 'Bloggerlar to‘lovlari (jadval)', labelEn: 'Blogger Payouts (table)' },
                ].map((m) => {
                  const isChecked = metricsPermissions[m.key];
                  const label = lang === 'ru' ? m.labelRu : lang === 'uz' ? m.labelUz : m.labelEn;
                  
                  return (
                    <div key={m.key} className="flex items-center justify-between p-2 rounded-lg border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 transition duration-100">
                      <span className="text-[11px] font-semibold text-neutral-850">{label}</span>
                      
                      {/* Premium Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => {
                          setMetricsPermissions(prev => ({
                            ...prev,
                            [m.key]: !prev[m.key]
                          }));
                        }}
                        className={`w-8 h-4 rounded-full transition duration-200 relative ${
                          isChecked ? 'bg-black' : 'bg-neutral-250'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition duration-200 shadow-xs ${
                          isChecked ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Helper Explaining Roles */}
            <div className="p-3 bg-neutral-50 rounded-lg text-[11px] text-neutral-500 space-y-1 border border-neutral-100">
              <div className="flex items-center gap-1 font-bold text-neutral-700">
                <Info className="w-3.5 h-3.5 text-neutral-400" />
                <span>{lang === 'ru' ? 'Права доступа:' : lang === 'uz' ? 'Ruxsat darajalari:' : 'Access Info:'}</span>
              </div>
              <p>• <strong>{t.roleSuperAdmin}</strong>: {lang === 'ru' ? 'Полный доступ ко всему, включая доступы.' : lang === 'uz' ? 'Barcha bo‘limlarga to‘liq kirish.' : 'Full system privileges including whitelisting.'}</p>
              <p>• <strong>{t.rolePRManager}</strong>: {lang === 'ru' ? 'Доступ к дешборду и создание отчетов только для Telegram.' : lang === 'uz' ? 'Panel va faqat Telegram hisoboti yaratish.' : 'Dashboard and Telegram-only report logs.'}</p>
              <p>• <strong>{t.roleProductManager}</strong>: {lang === 'ru' ? 'Доступ только к дешборду (без отчетов).' : lang === 'uz' ? 'Faqat loyihalar paneliga kirish (hisobotsiz).' : 'Only dashboard view, reports disabled.'}</p>
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
                    setRole('pr_manager');
                    setMetricsPermissions({
                      deals: true,
                      spend: true,
                      total_slots: true,
                      slots_published: true,
                      slots_remaining: true,
                      financial_metrics: true
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
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-black" />
              <h3 className="font-bold text-black text-xs uppercase tracking-wider">{t.activeUsersTitle}</h3>
            </div>
            <span className="text-[10px] font-black bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
              {allowedUsers.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                  <th className="py-2.5 px-4">{lang === 'ru' ? 'Сотрудник' : lang === 'uz' ? 'Xodim' : 'Member'}</th>
                  <th className="py-2.5 px-4">{t.userRoleLabel.replace('*', '')}</th>
                  <th className="py-2.5 px-4">{lang === 'ru' ? 'Дата добавления' : lang === 'uz' ? 'Qo‘shilgan sana' : 'Date Authorized'}</th>
                  <th className="py-2.5 px-4 text-right">{t.actionsColumn}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-700">
                {allowedUsers.map((user) => {
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
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-[10px] font-bold ${getRoleBadgeColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
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
                              setRole(user.role);
                              
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
                              });
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
