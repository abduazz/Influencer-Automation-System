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
import ReportsView from './components/ReportsView';
import ReportsFeedView from './components/ReportsFeedView';
import BulkPurchasesView from './components/BulkPurchasesView';
import BloggerCabinetView from './components/BloggerCabinetView';
import AccessManagementView from './components/AccessManagementView';
import LogsView from './components/LogsView';
import LoginView from './components/LoginView';
import CodeViewer from './components/CodeViewer';
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

import { Info, HelpCircle, RefreshCw, Layers, FolderKanban, FilePlus, FileText, UserSquare2, Shield, Terminal, LogOut } from 'lucide-react';

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

  const [currentUserRole, setCurrentUserRole] = useState<'super_admin' | 'pr_manager' | 'product_manager' | null>(() => {
    const cachedRole = localStorage.getItem('ff_user_role');
    if (cachedRole) return cachedRole as any;

    return null;
  });

  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState<'projects' | 'reports' | 'reports_feed' | 'other_expenses' | 'blogger' | 'code' | 'access' | 'logs'>('projects');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState<boolean>(false);
  const [reportsInitialState, setReportsInitialState] = useState<{
    projectId?: string;
    bloggerName?: string;
    paymentType?: 'prepaid' | 'full' | 'other' | 'remaining';
  } | null>(null);


  const handleAddUser = async (name: string, email: string, role: 'super_admin' | 'pr_manager' | 'product_manager', allowedMetrics?: string[], allowedPages?: string[]) => {
    const newUser = await createAllowedUser(name, email, role, allowedMetrics, allowedPages);
    setAllowedUsers((prev) => [...prev, newUser]);
  };

  const handleEditUser = async (id: string, name: string, role: 'super_admin' | 'pr_manager' | 'product_manager', allowedMetrics?: string[], allowedPages?: string[]) => {
    const updatedUser = await updateAllowedUser(id, name, role, allowedMetrics, allowedPages);
    setAllowedUsers((prev) => prev.map((u) => u.id === id ? updatedUser : u));
  };

  const handleRemoveUser = async (id: string) => {
    await deleteAllowedUser(id);
    setAllowedUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleLoginSuccess = (email: string, role: 'super_admin' | 'pr_manager' | 'product_manager') => {
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

  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        setIsInputFocused(true);
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        setTimeout(() => {
          const activeEl = document.activeElement;
          if (!activeEl || (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA' && activeEl.tagName !== 'SELECT')) {
            setIsInputFocused(false);
          }
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

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

  const handleRefreshAllData = async () => {
    try {
      const [projs, ints, reps, bulks] = await Promise.all([
        fetchProjects(),
        fetchIntegrations(),
        fetchReports(),
        fetchBulkPurchases(),
      ]);
      setProjects(projs);
      setIntegrations(ints);
      setReports(reps);
      setBulkPurchases(bulks);
    } catch (err) {
      console.error("Failed to refresh data", err);
    }
  };

  // Load all data from server
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [users, projs, ints, reps, subs, bulks] = await Promise.all([
          fetchAllowedUsers(),
          fetchProjects(),
          fetchIntegrations(),
          fetchReports(),
          fetchSubmissions(),
          fetchBulkPurchases(),
        ]);

        if (!cancelled) {
          setAllowedUsers(users);
          setProjects(projs);
          setIntegrations(ints);
          setReports(reps);
          setSubmissions(subs);
          setBulkPurchases(bulks);
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

    const found = allowedUsers.find(
      (u) => u.email.toLowerCase() === currentUserEmail.toLowerCase()
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
    const project = await createProject(newProj.name, newProj.description, newProj.telegramThreadId);
    setProjects((prev) => [...prev, project]);
  };

  const handleEditProject = async (id: string, name: string, description: string, telegramThreadId?: string) => {
    const updated = await updateProject(id, name, description, telegramThreadId, currentUserEmail || undefined);
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
    const integration = await createIntegration(newInt);
    setIntegrations((prev) => [...prev, integration]);
  };

  const handleEditIntegration = async (id: string, updatedFields: Partial<Integration>) => {
    const integration = await updateIntegration(id, updatedFields);
    setIntegrations((prev) => prev.map(item => item.id === id ? integration : item));
  };

  const handleDeleteIntegration = async (id: string) => {
    await deleteIntegration(id);
    setIntegrations((prev) => prev.filter(i => i.id !== id));
  };

  const handleAddReport = async (newRep: Omit<Report, 'id' | 'totalAmount' | 'paidAmount' | 'projectName'>) => {
    const report = await createReport(newRep, currentUserEmail || undefined);
    setReports((prev) => [report, ...prev]);
    const ints = await fetchIntegrations();
    setIntegrations(ints);
    return report;
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
        localStorage.setItem('ff_user_email', 'telegram-manager@fluenceflow.net');
        localStorage.setItem('ff_user_role', 'super_admin');
        setCurrentUserEmail('telegram-manager@fluenceflow.net');
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
      } else if (page && ['projects', 'reports', 'reports_feed', 'other_expenses', 'blogger', 'code', 'access', 'logs'].includes(page)) {
        setActiveTab(page as any);
      } else if (!isTg) {
        setActiveTab('projects');
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
    if (isBloggerCabinetRoute) return;

    const params = new URLSearchParams(window.location.search);
    
    if (activeTab === 'blogger') {
      if (params.get('cabinet') !== 'true') {
        params.set('cabinet', 'true');
        params.delete('page');
        window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
      }
    } else {
      if (params.get('page') !== activeTab) {
        params.delete('cabinet');
        params.delete('id');
        params.delete('platform');
        params.delete('slots_count');
        params.set('page', activeTab);
        window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
      }
    }
  }, [activeTab, isBloggerCabinetRoute]);

  // Resolve allowed pages for the active user
  const activeUser = allowedUsers.find(u => u.email.toLowerCase() === currentUserEmail?.toLowerCase());
  const allowedPages = activeUser?.allowedPages || ['projects', 'reports', 'bulk_purchases', 'reports_feed', 'other_expenses'];

  // Enforce page-level access control: redirect user to their first allowed page if active tab is forbidden
  useEffect(() => {
    if (isBloggerCabinetRoute) return;
    if (!currentUserRole || currentUserRole === 'super_admin') return;

    const isAllowedTab = activeTab === 'bulk_purchases' ? true : allowedPages.includes(activeTab);
    const isSystemTab = ['access', 'logs', 'blogger'].includes(activeTab);

    if (!isAllowedTab && !isSystemTab) {
      if (allowedPages.length > 0) {
        setActiveTab(allowedPages[0] as any);
      }
    }
  }, [activeTab, allowedPages, currentUserRole, isBloggerCabinetRoute]);

  // White-list Gate (bypass if it's the guest blogger cabinet page)
  if (!isBloggerCabinetRoute && (!currentUserEmail || !currentUserRole)) {
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
      {!isTelegramWebApp && !isBloggerCabinetRoute && (
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
      {!isTelegramWebApp && !isBloggerCabinetRoute && (
        <header className="fixed top-0 left-0 right-0 bg-white/90 border-b border-neutral-200/85 h-14 flex items-center justify-between px-4 z-50 md:hidden shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs tracking-wider uppercase text-neutral-800">
              FluenceFlow
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
      <main className={`flex-1 overflow-y-auto h-screen relative ${isTelegramWebApp ? 'p-0' : 'pt-18 p-4 pb-24 md:p-8 lg:p-12 md:pt-8'}`}>
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
        {isBloggerCabinetRoute ? (
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
            {activeTab === 'projects' && (
              <DashboardView
                projects={projects}
                integrations={integrations}
                submissions={submissions}
                onAddProject={handleAddProject}
                onEditProject={handleEditProject}
                onDeleteProject={handleDeleteProject}
                onAddIntegration={handleAddIntegration}
                onEditIntegration={handleEditIntegration}
                onDeleteIntegration={handleDeleteIntegration}
                lang={lang}
                allowedMetrics={allowedUsers.find(u => u.email.toLowerCase() === currentUserEmail?.toLowerCase())?.allowedMetrics || ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics']}
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
            )}

            {activeTab === 'reports' && currentUserRole !== 'product_manager' && (
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

            {activeTab === 'bulk_purchases' && (
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

            {activeTab === 'other_expenses' && currentUserRole !== 'product_manager' && (
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
      {!isTelegramWebApp && !isBloggerCabinetRoute && !isInputFocused && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200/80 h-16 flex items-center justify-around px-2 z-50 md:hidden shadow-lg backdrop-blur-md">
          {/* Projects Tab */}
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all duration-150 ${
              activeTab === 'projects' ? 'text-black scale-105' : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            <FolderKanban className="w-5 h-5" />
            <span className="text-[9px] font-black mt-1 truncate max-w-[70px]">
              {lang === 'ru' ? 'Проекты' : lang === 'uz' ? 'Loyihalar' : 'Projects'}
            </span>
          </button>

          {/* Create Report Tab */}
          {currentUserRole !== 'product_manager' && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all duration-150 ${
                activeTab === 'reports' ? 'text-black scale-105' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <FilePlus className="w-5 h-5" />
              <span className="text-[9px] font-black mt-1 truncate max-w-[70px]">
                {lang === 'ru' ? 'Отчет' : lang === 'uz' ? 'Hisobot' : 'Report'}
              </span>
            </button>
          )}

          {/* Bulk Purchases Tab */}
          <button
            onClick={() => setActiveTab('bulk_purchases')}
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all duration-150 ${
              activeTab === 'bulk_purchases' ? 'text-black scale-105' : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-[9px] font-black mt-1 truncate max-w-[70px]">
              {lang === 'ru' ? 'Оптовая' : lang === 'uz' ? 'Ommaviy' : 'Bulk'}
            </span>
          </button>

          {/* Reports Feed Tab */}
          {currentUserRole !== 'product_manager' && (
            <button
              onClick={() => setActiveTab('reports_feed')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all duration-150 ${
                activeTab === 'reports_feed' ? 'text-black scale-105' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span className="text-[9px] font-black mt-1 truncate max-w-[70px]">
                {lang === 'ru' ? 'Лента' : lang === 'uz' ? 'Lenta' : 'Feed'}
              </span>
            </button>
          )}

          {/* Blogger Cabinet Tab */}
          {currentUserRole === 'super_admin' && (
            <button
              onClick={() => setActiveTab('blogger')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all duration-150 ${
                activeTab === 'blogger' ? 'text-black scale-105' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <UserSquare2 className="w-5 h-5" />
              <span className="text-[9px] font-black mt-1 truncate max-w-[70px]">
                {lang === 'ru' ? 'Кабинет' : lang === 'uz' ? 'Kabinet' : 'Cabinet'}
              </span>
            </button>
          )}

          {/* Access Management Tab */}
          {currentUserRole === 'super_admin' && (
            <button
              onClick={() => setActiveTab('access')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all duration-150 ${
                activeTab === 'access' ? 'text-black scale-105' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="text-[9px] font-black mt-1 truncate max-w-[70px]">
                {lang === 'ru' ? 'Доступ' : lang === 'uz' ? 'Ruxsat' : 'Access'}
              </span>
            </button>
          )}

          {/* System Logs Tab */}
          {currentUserRole === 'super_admin' && (
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all duration-150 ${
                activeTab === 'logs' ? 'text-black scale-105' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <Terminal className="w-5 h-5" />
              <span className="text-[9px] font-black mt-1 truncate max-w-[70px]">
                {lang === 'ru' ? 'Логи' : lang === 'uz' ? 'Loglar' : 'Logs'}
              </span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

