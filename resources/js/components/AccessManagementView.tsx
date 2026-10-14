/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AllowedUser, Project, SubdomainItem } from '../data/mockData';
import { translations, Language } from '../translations';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  Trash2,
  Key,
  Info,
  Pencil,
  FolderKanban,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Layout,
  BarChart2,
  Crown,
  Lock,
  Database,
  Download,
  Send,
  Loader2,
  Globe,
  ExternalLink,
  Plus,
  Copy,
  Check,
  ArrowRightLeft,
  Sparkles,
  Building2,
  Briefcase,
  X,
} from 'lucide-react';
import { updateUserPassword, downloadDatabaseBackupUrl, sendDatabaseBackupToTelegram } from '../services/api';

interface AccessManagementViewProps {
  allowedUsers: AllowedUser[];
  projects?: Project[];
  allProjects?: Project[];
  subdomains?: SubdomainItem[];
  onAddUser: (
    name: string,
    email: string,
    role: AllowedUser['role'],
    allowedMetrics?: string[],
    allowedPages?: string[],
    allowedProjects?: string[],
    password?: string,
    allowedSubdomains?: string[]
  ) => Promise<void>;
  onEditUser: (
    id: string,
    name: string,
    role: AllowedUser['role'],
    allowedMetrics?: string[],
    allowedPages?: string[],
    allowedProjects?: string[],
    allowedSubdomains?: string[]
  ) => Promise<void>;
  onRemoveUser: (id: string) => Promise<void>;
  onAddSubdomain?: (data: { slug: string; name: string; description?: string; projectIds?: (number | string)[] }) => Promise<void>;
  onUpdateSubdomain?: (id: string, data: { slug?: string; name: string; description?: string; projectIds?: (number | string)[] }) => Promise<void>;
  onDeleteSubdomain?: (id: string) => Promise<void>;
  onMoveProjectSubdomain?: (projectId: number | string, targetSubdomain: string) => Promise<void>;
  onCreateProjectInSubdomain?: (name: string, description: string, subdomain: string, monthlyLimit?: number | null) => Promise<void>;
  currentUserEmail: string;
  lang: Language;
}

export default function AccessManagementView({
  allowedUsers,
  projects = [],
  allProjects = [],
  subdomains = [],
  onAddUser,
  onEditUser,
  onRemoveUser,
  onAddSubdomain,
  onUpdateSubdomain,
  onDeleteSubdomain,
  onMoveProjectSubdomain,
  onCreateProjectInSubdomain,
  currentUserEmail,
  lang,
}: AccessManagementViewProps) {
  const t = translations[lang] || translations['ru'];

  // Main Tab Navigation
  const [activeMainTab, setActiveMainTab] = useState<'users' | 'workspaces'>('users');

  // Master list of projects (fallback to projects prop if allProjects is empty)
  const masterProjects = allProjects.length > 0 ? allProjects : projects;

  // Form states for Users
  const [editingUser, setEditingUser] = useState<AllowedUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessLevel, setAccessLevel] = useState<'tier1' | 'tier2'>('tier2');
  const [selectedRole, setSelectedRole] = useState<AllowedUser['role']>('pr_manager');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Subdomain Permissions state for user
  const [subdomainsPermissions, setSubdomainsPermissions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (subdomains || []).forEach((s) => {
      initial[s.slug] = true;
    });
    return initial;
  });

  // Allowed Projects state
  const [projectsPermissions, setProjectsPermissions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    masterProjects.forEach((p) => {
      initial[p.id] = true;
    });
    return initial;
  });

  // Allowed Pages state
  const [pagesPermissions, setPagesPermissions] = useState<Record<string, boolean>>({
    super_admin: false,
    projects: true,
    kanban: true,
    requisites_directory: true,
    bloggers: true,
    reports: true,
    bulk_purchases: true,
    reports_feed: true,
    other_expenses: true,
  });

  // Allowed Metrics state
  const [metricsPermissions, setMetricsPermissions] = useState<Record<string, boolean>>({
    deals: true,
    spend: true,
    total_slots: true,
    slots_published: true,
    slots_remaining: true,
    financial_metrics: true,
    set_limit: false,
  });

  // Accordion state
  const [openAccordion, setOpenAccordion] = useState<'subdomains' | 'projects' | 'pages' | 'metrics' | null>('subdomains');

  // Search & Role filter for active users list
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');

  // Change Password Modal state
  const [passwordModalUser, setPasswordModalUser] = useState<AllowedUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Backup states
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);

  // Subdomain Modal States
  const [isSubdomainModalOpen, setIsSubdomainModalOpen] = useState(false);
  const [editingSubdomain, setEditingSubdomain] = useState<SubdomainItem | null>(null);
  const [subdomainSlug, setSubdomainSlug] = useState('');
  const [subdomainName, setSubdomainName] = useState('');
  const [subdomainDesc, setSubdomainDesc] = useState('');
  const [subdomainSelectedProjectIds, setSubdomainSelectedProjectIds] = useState<string[]>([]);
  const [subdomainActionLoading, setSubdomainActionLoading] = useState(false);

  // Quick Project Creation inside Subdomain Modal
  const [quickProjectModalSubdomain, setQuickProjectModalSubdomain] = useState<string | null>(null);
  const [quickProjectName, setQuickProjectName] = useState('');
  const [quickProjectDesc, setQuickProjectDesc] = useState('');
  const [quickProjectLimit, setQuickProjectLimit] = useState('');
  const [quickProjectLoading, setQuickProjectLoading] = useState(false);

  // Copied toast state
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const selectedSubdomainsCount = Object.values(subdomainsPermissions).filter(Boolean).length;
  const selectedProjectsCount = Object.values(projectsPermissions).filter(Boolean).length;
  const selectedPagesCount = Object.values(pagesPermissions).filter(Boolean).length;
  const selectedMetricsCount = Object.values(metricsPermissions).filter(Boolean).length;

  const handleDownloadBackup = () => {
    window.open(downloadDatabaseBackupUrl(), '_blank');
  };

  const handleSendBackupToTelegram = async () => {
    setBackupLoading(true);
    try {
      await sendDatabaseBackupToTelegram();
      setBackupSuccess(
        lang === 'ru'
          ? '✅ Резервная копия базы успешно отправлена в Telegram (тема #597)!'
          : lang === 'uz'
          ? '✅ Zaxira nusxa Telegramga muvaffaqiyatli yuborildi (#597 mavzusi)!'
          : '✅ Database backup successfully sent to Telegram (topic #597)!'
      );
      setTimeout(() => setBackupSuccess(null), 6000);
    } catch (err: any) {
      alert(err?.message || 'Failed to send backup to Telegram');
    } finally {
      setBackupLoading(false);
    }
  };

  // Submit User Form
  const handleSubmitUser = async (e: React.FormEvent) => {
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
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidEmail = emailRegex.test(cleanEmail) || !cleanEmail.includes('@');
      if (!isValidEmail) {
        setErrorMsg(
          lang === 'ru'
            ? 'Некорректный формат email или логина!'
            : lang === 'uz'
            ? 'Email yoki login formati noto‘g‘ri!'
            : 'Invalid email or handle format!'
        );
        return;
      }

      const exists = allowedUsers.some((u) => u.email.toLowerCase() === cleanEmail || u.email.toLowerCase() === `${cleanEmail}@tezi.uz`);
      if (exists) {
        setErrorMsg(t.emailAlreadyExists);
        return;
      }
    }

    const resolvedEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@tezi.uz`;

    const allowedMetrics = Object.entries(metricsPermissions)
      .filter(([_, allowed]) => allowed)
      .map(([metricName]) => metricName);

    const allowedPages = Object.entries(pagesPermissions)
      .filter(([_, allowed]) => allowed)
      .map(([pageName]) => pageName);

    const allowedProjects = Object.entries(projectsPermissions)
      .filter(([_, allowed]) => allowed)
      .map(([id]) => id);

    const allowedSubdomains = Object.entries(subdomainsPermissions)
      .filter(([_, allowed]) => allowed)
      .map(([slug]) => slug);

    const determinedRole = selectedRole;

    try {
      if (editingUser) {
        await onEditUser(
          editingUser.id,
          cleanName,
          determinedRole,
          allowedMetrics,
          allowedPages,
          allowedProjects,
          allowedSubdomains
        );
        setSuccessMsg(
          lang === 'ru'
            ? 'Доступ пользователя успешно обновлен!'
            : lang === 'uz'
            ? 'Foydalanuvchi huquqlari muvaffaqiyatli yangilandi!'
            : 'User permissions updated successfully!'
        );
        setEditingUser(null);
      } else {
        await onAddUser(
          cleanName,
          resolvedEmail,
          determinedRole,
          allowedMetrics,
          allowedPages,
          allowedProjects,
          password.trim() || undefined,
          allowedSubdomains
        );
        setSuccessMsg(t.addSuccessToast.replace('{email}', resolvedEmail));
      }

      setEmail('');
      setName('');
      setPassword('');
      setSelectedRole('pr_manager');
      setAccessLevel('tier2');

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

  const handleDeleteUser = async (user: AllowedUser) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (user.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      setErrorMsg(t.cannotDeleteSelf);
      return;
    }

    const confirmMsg =
      lang === 'ru'
        ? `Вы уверены, что хотите закрыть доступ для ${user.email}?`
        : lang === 'uz'
        ? `Haqiqatan ham ${user.email} uchun ruxsatni bekor qilmoqchimisiz?`
        : `Are you sure you want to revoke access for ${user.email}?`;

    if (confirm(confirmMsg)) {
      try {
        await onRemoveUser(user.id);
        setSuccessMsg(t.removeSuccessToast);
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to revoke access');
      }
    }
  };

  const handlePasswordUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || !newPasswordInput.trim()) return;

    setPasswordSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await updateUserPassword(passwordModalUser.id, newPasswordInput.trim());
      setSuccessMsg(t.passwordChangedSuccess || 'Пароль успешно изменен!');
      setPasswordModalUser(null);
      setNewPasswordInput('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Subdomain Handlers
  const handleOpenAddSubdomainModal = () => {
    setEditingSubdomain(null);
    setSubdomainSlug('');
    setSubdomainName('');
    setSubdomainDesc('');
    setSubdomainSelectedProjectIds([]);
    setIsSubdomainModalOpen(true);
  };

  const handleOpenEditSubdomainModal = (sub: SubdomainItem) => {
    setEditingSubdomain(sub);
    setSubdomainSlug(sub.slug);
    setSubdomainName(sub.name);
    setSubdomainDesc(sub.description || '');
    // Select projects currently attached to this subdomain
    const attachedIds = masterProjects
      .filter((p) => (p.subdomain ?? '1') === sub.slug)
      .map((p) => p.id);
    setSubdomainSelectedProjectIds(attachedIds);
    setIsSubdomainModalOpen(true);
  };

  const handleSaveSubdomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanSlug = subdomainSlug.trim().toLowerCase();
    const cleanName = subdomainName.trim();

    if (!cleanSlug || !cleanName) {
      setErrorMsg(lang === 'ru' ? 'Заполните субдомен и название!' : lang === 'uz' ? 'Subdomen va nomni kiriting!' : 'Enter slug and name!');
      return;
    }

    setSubdomainActionLoading(true);
    try {
      if (editingSubdomain) {
        if (onUpdateSubdomain) {
          await onUpdateSubdomain(editingSubdomain.id, {
            slug: cleanSlug,
            name: cleanName,
            description: subdomainDesc.trim() || undefined,
            projectIds: subdomainSelectedProjectIds,
          });
        }
        setSuccessMsg(lang === 'ru' ? `Субдомен «${cleanName}» обновлен!` : lang === 'uz' ? `Subdomen yangilandi!` : 'Subdomain updated!');
      } else {
        if (onAddSubdomain) {
          await onAddSubdomain({
            slug: cleanSlug,
            name: cleanName,
            description: subdomainDesc.trim() || undefined,
            projectIds: subdomainSelectedProjectIds,
          });
        }
        setSuccessMsg(
          lang === 'ru'
            ? `Субдомен «${cleanSlug}.tezi.uz» успешно создан и готов к открытию!`
            : lang === 'uz'
            ? `«${cleanSlug}.tezi.uz» subdomeni yaratildi va tayyor!`
            : `Subdomain «${cleanSlug}.tezi.uz» created!`
        );
      }

      setIsSubdomainModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save subdomain');
    } finally {
      setSubdomainActionLoading(false);
    }
  };

  const handleDeleteSubdomainClick = async (sub: SubdomainItem) => {
    if (sub.slug === '1') {
      alert(lang === 'ru' ? 'Основной субдомен "1" удалять нельзя!' : lang === 'uz' ? 'Asosiy "1" subdomenni o‘chirib bo‘lmaydi!' : 'Default subdomain cannot be deleted!');
      return;
    }

    const confirmMsg =
      lang === 'ru'
        ? `Вы уверены, что хотите удалить субдомен «${sub.slug}.tezi.uz»? Все его проекты будут безопасно перемещены в основное пространство (1).`
        : lang === 'uz'
        ? `«${sub.slug}.tezi.uz» subdomenini o‘chirishni xohlaysizmi? Undagi loyihalar xavfsiz holda asosiy (1) bo‘limga ko‘chiriladi.`
        : `Are you sure? All projects will be moved safely to default workspace (1).`;

    if (confirm(confirmMsg)) {
      try {
        if (onDeleteSubdomain) {
          await onDeleteSubdomain(sub.id);
        }
        setSuccessMsg(lang === 'ru' ? 'Субдомен удален, проекты перемещены в (1)!' : lang === 'uz' ? 'Subdomen o‘chirildi!' : 'Subdomain deleted!');
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to delete subdomain');
      }
    }
  };

  const handleQuickMoveProject = async (projectId: string, targetSubdomain: string) => {
    try {
      if (onMoveProjectSubdomain) {
        await onMoveProjectSubdomain(projectId, targetSubdomain);
        setSuccessMsg(
          lang === 'ru'
            ? `Проект перемещен в субдомен ${targetSubdomain}.tezi.uz!`
            : lang === 'uz'
            ? `Loyiha ${targetSubdomain}.tezi.uz ga ko‘chirildi!`
            : `Project moved to ${targetSubdomain}.tezi.uz!`
        );
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to move project');
    }
  };

  const handleCreateProjectInSubdomainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProjectModalSubdomain || !quickProjectName.trim()) return;

    setQuickProjectLoading(true);
    try {
      if (onCreateProjectInSubdomain) {
        const limitNum = quickProjectLimit ? parseInt(quickProjectLimit.replace(/\D/g, ''), 10) : null;
        await onCreateProjectInSubdomain(
          quickProjectName.trim(),
          quickProjectDesc.trim(),
          quickProjectModalSubdomain,
          limitNum
        );
        setSuccessMsg(
          lang === 'ru'
            ? `Проект «${quickProjectName}» создан в субдомене ${quickProjectModalSubdomain}!`
            : lang === 'uz'
            ? `Yangi loyiha ${quickProjectModalSubdomain} subdomenida yaratildi!`
            : `Project created in ${quickProjectModalSubdomain}!`
        );
        setQuickProjectModalSubdomain(null);
        setQuickProjectName('');
        setQuickProjectDesc('');
        setQuickProjectLimit('');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create project');
    } finally {
      setQuickProjectLoading(false);
    }
  };

  const copyUrlToClipboard = (slug: string) => {
    const url = `https://${slug}.tezi.uz`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const getRoleBadgeColor = (userRole: string) => {
    switch (userRole) {
      case 'super_admin':
        return 'bg-black text-white border-black';
      case 'executive':
        return 'bg-amber-100 text-amber-900 border-amber-300';
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
      case 'executive':
        return lang === 'ru' ? 'Руководство' : lang === 'uz' ? 'Rahbariyat' : 'Executive';
      case 'pr_manager':
        return t.rolePRManager;
      case 'product_manager':
        return t.roleProductManager;
      default:
        return userRole;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header with Main Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-5 text-left">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-black text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-black tracking-tight">
              {lang === 'ru' ? 'Центр доступов и пространств' : lang === 'uz' ? 'Ruxsatlar va maydonlar markazi' : 'Access & Workspace Center'}
            </h2>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {lang === 'ru'
              ? 'Двухуровневая модель разграничения прав и изоляция проектов по субдоменам'
              : lang === 'uz'
              ? 'Ikki darajali ruxsatlar modeli va loyihalarni subdomenlarga ajratish'
              : 'Two-tier role access model and multi-tenant subdomain management'}
          </p>
        </div>

        {/* Tab Navigation Switcher */}
        <div className="flex items-center p-1 bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveMainTab('users')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeMainTab === 'users'
                ? 'bg-white text-black shadow-xs font-extrabold'
                : 'text-neutral-500 hover:text-black'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{lang === 'ru' ? 'Пользователи и Права' : lang === 'uz' ? 'Xodimlar va Huquqlar' : 'Users & Access'}</span>
            <span className="text-[10px] bg-neutral-200/80 text-neutral-700 px-1.5 py-0.2 rounded-full">
              {allowedUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('workspaces')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeMainTab === 'workspaces'
                ? 'bg-white text-black shadow-xs font-extrabold'
                : 'text-neutral-500 hover:text-black'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>{lang === 'ru' ? 'Субдомены и Проекты' : lang === 'uz' ? 'Subdomenlar va Loyihalar' : 'Workspaces & Domains'}</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-black">
              {subdomains.length || 1}
            </span>
          </button>
        </div>
      </div>

      {/* Success / Error Banners */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold text-left animate-fade-in flex items-center justify-between gap-2 shadow-xs">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs font-bold text-left animate-fade-in flex items-center justify-between gap-2 shadow-xs">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-700 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: USERS & PERMISSIONS MATRIX */}
      {/* ========================================================================= */}
      {activeMainTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form: Grant or Edit User Access */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-left shadow-2xs h-fit space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-black" />
                <h3 className="font-extrabold text-black text-xs uppercase tracking-wider">
                  {editingUser
                    ? lang === 'ru'
                      ? 'Редактировать сотрудника'
                      : lang === 'uz'
                      ? 'Xodim ruxsatlarini tahrirlash'
                      : 'Edit Member'
                    : lang === 'ru'
                    ? 'Добавить сотрудника'
                    : lang === 'uz'
                    ? 'Yangi xodim qo‘shish'
                    : 'Add Member'}
                </h3>
              </div>
              {editingUser && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    setName('');
                    setEmail('');
                    setPassword('');
                  }}
                  className="text-[10px] font-bold text-neutral-400 hover:text-black"
                >
                  {t.cancelBtn}
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitUser} className="space-y-4">
              {/* Name Field */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                  {t.userNameLabel}
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.userNamePlaceholder}
                    className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-black focus:outline-hidden transition"
                    required
                  />
                </div>
              </div>

              {/* Email / Handle Field */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                  {t.userEmailLabel}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={lang === 'ru' ? 'Email или логин (например chief1)...' : 'Email yoki login...'}
                    className={`w-full border focus:border-black focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-hidden transition ${
                      editingUser
                        ? 'bg-neutral-100 border-neutral-200 text-neutral-500 cursor-not-allowed'
                        : 'bg-neutral-50 border-neutral-200 text-black'
                    }`}
                    required
                    disabled={!!editingUser}
                  />
                </div>
              </div>

              {/* Password Field (only when adding new user) */}
              {!editingUser && (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                    {t.userPasswordLabel || 'Пароль'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.defaultPasswordHint || 'По умолчанию: password'}
                      className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-black focus:outline-hidden transition"
                    />
                  </div>
                </div>
              )}

              {/* TWO-TIER ACCESS SELECTOR */}
              <div className="space-y-2 pt-1 border-t border-neutral-100">
                <label className="block text-[10px] font-black text-neutral-600 uppercase tracking-wider">
                  {lang === 'ru' ? 'Уровень доступа' : lang === 'uz' ? 'Ruxsat darajasi' : 'Access Tier'}
                </label>

                {/* Level 1 vs Level 2 switcher */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAccessLevel('tier1');
                      setSelectedRole('executive');
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      accessLevel === 'tier1'
                        ? 'border-amber-400 bg-amber-50/60 shadow-xs'
                        : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[11px] font-black text-neutral-900">
                        {lang === 'ru' ? 'Уровень 1' : lang === 'uz' ? '1-Daraja' : 'Tier 1'}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-medium leading-tight">
                      {lang === 'ru' ? 'Руководство и Админ' : lang === 'uz' ? 'Rahbariyat va Admin' : 'Exec & Admin'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccessLevel('tier2');
                      setSelectedRole('pr_manager');
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      accessLevel === 'tier2'
                        ? 'border-blue-400 bg-blue-50/60 shadow-xs'
                        : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-[11px] font-black text-neutral-900">
                        {lang === 'ru' ? 'Уровень 2' : lang === 'uz' ? '2-Daraja' : 'Tier 2'}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-medium leading-tight">
                      {lang === 'ru' ? 'Менеджеры' : lang === 'uz' ? 'Menejerlar' : 'Managers'}
                    </span>
                  </button>
                </div>

                {/* Role Specific Select inside Tier */}
                <div className="pt-2">
                  {accessLevel === 'tier1' ? (
                    <div className="space-y-2">
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as AllowedUser['role'])}
                        className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-hidden"
                      >
                        <option value="executive">👑 {lang === 'ru' ? 'Руководство (Аналитика и расходы)' : 'Rahbariyat (Monitoring)'}</option>
                        <option value="super_admin">⚡ {t.roleSuperAdmin} (Полный контроль)</option>
                      </select>

                      <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                        {selectedRole === 'super_admin' ? (
                          <p>
                            ⚡ <strong>Суперадмин</strong> имеет абсолютный доступ: управление всеми субдоменами, перемещение проектов, настройка прав и бэкапы базы.
                          </p>
                        ) : (
                          <p>
                            👑 <strong>Руководство</strong>: доступ для контроля результатов, бюджетов и сводных расходов по всем направлениям платформы.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as AllowedUser['role'])}
                        className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-hidden"
                      >
                        <option value="pr_manager">💼 {t.rolePRManager}</option>
                        <option value="product_manager">🎯 {t.roleProductManager}</option>
                      </select>
                      <p className="text-[10px] text-neutral-400 font-medium">
                        {lang === 'ru'
                          ? 'Суперадмин точечно определяет, к каким субдоменам, проектам и меню имеет доступ менеджер.'
                          : 'Admin menejer uchun ruxsat etilgan subdomenlar, loyihalar va sahifalarni belgilaydi.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* GRANULAR PERMISSIONS ACCORDIONS (Visible for Tier 2 or fine-tuning) */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-neutral-700 uppercase tracking-wider">
                    {lang === 'ru' ? 'Матрица точечных доступов:' : 'Aniq ruxsatlar matritsasi:'}
                  </span>
                </div>

                {/* ACCORDION 1: ALLOWED SUBDOMAINS */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50/50">
                  <button
                    type="button"
                    onClick={() => setOpenAccordion((prev) => (prev === 'subdomains' ? null : 'subdomains'))}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between bg-white hover:bg-neutral-50 transition cursor-pointer text-left border-b border-neutral-100"
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="text-xs font-bold text-neutral-900">
                        {lang === 'ru' ? 'Доступные субдомены' : lang === 'uz' ? 'Ruxsat etilgan subdomenlar' : 'Allowed Subdomains'}
                      </span>
                      <span className="text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                        {selectedSubdomainsCount}/{subdomains.length || 1}
                      </span>
                    </div>
                    {openAccordion === 'subdomains' ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>

                  {openAccordion === 'subdomains' && (
                    <div className="p-3 space-y-2.5 bg-neutral-50/50 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-400 font-medium">
                          {lang === 'ru' ? 'Отметьте рабочие пространства:' : 'Maydonlarni tanlang:'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const allActive = (subdomains || []).every((s) => subdomainsPermissions[s.slug]);
                            const updated: Record<string, boolean> = {};
                            (subdomains || []).forEach((s) => {
                              updated[s.slug] = !allActive;
                            });
                            setSubdomainsPermissions(updated);
                          }}
                          className="text-[9px] font-bold text-neutral-500 hover:text-black cursor-pointer lowercase"
                        >
                          {(subdomains || []).every((s) => subdomainsPermissions[s.slug])
                            ? lang === 'ru'
                              ? 'снять все'
                              : 'barchasini yechish'
                            : lang === 'ru'
                            ? 'выбрать все'
                            : 'barchasini tanlash'}
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {(subdomains || []).map((sub) => {
                          const isChecked = subdomainsPermissions[sub.slug] ?? true;

                          return (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between p-2 rounded-xl border border-neutral-200/80 bg-white hover:border-neutral-300 transition"
                            >
                              <div className="flex flex-col text-left">
                                <span className="text-[11px] font-bold text-neutral-900">{sub.name}</span>
                                <span className="text-[9px] text-blue-600 font-bold">{sub.slug}.tezi.uz</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setSubdomainsPermissions((prev) => ({
                                    ...prev,
                                    [sub.slug]: !prev[sub.slug],
                                  }));
                                }}
                                className={`w-7 h-4 rounded-full transition duration-200 relative shrink-0 cursor-pointer ${
                                  isChecked ? 'bg-black' : 'bg-neutral-200'
                                }`}
                              >
                                <span
                                  className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition duration-200 shadow-xs ${
                                    isChecked ? 'right-0.5' : 'left-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCORDION 2: ALLOWED PROJECTS */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50/50">
                  <button
                    type="button"
                    onClick={() => setOpenAccordion((prev) => (prev === 'projects' ? null : 'projects'))}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between bg-white hover:bg-neutral-50 transition cursor-pointer text-left border-b border-neutral-100"
                  >
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-3.5 h-3.5 text-black shrink-0" />
                      <span className="text-xs font-bold text-neutral-900">
                        {lang === 'ru' ? 'Доступные проекты' : lang === 'uz' ? 'Ruxsat etilgan loyihalar' : 'Allowed Projects'}
                      </span>
                      <span className="text-[9px] font-black bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full">
                        {selectedProjectsCount}/{masterProjects.length}
                      </span>
                    </div>
                    {openAccordion === 'projects' ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>

                  {openAccordion === 'projects' && (
                    <div className="p-3 space-y-2.5 bg-neutral-50/50 animate-fade-in">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const allActive = masterProjects.every((p) => projectsPermissions[p.id]);
                            const updated: Record<string, boolean> = {};
                            masterProjects.forEach((p) => {
                              updated[p.id] = !allActive;
                            });
                            setProjectsPermissions(updated);
                          }}
                          className="text-[9px] font-bold text-neutral-500 hover:text-black cursor-pointer lowercase"
                        >
                          {masterProjects.every((p) => projectsPermissions[p.id])
                            ? lang === 'ru'
                              ? 'снять все'
                              : 'barchasini yechish'
                            : lang === 'ru'
                            ? 'выбрать все'
                            : 'barchasini tanlash'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {masterProjects.map((proj) => {
                          const isChecked = projectsPermissions[proj.id] ?? true;

                          return (
                            <div
                              key={proj.id}
                              className="flex items-center justify-between p-2 rounded-xl border border-neutral-200/80 bg-white hover:border-neutral-300 transition"
                            >
                              <div className="flex flex-col text-left truncate pr-1">
                                <span className="text-[10px] font-bold text-neutral-800 truncate" title={proj.name}>
                                  {proj.name}
                                </span>
                                <span className="text-[8px] text-neutral-400 font-bold">
                                  {proj.subdomain ? `${proj.subdomain}.tezi.uz` : '1.tezi.uz'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setProjectsPermissions((prev) => ({
                                    ...prev,
                                    [proj.id]: !prev[proj.id],
                                  }));
                                }}
                                className={`w-7 h-4 rounded-full transition duration-200 relative shrink-0 cursor-pointer ${
                                  isChecked ? 'bg-black' : 'bg-neutral-200'
                                }`}
                              >
                                <span
                                  className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition duration-200 shadow-xs ${
                                    isChecked ? 'right-0.5' : 'left-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCORDION 3: ALLOWED PAGES */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50/50">
                  <button
                    type="button"
                    onClick={() => setOpenAccordion((prev) => (prev === 'pages' ? null : 'pages'))}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between bg-white hover:bg-neutral-50 transition cursor-pointer text-left border-b border-neutral-100"
                  >
                    <div className="flex items-center gap-2">
                      <Layout className="w-3.5 h-3.5 text-black shrink-0" />
                      <span className="text-xs font-bold text-neutral-900">
                        {lang === 'ru' ? 'Разделы меню' : lang === 'uz' ? 'Sahifalar' : 'Menu Pages'}
                      </span>
                      <span className="text-[9px] font-black bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full">
                        {selectedPagesCount}/9
                      </span>
                    </div>
                    {openAccordion === 'pages' ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>

                  {openAccordion === 'pages' && (
                    <div className="p-3 space-y-2 bg-neutral-50/50 animate-fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'projects', label: t.pageProjects },
                          { key: 'kanban', label: t.pageKanban },
                          { key: 'requisites_directory', label: t.pageRequisitesDirectory },
                          { key: 'bloggers', label: t.pageBloggers },
                          { key: 'reports', label: t.pageReports },
                          { key: 'bulk_purchases', label: lang === 'ru' ? 'Оптовые закупки' : 'Ommaviy xaridlar' },
                          { key: 'reports_feed', label: t.pageReportsFeed },
                          { key: 'other_expenses', label: t.pageOtherExpenses },
                        ].map((p) => {
                          const isChecked = pagesPermissions[p.key];

                          return (
                            <div
                              key={p.key}
                              className="flex items-center justify-between p-2 rounded-xl border border-neutral-200/80 bg-white hover:border-neutral-300 transition"
                            >
                              <span className="text-[10px] font-bold text-neutral-800 truncate pr-1">{p.label}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPagesPermissions((prev) => ({
                                    ...prev,
                                    [p.key]: !prev[p.key],
                                  }));
                                }}
                                className={`w-7 h-4 rounded-full transition duration-200 relative shrink-0 cursor-pointer ${
                                  isChecked ? 'bg-black' : 'bg-neutral-200'
                                }`}
                              >
                                <span
                                  className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition duration-200 shadow-xs ${
                                    isChecked ? 'right-0.5' : 'left-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCORDION 4: ALLOWED METRICS */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50/50">
                  <button
                    type="button"
                    onClick={() => setOpenAccordion((prev) => (prev === 'metrics' ? null : 'metrics'))}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between bg-white hover:bg-neutral-50 transition cursor-pointer text-left border-b border-neutral-100"
                  >
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-3.5 h-3.5 text-black shrink-0" />
                      <span className="text-xs font-bold text-neutral-900">
                        {lang === 'ru' ? 'Финансовые метрики' : lang === 'uz' ? 'Moliyaviy ko‘rsatkichlar' : 'Metrics'}
                      </span>
                      <span className="text-[9px] font-black bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full">
                        {selectedMetricsCount}/7
                      </span>
                    </div>
                    {openAccordion === 'metrics' ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>

                  {openAccordion === 'metrics' && (
                    <div className="p-3 space-y-2 bg-neutral-50/50 animate-fade-in">
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
                            <div
                              key={m.key}
                              className="flex items-center justify-between p-2 rounded-xl border border-neutral-200/80 bg-white hover:border-neutral-300 transition"
                            >
                              <span className="text-[10px] font-bold text-neutral-800 truncate pr-1">{label}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setMetricsPermissions((prev) => ({
                                    ...prev,
                                    [m.key]: !prev[m.key],
                                  }));
                                }}
                                className={`w-7 h-4 rounded-full transition duration-200 relative shrink-0 cursor-pointer ${
                                  isChecked ? 'bg-black' : 'bg-neutral-200'
                                }`}
                              >
                                <span
                                  className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition duration-200 shadow-xs ${
                                    isChecked ? 'right-0.5' : 'left-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-black hover:bg-neutral-800 text-white font-extrabold text-xs py-3 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>
                    {editingUser
                      ? t.saveChangesBtn
                      : lang === 'ru'
                      ? 'Сохранить и предоставить доступ'
                      : 'Saqlash va ruxsat berish'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Active Authorized Members */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-left shadow-2xs lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-black" />
                <h3 className="font-extrabold text-black text-xs uppercase tracking-wider">
                  {lang === 'ru' ? 'Список пользователей' : 'Xodimlar ro‘yxati'}
                </h3>
                <span className="text-[10px] font-black bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full">
                  {allowedUsers.length}
                </span>
              </div>

              {/* Search */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder={lang === 'ru' ? 'Поиск сотрудника...' : 'Qidirish...'}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold focus:bg-white focus:border-black focus:outline-hidden transition"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-neutral-100 text-[10px] font-bold">
              {[
                { key: 'all', label: lang === 'ru' ? 'Все' : 'Barchasi' },
                { key: 'super_admin', label: 'Админы' },
                { key: 'executive', label: '👑 Руководство' },
                { key: 'pr_manager', label: 'PR Менеджеры' },
                { key: 'product_manager', label: 'Product Менеджеры' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setUserRoleFilter(f.key)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    userRoleFilter === f.key
                      ? 'bg-black text-white font-black shadow-xs'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                    <th className="py-2.5 px-4">{lang === 'ru' ? 'Сотрудник' : 'Xodim'}</th>
                    <th className="py-2.5 px-4">{lang === 'ru' ? 'Доступные пространства' : 'Subdomenlar'}</th>
                    <th className="py-2.5 px-4 text-right">{t.actionsColumn}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-700">
                  {allowedUsers
                    .filter((user) => {
                      const matchesSearch =
                        !userSearchQuery ||
                        (user.name && user.name.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
                        user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
                      const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
                      return matchesSearch && matchesRole;
                    })
                    .map((user) => {
                      const isSelf = user.email.toLowerCase() === currentUserEmail.toLowerCase();
                      const isSuper = user.role === 'super_admin';
                      const isExec = user.role === 'executive';

                      return (
                        <tr
                          key={user.id}
                          className={`transition duration-150 ${
                            isExec
                              ? 'bg-amber-50/30 hover:bg-amber-100/30 border-l-4 border-l-amber-500'
                              : isSuper
                              ? 'bg-neutral-50/40 hover:bg-neutral-100/40 border-l-4 border-l-black'
                              : 'hover:bg-neutral-50/50'
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col text-left">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-neutral-900">
                                  {user.name || user.email.split('@')[0]}
                                </span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${getRoleBadgeColor(user.role)}`}>
                                  {getRoleLabel(user.role)}
                                </span>
                                {isSelf && (
                                  <span className="text-[8px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.2 animate-pulse">
                                    {lang === 'ru' ? 'ВЫ' : 'SIZ'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-neutral-400 font-semibold mt-0.5">{user.email}</span>
                            </div>
                          </td>

                          {/* Subdomain & Projects Access */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 items-center">
                              {isSuper || isExec ? (
                                <span className="text-[9px] font-extrabold bg-neutral-900 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                  <Sparkles className="w-3 h-3 text-amber-300" />
                                  <span>{lang === 'ru' ? 'Все субдомены' : 'Barcha subdomenlar'}</span>
                                </span>
                              ) : user.allowedSubdomains && user.allowedSubdomains.length > 0 ? (
                                user.allowedSubdomains.map((slug) => (
                                  <span
                                    key={slug}
                                    className="text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1"
                                  >
                                    <Globe className="w-2.5 h-2.5" />
                                    <span>{slug}.tezi.uz</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-[9px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md">
                                  {lang === 'ru' ? '1.tezi.uz (Основной)' : '1.tezi.uz (Asosiy)'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPasswordModalUser(user);
                                  setNewPasswordInput('');
                                }}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
                                title={t.changePasswordBtn || 'Сменить пароль'}
                              >
                                <Key className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(user);
                                  setName(user.name || '');
                                  setEmail(user.email);
                                  setSelectedRole(user.role);
                                  setAccessLevel(user.role === 'super_admin' || user.role === 'executive' ? 'tier1' : 'tier2');

                                  // Subdomains
                                  const subPerms: Record<string, boolean> = {};
                                  (subdomains || []).forEach((s) => {
                                    subPerms[s.slug] = !user.allowedSubdomains || user.allowedSubdomains.includes(s.slug);
                                  });
                                  setSubdomainsPermissions(subPerms);

                                  // Projects
                                  const projPerms: Record<string, boolean> = {};
                                  masterProjects.forEach((p) => {
                                    projPerms[p.id] = !user.allowedProjects || user.allowedProjects.includes(p.id);
                                  });
                                  setProjectsPermissions(projPerms);

                                  // Pages
                                  const defaultPages = ['projects', 'kanban', 'requisites_directory', 'bloggers', 'reports', 'bulk_purchases', 'reports_feed', 'other_expenses'];
                                  const userPages = user.allowedPages || defaultPages;
                                  setPagesPermissions({
                                    super_admin: user.role === 'super_admin',
                                    projects: userPages.includes('projects'),
                                    kanban: userPages.includes('kanban'),
                                    requisites_directory: userPages.includes('requisites_directory'),
                                    bloggers: userPages.includes('bloggers'),
                                    reports: userPages.includes('reports'),
                                    bulk_purchases: userPages.includes('bulk_purchases'),
                                    reports_feed: userPages.includes('reports_feed'),
                                    other_expenses: userPages.includes('other_expenses'),
                                  });

                                  // Metrics
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
                                }}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
                                title="Редактировать"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                  title="Удалить"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WORKSPACES & SUBDOMAINS HUB */}
      {/* ========================================================================= */}
      {activeMainTab === 'workspaces' && (
        <div className="space-y-6 text-left">
          {/* Subdomain Management Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-neutral-900 to-black text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <h3 className="font-black text-base text-white">
                  {lang === 'ru' ? 'Рабочие пространства и Субдомены' : 'Maydonlar va Subdomenlar'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Wildcard Active (*.tezi.uz)
                </span>
              </div>
              <p className="text-xs text-neutral-300 max-w-2xl leading-relaxed">
                {lang === 'ru'
                  ? 'Каждый субдомен изолирует проекты для своей команды или филиала. Созданный здесь субдомен сразу доступен в браузере в один клик без дополнительных настроек сервера!'
                  : 'Har bir subdomen loyihalarni alohida maydonga ajratadi. Yaratilgan subdomen darhol brauzerda ochiladi!'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddSubdomainModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ru' ? 'Создать субдомен' : 'Yangi subdomen'}</span>
            </button>
          </div>

          {/* Subdomains Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(subdomains || []).map((sub) => {
              // Get projects assigned to this subdomain
              const attachedProjects = masterProjects.filter((p) => {
                const pSub = p.subdomain ?? '1';
                if (sub.slug === '1') {
                  return pSub === '1' || pSub === '';
                }
                return pSub === sub.slug;
              });

              // Users who have access to this subdomain
              const assignedUsersCount = allowedUsers.filter((u) => {
                if (u.role === 'super_admin' || u.role === 'executive') return true;
                return !u.allowedSubdomains || u.allowedSubdomains.includes(sub.slug);
              }).length;

              return (
                <div
                  key={sub.id}
                  className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs hover:shadow-sm transition flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-neutral-900">{sub.name}</h4>
                          {sub.slug === '1' && (
                            <span className="text-[9px] font-black bg-neutral-100 text-neutral-700 px-1.5 py-0.2 rounded border border-neutral-200">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs font-black text-blue-600">{sub.slug}.tezi.uz</span>
                          <button
                            type="button"
                            onClick={() => copyUrlToClipboard(sub.slug)}
                            className="p-1 text-neutral-400 hover:text-black transition"
                            title="Скопировать ссылку"
                          >
                            {copiedSlug === sub.slug ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <a
                            href={`https://${sub.slug}.tezi.uz`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-neutral-400 hover:text-blue-600 transition"
                            title="Открыть в новой вкладке"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {/* Edit / Delete Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditSubdomainModal(sub)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {sub.slug !== '1' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSubdomainClick(sub)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {sub.description && (
                      <p className="text-[11px] text-neutral-500 line-clamp-2">{sub.description}</p>
                    )}

                    {/* Projects Section */}
                    <div className="space-y-2 pt-2 border-t border-neutral-100">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-neutral-700 flex items-center gap-1.5">
                          <FolderKanban className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{lang === 'ru' ? 'Проекты в пространстве' : 'Maydondagi loyihalar'}</span>
                        </span>
                        <span className="text-neutral-400 font-extrabold">{attachedProjects.length}</span>
                      </div>

                      {attachedProjects.length === 0 ? (
                        <div className="p-3 bg-neutral-50 rounded-xl text-center text-[11px] text-neutral-400 italic border border-neutral-100">
                          {lang === 'ru' ? 'Проектов пока нет' : 'Hozircha loyihalar yo‘q'}
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {attachedProjects.map((p) => (
                            <div
                              key={p.id}
                              className="p-2 rounded-xl border border-neutral-200/70 bg-neutral-50/50 flex items-center justify-between gap-2 text-left"
                            >
                              <div className="truncate">
                                <p className="text-xs font-bold text-neutral-900 truncate">{p.name}</p>
                                {p.monthlyLimit && (
                                  <p className="text-[9px] text-emerald-600 font-extrabold">
                                    {(p.monthlyLimit / 1_000_000).toFixed(0)}M UZS
                                  </p>
                                )}
                              </div>

                              {/* Move project to other subdomain dropdown */}
                              <div className="shrink-0">
                                <select
                                  value={sub.slug}
                                  onChange={(e) => handleQuickMoveProject(p.id, e.target.value)}
                                  className="text-[9px] font-bold bg-white border border-neutral-200 rounded-lg px-2 py-1 text-neutral-700 hover:border-black cursor-pointer"
                                  title="Переместить проект в другой субдомен"
                                >
                                  {(subdomains || []).map((s) => (
                                    <option key={s.slug} value={s.slug}>
                                      → {s.slug}.tezi.uz
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-neutral-400 font-bold">
                      {assignedUsersCount} {lang === 'ru' ? 'сотрудников' : 'xodim'}
                    </span>

                    <button
                      type="button"
                      onClick={() => setQuickProjectModalSubdomain(sub.slug)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg text-[10px] font-extrabold transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{lang === 'ru' ? 'Добавить проект' : 'Loyiha qo‘shish'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Database Backup Card for SuperAdmin (Always available at bottom of page) */}
      <div className="bg-neutral-900 text-white rounded-2xl p-5 shadow-sm text-left flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-white">
                {lang === 'ru' ? 'Резервное копирование базы данных' : 'Ma’lumotlar bazasining zaxira nusxasi'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Nightly 03:00
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              {lang === 'ru'
                ? 'Резервная копия автоматически отправляется в Telegram (#597). Вы можете скачать свежую копию прямо сейчас или отправить вручную.'
                : 'Zaxira nusxa har kecha Telegramga yuboriladi (#597). Hozir yuklab olishingiz mumkin.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="flex items-center gap-2 px-3.5 py-2 bg-white text-black hover:bg-neutral-100 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'ru' ? 'Скачать .sqlite' : 'Yuklab olish (.sqlite)'}</span>
          </button>

          <button
            type="button"
            onClick={handleSendBackupToTelegram}
            disabled={backupLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{lang === 'ru' ? 'В Telegram (#597)' : 'Telegramga (#597)'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT SUBDOMAIN */}
      {/* ========================================================================= */}
      {isSubdomainModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-left shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-sm text-black">
                  {editingSubdomain
                    ? lang === 'ru'
                      ? 'Редактировать субдомен'
                      : 'Subdomenni tahrirlash'
                    : lang === 'ru'
                    ? 'Создать новый субдомен'
                    : 'Yangi subdomen yaratish'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSubdomainModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubdomain} className="space-y-4">
              {/* Slug Field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                  {lang === 'ru' ? 'Субдомен (slug)' : 'Subdomen nomi (slug)'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={subdomainSlug}
                    onChange={(e) => setSubdomainSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="например 2 или marketing"
                    className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-hidden"
                    required
                    disabled={editingSubdomain?.slug === '1'}
                  />
                </div>
                <p className="text-[10px] text-blue-600 font-bold mt-1">
                  🌐 Будет доступен по адресу: {subdomainSlug || '...'}.tezi.uz
                </p>
              </div>

              {/* Name Field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                  {lang === 'ru' ? 'Название пространства' : 'Maydon nomi'}
                </label>
                <input
                  type="text"
                  value={subdomainName}
                  onChange={(e) => setSubdomainName(e.target.value)}
                  placeholder="например: Отдел маркетинга или Регион 2"
                  className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-hidden"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                  {lang === 'ru' ? 'Описание (необязательно)' : 'Tavsif (ixtiyoriy)'}
                </label>
                <textarea
                  value={subdomainDesc}
                  onChange={(e) => setSubdomainDesc(e.target.value)}
                  rows={2}
                  placeholder="Для каких задач или команды используется..."
                  className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl p-2.5 text-xs font-medium text-black focus:outline-hidden"
                />
              </div>

              {/* Attach Existing Projects */}
              <div className="space-y-2 pt-1 border-t border-neutral-100">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-extrabold text-neutral-600 uppercase tracking-wider">
                    {lang === 'ru' ? 'Прикрепить проекты к этому субдомену:' : 'Biriktiriladigan loyihalar:'}
                  </label>
                  <span className="text-[9px] font-bold text-neutral-400">
                    {subdomainSelectedProjectIds.length} выбрано
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-neutral-100 rounded-xl p-2 bg-neutral-50/50">
                  {masterProjects.map((proj) => {
                    const isSelected = subdomainSelectedProjectIds.includes(proj.id);

                    return (
                      <label
                        key={proj.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white border border-neutral-200/70 hover:border-neutral-300 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSubdomainSelectedProjectIds((prev) =>
                                isSelected ? prev.filter((id) => id !== proj.id) : [...prev, proj.id]
                              );
                            }}
                            className="rounded text-black focus:ring-black cursor-pointer"
                          />
                          <span className="text-xs font-bold text-neutral-900 truncate">{proj.name}</span>
                        </div>
                        <span className="text-[9px] font-bold text-neutral-400 shrink-0">
                          {proj.subdomain ? `${proj.subdomain}.tezi.uz` : '1.tezi.uz'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={subdomainActionLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {subdomainActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{lang === 'ru' ? 'Сохранить субдомен' : 'Saqlash'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSubdomainModalOpen(false)}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QUICK ADD PROJECT IN SUBDOMAIN */}
      {/* ========================================================================= */}
      {quickProjectModalSubdomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-left shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-black">
                  {lang === 'ru' ? 'Создать проект' : 'Yangi loyiha yaratish'}
                </h3>
                <p className="text-[10px] text-blue-600 font-bold mt-0.5">
                  🌐 В субдомене: {quickProjectModalSubdomain}.tezi.uz
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickProjectModalSubdomain(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProjectInSubdomainSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                  {lang === 'ru' ? 'Название проекта' : 'Loyiha nomi'}
                </label>
                <input
                  type="text"
                  value={quickProjectName}
                  onChange={(e) => setQuickProjectName(e.target.value)}
                  placeholder="например TezPay или PR Кампания"
                  className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-hidden"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                  {lang === 'ru' ? 'Месячный лимит бюджета (UZS)' : 'Oylik limit (UZS)'}
                </label>
                <input
                  type="number"
                  value={quickProjectLimit}
                  onChange={(e) => setQuickProjectLimit(e.target.value)}
                  placeholder="например 100000000"
                  className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                  {lang === 'ru' ? 'Описание' : 'Tavsif'}
                </label>
                <textarea
                  value={quickProjectDesc}
                  onChange={(e) => setQuickProjectDesc(e.target.value)}
                  rows={2}
                  placeholder="Краткое описание..."
                  className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl p-2.5 text-xs font-medium text-black focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={quickProjectLoading}
                  className="w-full bg-black hover:bg-neutral-800 text-white font-black text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {quickProjectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{lang === 'ru' ? 'Создать проект' : 'Yaratish'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuickProjectModalSubdomain(null)}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHANGE PASSWORD */}
      {/* ========================================================================= */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-left shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-black" />
                <h3 className="font-black text-xs uppercase tracking-wider text-black">
                  {t.changePasswordBtn || 'Сменить пароль'}
                </h3>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500 font-medium">
              {lang === 'ru'
                ? `Новый пароль для пользователя ${passwordModalUser.email}:`
                : `Foydalanuvchi ${passwordModalUser.email} uchun yangi parol:`}
            </p>

            <form onSubmit={handlePasswordUpdateSubmit} className="space-y-4">
              <input
                type="text"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder={lang === 'ru' ? 'Введите новый пароль...' : 'Yangi parolni kiriting...'}
                className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-hidden"
                required
                autoFocus
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="w-1/2 bg-black hover:bg-neutral-800 text-white font-black text-xs py-2 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {passwordSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t.saveChangesBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="w-1/2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs py-2 rounded-xl transition cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
