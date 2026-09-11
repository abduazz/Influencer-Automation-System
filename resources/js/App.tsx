/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import ExecutiveDashboardView from './components/ExecutiveDashboardView';
import BloggersView from './components/BloggersView';
import ReportsView from './components/ReportsView';
import ReportsFeedView from './components/ReportsFeedView';
import BulkPurchasesView from './components/BulkPurchasesView';
import BloggerCabinetView from './components/BloggerCabinetView';
import AccessManagementView from './components/AccessManagementView';
import LogsView from './components/LogsView';
import LoginView from './components/LoginView';
import CodeViewer from './components/CodeViewer';
import KanbanView from './components/KanbanView';
import BloggerRequisitesView from './components/BloggerRequisitesView';
import BloggerRequisitesDirectoryView from './components/BloggerRequisitesDirectoryView';
import { KanbanStage, BloggerRequisites, KanbanColumn, INITIAL_KANBAN_COLUMNS } from './data/mockData';
import { Language, translations } from './translations';
import {
  fetchAllowedUsers,
  createAllowedUser,
  deleteAllowedUser,
  updateAllowedUser,
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  fetchIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  fetchReports,
  createReport,
  deleteReport,
  fetchSubmissions,
  createSubmission,
  fetchBulkPurchases,
  fetchKanbanColumns,
  saveKanbanColumns,
  clearKanbanStageApi,
  refreshIntegrationSubscribers,
  addIntegrationSubscriberHistory,
  submitBloggerRequisites,
  fetchBloggerRequisites,
} from './services/api';

import {
  Project,
  Integration,
  Report,
  BloggerSubmission,
  AllowedUser,
  BulkPurchase,
  INITIAL_ALLOWED_USERS
} from './data/mockData';

import { Info, HelpCircle, RefreshCw, Layers, FolderKanban, Kanban, FilePlus, FileText, UserSquare2, Shield, Terminal, LogOut, Users, Receipt } from 'lucide-react';

export default function App() {
  // Language state (Uzbek by default)
  const [lang, setLang] = useState<Language>(() => {
    const cached = localStorage.getItem('ff_lang');
    return (cached as Language) || 'uz';
  });

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('ff_lang', newLang);
  };

  // Whitelisted Users & Role State (shared server-side list)
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>(INITIAL_ALLOWED_USERS);
  const [allowedUsersLoading, setAllowedUsersLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('ff_user_email');
  });

  const [currentUserRole, setCurrentUserRole] = useState<AllowedUser['role'] | null>(() => {
    const cachedRole = localStorage.getItem('ff_user_role');
    if (cachedRole) return cachedRole as any;

    return null;
  });

  // Navigation Tabs State & Types
  type AppTab = 'projects' | 'kanban' | 'requisites_directory' | 'bloggers' | 'reports' | 'bulk_purchases' | 'reports_feed' | 'other_expenses' | 'blogger' | 'code' | 'access' | 'logs' | 'requisites';

  const ALL_VALID_TABS: AppTab[] = [
    'projects', 
    'kanban', 
    'requisites_directory', 
    'bloggers', 
    'reports', 
    'bulk_purchases', 
    'reports_feed', 
    'other_expenses', 
    'blogger', 
    'code', 
    'access', 
    'logs',
    'requisites'
  ];

  const getInitialActiveTab = (): AppTab => {
    if (typeof window === 'undefined') return 'projects';
    const params = new URLSearchParams(window.location.search);
    const hasCabinetParam = params.get('cabinet') === 'true' || window.location.pathname.startsWith('/c/');
    if (hasCabinetParam) return 'blogger';
    if (params.get('view') === 'requisites' || window.location.pathname.startsWith('/requisites')) {
      return 'requisites';
    }
    const pageParam = params.get('page') as AppTab;
    if (pageParam && ALL_VALID_TABS.includes(pageParam)) {
      return pageParam;
    }
    const cachedTab = localStorage.getItem('tezi_active_tab') as AppTab;
    if (cachedTab && ALL_VALID_TABS.includes(cachedTab)) {
      return cachedTab;
    }
    return 'projects';
  };

  const [activeTab, setActiveTab] = useState<AppTab>(getInitialActiveTab);
  const [bloggerRequisitesList, setBloggerRequisitesList] = useState<BloggerRequisites[]>([]);
  const [activeRequisitesToken, setActiveRequisitesToken] = useState<string | undefined>(undefined);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState<boolean>(false);
  const [reportsInitialState, setReportsInitialState] = useState<{
    projectId?: string;
    bloggerName?: string;
    paymentType?: 'prepaid' | 'full' | 'other' | 'remaining';
    platform?: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok';
    pricePerSlot?: number | '';
    slotsCount?: number;
    paidSlotsCount?: number;
    bloggerPageLink?: string;
    destination?: string;
    totalAmount?: number | '';
    paidAmount?: number | '';
    comments?: string;
    integrationId?: string;
  } | null>(null);

  // Check if current URL route is for external Blogger Requisites form
  const isRequisitesRoute = (new URLSearchParams(window.location.search).get('view') === 'requisites' ||
                            window.location.pathname.startsWith('/requisites'));
  const requisitesToken = new URLSearchParams(window.location.search).get('token') || undefined;


  const handleAddUser = async (name: string, email: string, role: AllowedUser['role'], allowedMetrics?: string[], allowedPages?: string[], allowedProjects?: string[], password?: string) => {
    const newUser = await createAllowedUser(name, email, role, allowedMetrics, allowedPages, allowedProjects, password);
    setAllowedUsers((prev) => [...prev, newUser]);
  };

  const handleEditUser = async (id: string, name: string, role: AllowedUser['role'], allowedMetrics?: string[], allowedPages?: string[], allowedProjects?: string[]) => {
    const updatedUser = await updateAllowedUser(id, name, role, allowedMetrics, allowedPages, allowedProjects);
    setAllowedUsers((prev) => prev.map((u) => u.id === id ? updatedUser : u));
  };

  const handleRemoveUser = async (id: string) => {
    await deleteAllowedUser(id);
    setAllowedUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleLoginSuccess = (email: string, role: AllowedUser['role']) => {
    setCurrentUserEmail(email);
    setCurrentUserRole(role);
    localStorage.setItem('ff_user_email', email);
    localStorage.setItem('ff_user_role', role);
    setActiveTab('projects');
  };

  const handleLogout = () => {
    setCurrentUserEmail(null);
    setCurrentUserRole(null);
    localStorage.removeItem('ff_user_email');
    localStorage.removeItem('ff_user_role');
  };

  // Mapped URL simulated routing parameters state
  const [simulatedUrlParams, setSimulatedUrlParams] = useState<{
    platform?: string;
    slotsCount?: string;
    integrationId?: string;
  }>({});

  // Check if current URL route matches a blogger cabinet guest access pattern (and user is not logged in)
  const isBloggerCabinetRoute = (new URLSearchParams(window.location.search).get('cabinet') === 'true' ||
                                 window.location.pathname.startsWith('/c/')) && 
                                 !currentUserRole;

  // Core Persistent State Hook (Persisting data to server database)
  const [projects, setProjects] = useState<Project[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [submissions, setSubmissions] = useState<BloggerSubmission[]>([]);
  const [bulkPurchases, setBulkPurchases] = useState<BulkPurchase[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>(INITIAL_KANBAN_COLUMNS);

  const handleRefreshAllData = async () => {
    try {
      const [projs, ints, reps, bulks, cols, reqs] = await Promise.all([
        fetchProjects(),
        fetchIntegrations(),
        fetchReports(),
        fetchBulkPurchases(),
        fetchKanbanColumns(),
        fetchBloggerRequisites(),
      ]);
      setProjects(projs);
      setIntegrations(ints);
      setReports(reps);
      setBulkPurchases(bulks);
      if (cols && cols.length > 0) setKanbanColumns(cols);
      if (reqs) setBloggerRequisitesList(reqs);
    } catch (err) {
      console.error("Failed to refresh data", err);
    }
  };

  // Load all data from server
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [users, projs, ints, reps, subs, bulks, cols, reqs] = await Promise.all([
          fetchAllowedUsers(),
          fetchProjects(),
          fetchIntegrations(),
          fetchReports(),
          fetchSubmissions(),
          fetchBulkPurchases(),
          fetchKanbanColumns(),
          fetchBloggerRequisites(),
        ]);

        if (!cancelled) {
          setAllowedUsers(users);
          setProjects(projs);
          setIntegrations(ints);
          setReports(reps);
          setSubmissions(subs);
          setBulkPurchases(bulks);
          if (cols && cols.length > 0) setKanbanColumns(cols);
          if (reqs) setBloggerRequisitesList(reqs);
        }
      } catch (err) {
        console.error("Failed to load backend data", err);
      } finally {
        if (!cancelled) {
          setAllowedUsersLoading(false);
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Validate active session against the shared whitelist
  useEffect(() => {
    if (allowedUsersLoading || !currentUserEmail) return;

    const found = (allowedUsers || []).find(
      (u) => u && u.email && currentUserEmail && u.email.toLowerCase() === currentUserEmail.toLowerCase()
    );

    if (!found) {
      handleLogout();
      return;
    }

    if (found.role !== currentUserRole) {
      setCurrentUserRole(found.role);
      localStorage.setItem('ff_user_role', found.role);
    }
  }, [allowedUsers, allowedUsersLoading, currentUserEmail, currentUserRole]);

  // State manipulation handlers
  const handleAddProject = async (newProj: Omit<Project, 'id' | 'createdAt'>) => {
    const project = await createProject(newProj.name, newProj.description, newProj.telegramThreadId, newProj.monthlyLimit);
    setProjects((prev) => [...prev, project]);
  };

  const handleEditProject = async (id: string, name: string, description: string, telegramThreadId?: string, monthlyLimit?: number | null) => {
    const updated = await updateProject(id, name, description, telegramThreadId, monthlyLimit, currentUserEmail || undefined);
    setProjects((prev) => prev.map(p => p.id === id ? updated : p));
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId, currentUserEmail || undefined);
    const projs = await fetchProjects();
    const ints = await fetchIntegrations();
    setProjects(projs);
    setIntegrations(ints);
  };

  const handleAddIntegration = async (newInt: Omit<Integration, 'id' | 'totalAmount' | 'paidAmount' | 'bloggerCabinetToken'>) => {
    const integration = await createIntegration(newInt, currentUserEmail || undefined);
    setIntegrations((prev) => [...prev, integration]);
  };

  const handleEditIntegration = async (id: string, updatedFields: Partial<Integration>) => {
    const integration = await updateIntegration(id, updatedFields, currentUserEmail || undefined);
    setIntegrations((prev) => prev.map(item => item.id === id ? { ...item, ...integration } : item));
  };

  const handleDeleteIntegration = async (id: string) => {
    await deleteIntegration(id);
    setIntegrations((prev) => prev.filter(i => i.id !== id));
  };

  const handleAddReport = async (newRep: Omit<Report, 'id' | 'totalAmount' | 'paidAmount' | 'projectName'> & { integrationId?: string }) => {
    // Optimistically update integration deal stage if it was in ready_for_payment
    setIntegrations((prev) => prev.map((item) => {
      const isTarget = (newRep.integrationId && String(item.id) === String(newRep.integrationId)) ||
        (!newRep.integrationId && newRep.channelBlogger && item.bloggerName.toLowerCase().trim() === newRep.channelBlogger.toLowerCase().trim() && String(item.projectId) === String(newRep.projectId));

      if (isTarget && item.kanbanStage !== 'completed') {
        return { ...item, kanbanStage: 'paid_in_progress' };
      }
      return item;
    }));

    const report = await createReport(newRep, currentUserEmail || undefined);
    setReports((prev) => [report, ...prev]);
    const ints = await fetchIntegrations();
    setIntegrations(ints);
    return report;
  };

  const handleNavigateFromKanbanToReports = (deal: Integration) => {
    let requisitesNote = '';
    if (deal.requisites) {
      const r = deal.requisites;
      const parts: string[] = [];
      if (r.fullName) parts.push(r.fullName);
      if (r.cardNumberOrIban) parts.push(r.cardNumberOrIban);
      if (r.bankName) parts.push(r.bankName);
      if (r.pinflOrTin) parts.push(`ПИНФЛ/ИНН: ${r.pinflOrTin}`);
      if (parts.length > 0) {
        requisitesNote = `Реквизиты: ${parts.join(', ')}`;
      }
    }

    setReportsInitialState({
      projectId: deal.projectId,
      bloggerName: deal.bloggerName,
      paymentType: 'prepaid',
      platform: deal.platform,
      pricePerSlot: deal.pricePerSlot,
      slotsCount: deal.slotsCount || 5,
      paidSlotsCount: deal.paidSlotsCount ?? Math.ceil((deal.slotsCount || 5) / 2),
      bloggerPageLink: deal.bloggerPageLink,
      destination: deal.referralLink || '',
      comments: requisitesNote,
      totalAmount: deal.totalAmount || (deal.pricePerSlot * (deal.slotsCount || 1)),
      paidAmount: deal.paidAmount || (deal.pricePerSlot * (deal.paidSlotsCount ?? Math.ceil((deal.slotsCount || 5) / 2))),
      integrationId: deal.id,
    });
    setActiveTab('reports');
  };

  const handleDeleteReport = async (id: string) => {
    if (!window.confirm(lang === 'ru' ? 'Вы уверены, что хотите удалить этот отчет?' : lang === 'uz' ? 'Ushbu hisobotni o\'chirishni xohlaysizmi?' : 'Are you sure you want to delete this report?')) return;
    await deleteReport(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddSubmission = async (newSub: Omit<BloggerSubmission, 'id' | 'submittedAt'> & { lang?: string }) => {
    const submission = await createSubmission(newSub.integrationId, newSub.data, newSub.lang);
    setSubmissions((prev) => {
      const exists = prev.some(s => String(s.integrationId) === String(newSub.integrationId));
      if (exists) {
        return prev.map(s => String(s.integrationId) === String(newSub.integrationId) ? submission : s);
      }
      return [submission, ...prev];
    });
  };

  const handleUpdateKanbanColumns = async (newCols: KanbanColumn[]) => {
    setKanbanColumns(newCols);
    try {
      await saveKanbanColumns(newCols);
    } catch (err) {
      console.error('Failed to save kanban columns to backend:', err);
    }
  };

  const handleUpdateIntegrationStage = async (integrationId: string, newStage: KanbanStage) => {
    setIntegrations((prev) => prev.map((item) => {
      if (item.id === integrationId) {
        return { ...item, kanbanStage: newStage };
      }
      return item;
    }));

    try {
      await updateIntegration(integrationId, { kanbanStage: newStage }, currentUserEmail || undefined);
    } catch (err) {
      console.error('Failed to persist integration stage to backend:', err);
    }
  };

  const handleClearKanbanStage = async (stage: string) => {
    setIntegrations((prev) => prev.map((item) => {
      if (item.kanbanStage === stage) {
        return { ...item, kanbanStage: undefined };
      }
      return item;
    }));

    try {
      await clearKanbanStageApi(stage);
    } catch (err) {
      console.error('Failed to clear kanban stage on backend:', err);
    }
  };

  const handleAddIntegrationToKanban = async (newInt: Omit<Integration, 'id' | 'totalAmount'>) => {
    try {
      const created = await createIntegration({
        ...newInt,
        createdBy: currentUserEmail || undefined,
      }, currentUserEmail || undefined);
      setIntegrations((prev) => [created, ...prev]);
    } catch (err) {
      console.error('Failed to create integration in Kanban:', err);
    }
  };

  const handleRefreshIntegrationSubscribers = async (integrationId: string) => {
    try {
      const res = await refreshIntegrationSubscribers(integrationId);
      if (res.success && res.integration) {
        const targetClean = (res.integration.bloggerName || '').toLowerCase().replace(/^[@#]/, '').trim();
        setIntegrations((prev) => prev.map((item) => {
          const itemClean = (item.bloggerName || '').toLowerCase().replace(/^[@#]/, '').trim();
          if (item.id === integrationId || (targetClean && itemClean === targetClean)) {
            return { 
              ...item, 
              subscribersCount: res.integration.subscribersCount,
              subscribersUpdatedAt: res.integration.subscribersUpdatedAt,
              subscribersHistory: res.integration.subscribersHistory
            };
          }
          return item;
        }));
      }
    } catch (err) {
      console.error('Failed to refresh subscribers:', err);
    }
  };

  const handleAddIntegrationSubscriberHistory = async (integrationId: string, date: string, count: number, note?: string) => {
    try {
      const res = await addIntegrationSubscriberHistory(integrationId, { date, count, note });
      if (res.success && res.integration) {
        const targetClean = (res.integration.bloggerName || '').toLowerCase().replace(/^[@#]/, '').trim();
        setIntegrations((prev) => prev.map((item) => {
          const itemClean = (item.bloggerName || '').toLowerCase().replace(/^[@#]/, '').trim();
          if (item.id === integrationId || (targetClean && itemClean === targetClean)) {
            return { 
              ...item, 
              subscribersCount: res.integration.subscribersCount,
              subscribersUpdatedAt: res.integration.subscribersUpdatedAt,
              subscribersHistory: res.integration.subscribersHistory
            };
          }
          return item;
        }));
      }
    } catch (err) {
      console.error('Failed to add subscriber history:', err);
    }
  };

  const handleSubmitRequisites = async (integrationId: string, requisitesData: any) => {
    try {
      const res = await submitBloggerRequisites({
        integrationId,
        ...requisitesData
      });

      if (res.success && res.integration) {
        setIntegrations((prev) => prev.map((item) => {
          if (String(item.id) === String(res.integration.id)) {
            return res.integration;
          }
          return item;
        }));

        if (res.requisites) {
          setBloggerRequisitesList((prev) => [res.requisites, ...prev.filter(r => r.integrationId !== String(res.integration.id))]);
        }
      }
    } catch (err) {
      console.error('Failed to submit requisites:', err);
      // Fallback local update if offline/error
      const fallbackRecord: BloggerRequisites = {
        id: `req-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        status: 'submitted',
        ...requisitesData
      };
      setBloggerRequisitesList((prev) => [fallbackRecord, ...prev]);
      throw err;
    }
  };

  // URL Simulator router check
  // Watcher listening for simulated link-clicks (e.g. "?cabinet=true")
  // Watcher listening for URL search parameters to route between tabs
  useEffect(() => {
    // Detect if we are running in a real Telegram WebApp
    const searchParams = new URLSearchParams(window.location.search);
    const isTg = searchParams.get('tgWebAppPlatform') !== null || 
                 searchParams.get('tgWebAppVersion') !== null ||
                 window.location.search.includes('tgWebAppPlatform') ||
                 (window as any).Telegram?.WebApp?.initData !== undefined;

    if (isTg) {
      setIsTelegramWebApp(true);
      setActiveTab('reports');
      
      // Auto-login Telegram WebApp user if not set
      if (!localStorage.getItem('ff_user_email')) {
        localStorage.setItem('ff_user_email', 'telegram-manager@tezi.uz');
        localStorage.setItem('ff_user_role', 'super_admin');
        setCurrentUserEmail('telegram-manager@tezi.uz');
        setCurrentUserRole('super_admin');
      }
    }

    const parseUrlRoute = () => {
      const params = new URLSearchParams(window.location.search);
      const hasCabinetParam = params.get('cabinet') === 'true' || window.location.pathname.startsWith('/c/');
      const page = params.get('page');

      if (hasCabinetParam) {
        let integrationId = params.get('integrationId') || params.get('id') || undefined;
        if (window.location.pathname.startsWith('/c/')) {
          integrationId = window.location.pathname.substring(3); // remove "/c/"
        }
        setSimulatedUrlParams({
          platform: params.get('platform') || undefined,
          slotsCount: params.get('slots_count') || undefined,
          integrationId: integrationId
        });
        setActiveTab('blogger');
      } else if (page && ALL_VALID_TABS.includes(page as any)) {
        setActiveTab(page as any);
      } else {
        const cached = localStorage.getItem('tezi_active_tab') as AppTab;
        if (cached && ALL_VALID_TABS.includes(cached)) {
          setActiveTab(cached);
        } else if (!isTg) {
          setActiveTab('projects');
        }
      }
    };

    // Run on startup
    parseUrlRoute();

    // Listen for custom address mutations
    window.addEventListener('popstate', parseUrlRoute);
    return () => window.removeEventListener('popstate', parseUrlRoute);
  }, []);

  // Update browser URL query string whenever activeTab changes
  useEffect(() => {
    if (isBloggerCabinetRoute || isRequisitesRoute) return;

    // Persist active tab to localStorage for instant restoration on tab refresh
    localStorage.setItem('tezi_active_tab', activeTab);

    const params = new URLSearchParams(window.location.search);
    
    if (activeTab === 'blogger') {
      if (params.get('cabinet') !== 'true') {
        params.set('cabinet', 'true');
        params.delete('page');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      }
    } else {
      if (params.get('page') !== activeTab) {
        params.delete('cabinet');
        params.delete('id');
        params.delete('platform');
        params.delete('slots_count');
        params.set('page', activeTab);
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      }
    }
  }, [activeTab, isBloggerCabinetRoute, isRequisitesRoute]);

  // Resolve allowed pages and projects for the active user
  const activeUser = (allowedUsers || []).find(u => u && u.email && currentUserEmail && u.email.toLowerCase() === currentUserEmail.toLowerCase());
  const allowedPages = activeUser?.allowedPages || ['projects', 'kanban', 'requisites_directory', 'bloggers', 'reports', 'bulk_purchases', 'reports_feed', 'other_expenses'];
  const userAllowedProjects = activeUser?.allowedProjects;

  const accessibleProjects = (currentUserRole === 'super_admin' || !userAllowedProjects || userAllowedProjects.length === 0)
    ? projects
    : projects.filter(p => userAllowedProjects.includes(p.id));

  const hasPageAccess = (pageKey: string) => {
    if (currentUserRole === 'super_admin') return true;
    if (currentUserRole === 'executive') {
      const execPages = allowedPages || ['projects', 'reports_feed'];
      return execPages.includes(pageKey);
    }
    if (pageKey === 'bulk_purchases' || pageKey === 'bloggers' || pageKey === 'kanban' || pageKey === 'requisites_directory') return true;
    return allowedPages.includes(pageKey);
  };

  // Enforce page-level access control: redirect user to their first allowed page if active tab is forbidden
  useEffect(() => {
    if (isBloggerCabinetRoute || isRequisitesRoute) return;
    if (allowedUsersLoading) return; // Do not redirect while user permissions are still loading
    if (!currentUserRole || currentUserRole === 'super_admin') return;

    const isAllowedTab = (activeTab === 'bulk_purchases' || activeTab === 'bloggers' || activeTab === 'kanban' || activeTab === 'requisites_directory') ? true : allowedPages.includes(activeTab);
    const isSystemTab = ['access', 'logs', 'blogger'].includes(activeTab);

    if (!isAllowedTab && !isSystemTab) {
      if (allowedPages.length > 0) {
        setActiveTab(allowedPages[0] as any);
      }
    }
  }, [activeTab, allowedPages, currentUserRole, isBloggerCabinetRoute, isRequisitesRoute, allowedUsersLoading]);

  // White-list Gate (bypass if it's the guest blogger cabinet or requisites form page)
  if (!isBloggerCabinetRoute && !isRequisitesRoute && (!currentUserEmail || !currentUserRole)) {
    return (
      <LoginView
        allowedUsers={allowedUsers}
        allowedUsersLoading={allowedUsersLoading}
        onLoginSuccess={handleLoginSuccess}
        lang={lang}
        setLang={handleSetLang}
      />
    );
  }

  return (
    <div className={`flex bg-neutral-50 min-h-screen text-neutral-900 antialiased font-sans ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isTelegramWebApp ? 'telegram-webapp-view' : ''}`}>
      {/* Dynamic Navigation Rail Sidebar */}
      {!isTelegramWebApp && !isBloggerCabinetRoute && !isRequisitesRoute && (
        <Sidebar 
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          projectsCount={projects.length}
          integrationsCount={integrations.length}
          lang={lang}
          setLang={handleSetLang}
          userEmail={currentUserEmail || ''}
          userRole={currentUserRole}
          onLogout={handleLogout}
          allowedPages={allowedPages}
        />
      )}

      {/* Mobile Top Header */}
      {!isBloggerCabinetRoute && !isRequisitesRoute && (
        <header className="fixed top-0 left-0 right-0 bg-white/95 border-b border-neutral-200/85 h-14 flex items-center justify-between px-4 z-50 md:hidden shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs tracking-wider uppercase text-neutral-800">
              Tezi.uz
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Language switcher */}
            <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
              {(['ru', 'uz', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => handleSetLang(l)}
                  className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all duration-100 ${
                    lang === l
                      ? 'bg-white text-black shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="text-neutral-400 hover:text-red-500 transition-colors p-1"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* Main Core View Area */}
      <main className="flex-1 overflow-y-auto h-screen relative pt-16 p-4 pb-28 md:p-8 lg:p-12 md:pt-8">
        {/* Dynamic Simulated Query Parameter Info Bar */}
        {simulatedUrlParams.platform && currentUserRole === 'super_admin' && (
          <div className="mb-6 p-4 bg-white border-2 border-black rounded-lg flex items-center justify-between text-left text-xs text-black shadow-sm">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-black mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Blogger Cabinet Link Loaded</p>
                <p className="text-[11px] text-neutral-600">
                  Simulated route parameter: <code>?platform={simulatedUrlParams.platform}&slots_count={simulatedUrlParams.slotsCount}</code>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSimulatedUrlParams({})}
              className="text-[10px] font-bold uppercase text-neutral-500 hover:text-black px-2.5 py-1 bg-white border border-neutral-200 rounded-md shrink-0 ml-4"
            >
              Clear Route
            </button>
          </div>
        )}

        {/* Active Tab Router / Guest Blogger Route Gate */}
        {isRequisitesRoute || activeTab === 'requisites' ? (
          <BloggerRequisitesView
            integrationToken={requisitesToken || activeRequisitesToken}
            integrations={integrations}
            onSubmitRequisites={async (id, data) => {
              await handleSubmitRequisites(id, data);
              handleRefreshAllData();
            }}
            onBack={activeTab === 'requisites' ? () => {
              setActiveTab('requisites_directory');
              setActiveRequisitesToken(undefined);
            } : undefined}
            lang={lang}
            setLang={handleSetLang}
          />
        ) : isBloggerCabinetRoute ? (
          <BloggerCabinetView
            projects={projects}
            integrations={integrations}
            submissions={submissions}
            onAddSubmission={handleAddSubmission}
            urlParams={simulatedUrlParams}
            lang={lang}
            userRole={currentUserRole}
            setLang={handleSetLang}
          />
        ) : (
          <>
            {activeTab === 'kanban' && (
              <KanbanView
                projects={projects}
                integrations={integrations}
                columns={kanbanColumns}
                onUpdateColumns={handleUpdateKanbanColumns}
                onUpdateIntegrationStage={handleUpdateIntegrationStage}
                onAddIntegration={handleAddIntegrationToKanban}
                onEditIntegration={handleEditIntegration}
                onDeleteIntegration={currentUserRole === 'super_admin' ? handleDeleteIntegration : undefined}
                lang={lang}
                userRole={currentUserRole}
                currentUserEmail={currentUserEmail}
                onOpenRequisitesDirectory={() => setActiveTab('requisites_directory')}
                onClearStage={handleClearKanbanStage}
                onRefreshSubscribers={handleRefreshIntegrationSubscribers}
                onAddManualSnapshot={handleAddIntegrationSubscriberHistory}
                onNavigateToReports={handleNavigateFromKanbanToReports}
              />
            )}
            {activeTab === 'requisites_directory' && (
              <BloggerRequisitesDirectoryView
                requisitesList={bloggerRequisitesList}
                integrations={integrations}
                projects={projects}
                lang={lang}
                onOpenRequisitesPage={(integrationId) => {
                  setActiveRequisitesToken(integrationId);
                  setActiveTab('requisites');
                }}
                onRefresh={handleRefreshAllData}
              />
            )}
            {activeTab === 'projects' && (
              currentUserRole === 'executive' ? (
                <ExecutiveDashboardView
                  projects={accessibleProjects}
                  integrations={integrations}
                  lang={lang}
                />
              ) : (
                <DashboardView
                  projects={accessibleProjects}
                  integrations={integrations}
                  submissions={submissions}
                  onAddProject={handleAddProject}
                  onEditProject={handleEditProject}
                  onDeleteProject={handleDeleteProject}
                  onAddIntegration={handleAddIntegration}
                  onEditIntegration={handleEditIntegration}
                  onDeleteIntegration={handleDeleteIntegration}
                  lang={lang}
                  allowedMetrics={(allowedUsers || []).find(u => u && u.email && currentUserEmail && u.email.toLowerCase() === currentUserEmail.toLowerCase())?.allowedMetrics || ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics']}
                  userRole={currentUserRole}
                  onNavigateToReports={(projectId, bloggerName, paymentType) => {
                    setReportsInitialState({
                      projectId,
                      bloggerName,
                      paymentType
                    });
                    setActiveTab('reports');
                  }}
                />
              )
            )}

            {activeTab === 'bloggers' && currentUserRole !== 'executive' && (
              <BloggersView
                projects={projects}
                integrations={integrations}
                lang={lang}
                userRole={currentUserRole}
                onRefreshSubscribers={handleRefreshIntegrationSubscribers}
                onAddManualSnapshot={handleAddIntegrationSubscriberHistory}
              />
            )}

            {activeTab === 'reports' && currentUserRole !== 'product_manager' && currentUserRole !== 'executive' && (
              <ReportsView
                projects={projects}
                integrations={integrations}
                reports={reports}
                onAddReport={handleAddReport}
                lang={lang}
                userRole={currentUserRole}
                isWebApp={isTelegramWebApp}
                initialState={reportsInitialState}
                onClearInitialState={() => setReportsInitialState(null)}
              />
            )}

            {activeTab === 'bulk_purchases' && currentUserRole !== 'executive' && (
              <BulkPurchasesView
                projects={projects}
                bulkPurchases={bulkPurchases}
                onRefreshData={handleRefreshAllData}
                lang={lang}
                userEmail={currentUserEmail || undefined}
                userRole={currentUserRole}
              />
            )}

            {activeTab === 'reports_feed' && currentUserRole !== 'product_manager' && (
              <ReportsFeedView
                projects={projects}
                integrations={integrations}
                reports={reports.filter((r) => r.paymentType !== 'other')}
                lang={lang}
                userRole={currentUserRole}
                onDeleteReport={currentUserRole === 'super_admin' ? handleDeleteReport : undefined}
              />
            )}

            {activeTab === 'other_expenses' && currentUserRole !== 'product_manager' && currentUserRole !== 'executive' && (
              <ReportsFeedView
                projects={projects}
                integrations={integrations}
                reports={reports.filter((r) => r.paymentType === 'other')}
                lang={lang}
                userRole={currentUserRole}
                onDeleteReport={currentUserRole === 'super_admin' ? handleDeleteReport : undefined}
                title={translations[lang].otherExpensesTab}
                description={
                  lang === 'ru' ? 'Просматривайте все созданные прочие расходы.' : 
                  lang === 'uz' ? 'Barcha yaratilgan boshqa xarajatlarni ko‘ring.' : 
                  'View all created other expenses.'
                }
              />
            )}

            {activeTab === 'blogger' && (
              <BloggerCabinetView
                projects={projects}
                integrations={integrations}
                submissions={submissions}
                onAddSubmission={handleAddSubmission}
                urlParams={simulatedUrlParams}
                lang={lang}
                userRole={currentUserRole}
                setLang={handleSetLang}
              />
            )}

            {activeTab === 'access' && currentUserRole === 'super_admin' && (
              <AccessManagementView
                allowedUsers={allowedUsers}
                projects={projects}
                onAddUser={handleAddUser}
                onEditUser={handleEditUser}
                onRemoveUser={handleRemoveUser}
                currentUserEmail={currentUserEmail}
                lang={lang}
              />
            )}

            {activeTab === 'logs' && currentUserRole === 'super_admin' && (
              <LogsView
                lang={lang}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {!isBloggerCabinetRoute && !isRequisitesRoute && (
        <nav 
          className="fixed bottom-0 left-0 right-0 bg-white/95 border-t border-neutral-200/90 z-50 md:hidden shadow-lg backdrop-blur-md overflow-x-auto"
          style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-around min-w-full h-16 px-1 gap-1">
            {/* Projects Tab */}
            {hasPageAccess('projects') && (
              <button
                onClick={() => setActiveTab('projects')}
                className={`flex flex-col items-center justify-center flex-1 min-w-[58px] py-1 text-center transition-all duration-150 ${
                  activeTab === 'projects' ? 'text-black scale-105 font-black' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <FolderKanban className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[65px]">
                  {lang === 'ru' ? 'Проекты' : lang === 'uz' ? 'Loyihalar' : 'Projects'}
                </span>
              </button>
            )}

            {/* Kanban Tab */}
            {hasPageAccess('kanban') && (
              <button
                onClick={() => setActiveTab('kanban')}
                className={`flex flex-col items-center justify-center flex-1 min-w-[58px] py-1 text-center transition-all duration-150 ${
                  activeTab === 'kanban' ? 'text-black scale-105 font-black' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <Kanban className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[65px]">
                  {lang === 'ru' ? 'Канбан' : lang === 'uz' ? 'Kanban' : 'Kanban'}
                </span>
              </button>
            )}

            {/* Bloggers Tab */}
            {hasPageAccess('bloggers') && (
              <button
                onClick={() => setActiveTab('bloggers')}
                className={`flex flex-col items-center justify-center flex-1 min-w-[58px] py-1 text-center transition-all duration-150 ${
                  activeTab === 'bloggers' ? 'text-black scale-105 font-black' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[65px]">
                  {lang === 'ru' ? 'Блогеры' : lang === 'uz' ? 'Bloggerlar' : 'Bloggers'}
                </span>
              </button>
            )}

            {/* Create Report Tab */}
            {currentUserRole !== 'product_manager' && hasPageAccess('reports') && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex flex-col items-center justify-center flex-1 min-w-[58px] py-1 text-center transition-all duration-150 ${
                  activeTab === 'reports' ? 'text-black scale-105 font-black' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <FilePlus className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[65px]">
                  {lang === 'ru' ? 'Отчет' : lang === 'uz' ? 'Hisobot' : 'Report'}
                </span>
              </button>
            )}

            {/* Bulk Purchases Tab */}
            {hasPageAccess('bulk_purchases') && (
              <button
                onClick={() => setActiveTab('bulk_purchases')}
                className={`flex flex-col items-center justify-center flex-1 min-w-[58px] py-1 text-center transition-all duration-150 ${
                  activeTab === 'bulk_purchases' ? 'text-black scale-105 font-black' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <Layers className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[65px]">
                  {lang === 'ru' ? 'Оптовая' : lang === 'uz' ? 'Ommaviy' : 'Bulk'}
                </span>
              </button>
            )}

            {/* Reports Feed Tab */}
            {currentUserRole !== 'product_manager' && hasPageAccess('reports_feed') && (
              <button
                onClick={() => setActiveTab('reports_feed')}
                className={`flex flex-col items-center justify-center flex-1 min-w-[58px] py-1 text-center transition-all duration-150 ${
                  activeTab === 'reports_feed' ? 'text-black scale-105 font-black' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <FileText className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[65px]">
                  {lang === 'ru' ? 'Лента' : lang === 'uz' ? 'Lenta' : 'Feed'}
                </span>
              </button>
            )}

            {/* Other Expenses Tab */}
            {currentUserRole !== 'product_manager' && hasPageAccess('other_expenses') && (
              <button
                onClick={() => setActiveTab('other_expenses')}
                className={`flex flex-col items-center justify-center flex-1 min-w-[58px] py-1 text-center transition-all duration-150 ${
                  activeTab === 'other_expenses' ? 'text-black scale-105 font-black' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <Receipt className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[65px]">
                  {lang === 'ru' ? 'Расходы' : lang === 'uz' ? 'Xarajat' : 'Expenses'}
                </span>
              </button>
            )}

            {/* Blogger Cabinet Tab */}
            {currentUserRole === 'super_admin' && (
              <button
                onClick={() => setActiveTab('blogger')}
                className={`flex flex-col items-center justify-center flex-1 min-w-[58px] py-1 text-center transition-all duration-150 ${
                  activeTab === 'blogger' ? 'text-black scale-105 font-black' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <UserSquare2 className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[65px]">
                  {lang === 'ru' ? 'Кабинет' : lang === 'uz' ? 'Kabinet' : 'Cabinet'}
                </span>
              </button>
            )}

            {/* Access Management Tab */}
            {currentUserRole === 'super_admin' && (
              <button
                onClick={() => setActiveTab('access')}
                className={`flex flex-col items-center justify-center flex-1 min-w-[58px] py-1 text-center transition-all duration-150 ${
                  activeTab === 'access' ? 'text-black scale-105 font-black' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <Shield className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[65px]">
                  {lang === 'ru' ? 'Доступ' : lang === 'uz' ? 'Ruxsat' : 'Access'}
                </span>
              </button>
            )}

            {/* System Logs Tab */}
            {currentUserRole === 'super_admin' && (
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex flex-col items-center justify-center flex-1 min-w-[58px] py-1 text-center transition-all duration-150 ${
                  activeTab === 'logs' ? 'text-black scale-105 font-black' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <Terminal className="w-5 h-5" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[65px]">
                  {lang === 'ru' ? 'Логи' : lang === 'uz' ? 'Loglar' : 'Logs'}
                </span>
              </button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

