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
import BloggerCabinetView from './components/BloggerCabinetView';
import AccessManagementView from './components/AccessManagementView';
import LogsView from './components/LogsView';
import LoginView from './components/LoginView';
import CodeViewer from './components/CodeViewer';
import { Language } from './translations';
import {
  fetchAllowedUsers,
  createAllowedUser,
  deleteAllowedUser,
  fetchProjects,
  createProject,
  deleteProject,
  fetchIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  fetchReports,
  createReport,
  fetchSubmissions,
  createSubmission,
} from './services/api';

import {
  Project,
  Integration,
  Report,
  BloggerSubmission,
  AllowedUser,
  INITIAL_ALLOWED_USERS
} from './data/mockData';

import { Info, HelpCircle, RefreshCw, Layers, FolderKanban, FilePlus, FileText, UserSquare2, Shield, Terminal } from 'lucide-react';

export default function App() {
  // Language state (Russian by default)
  const [lang, setLang] = useState<Language>(() => {
    const cached = localStorage.getItem('ff_lang');
    return (cached as Language) || 'ru';
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
  const [activeTab, setActiveTab] = useState<'projects' | 'reports' | 'reports_feed' | 'blogger' | 'code' | 'access' | 'logs'>('projects');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState<boolean>(false);

  const handleAddUser = async (email: string, role: 'super_admin' | 'pr_manager' | 'product_manager', allowedMetrics?: string[]) => {
    const newUser = await createAllowedUser(email, role, allowedMetrics);
    setAllowedUsers((prev) => [...prev, newUser]);
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

  // Mapped URL simulated routing parameters state
  const [simulatedUrlParams, setSimulatedUrlParams] = useState<{
    platform?: string;
    slotsCount?: string;
    integrationId?: string;
  }>({});

  // Check if current URL route matches a blogger cabinet guest access pattern
  const isBloggerCabinetRoute = new URLSearchParams(window.location.search).get('cabinet') === 'true' ||
                                window.location.pathname.startsWith('/c/');

  // Core Persistent State Hook (Persisting data to server database)
  const [projects, setProjects] = useState<Project[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [submissions, setSubmissions] = useState<BloggerSubmission[]>([]);

  // Load all data from server
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [users, projs, ints, reps, subs] = await Promise.all([
          fetchAllowedUsers(),
          fetchProjects(),
          fetchIntegrations(),
          fetchReports(),
          fetchSubmissions()
        ]);

        if (!cancelled) {
          setAllowedUsers(users);
          setProjects(projs);
          setIntegrations(ints);
          setReports(reps);
          setSubmissions(subs);
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
    const project = await createProject(newProj.name, newProj.description);
    setProjects((prev) => [...prev, project]);
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
    const report = await createReport(newRep);
    setReports((prev) => [report, ...prev]);
    const ints = await fetchIntegrations();
    setIntegrations(ints);
    return report;
  };

  const handleAddSubmission = async (newSub: Omit<BloggerSubmission, 'id' | 'submittedAt'> & { lang?: string }) => {
    const submission = await createSubmission(newSub.integrationId, newSub.data, newSub.lang);
    setSubmissions((prev) => {
      const exists = prev.some(s => s.integrationId === newSub.integrationId);
      if (exists) {
        return prev.map(s => s.integrationId === newSub.integrationId ? submission : s);
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
      const isCabinet = isBloggerCabinetRoute;
      const page = params.get('page');

      if (isCabinet) {
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
      } else if (page && ['projects', 'reports', 'reports_feed', 'blogger', 'code', 'access'].includes(page)) {
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
          userEmail={currentUserEmail}
          userRole={currentUserRole}
          onLogout={handleLogout}
        />
      )}

      {/* Main Core View Area */}
      <main className={`flex-1 overflow-y-auto h-screen relative ${isTelegramWebApp ? 'p-0' : 'p-4 pb-24 md:p-8 lg:p-12'}`}>
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
            integrations={integrations}
            submissions={submissions}
            onAddSubmission={handleAddSubmission}
            urlParams={simulatedUrlParams}
            lang={lang}
            userRole={currentUserRole}
          />
        ) : (
          <>
            {activeTab === 'projects' && (
              <DashboardView
                projects={projects}
                integrations={integrations}
                submissions={submissions}
                onAddProject={handleAddProject}
                onDeleteProject={handleDeleteProject}
                onAddIntegration={handleAddIntegration}
                onEditIntegration={handleEditIntegration}
                onDeleteIntegration={handleDeleteIntegration}
                lang={lang}
                allowedMetrics={allowedUsers.find(u => u.email.toLowerCase() === currentUserEmail?.toLowerCase())?.allowedMetrics || ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics']}
                userRole={currentUserRole}
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
              />
            )}

            {activeTab === 'reports_feed' && currentUserRole !== 'product_manager' && (
              <ReportsFeedView
                projects={projects}
                reports={reports}
                lang={lang}
              />
            )}

            {activeTab === 'blogger' && (
              <BloggerCabinetView
                integrations={integrations}
                submissions={submissions}
                onAddSubmission={handleAddSubmission}
                urlParams={simulatedUrlParams}
                lang={lang}
                userRole={currentUserRole}
              />
            )}

            {activeTab === 'access' && currentUserRole === 'super_admin' && (
              <AccessManagementView
                allowedUsers={allowedUsers}
                onAddUser={handleAddUser}
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
      {!isTelegramWebApp && !isBloggerCabinetRoute && (
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

