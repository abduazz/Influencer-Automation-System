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
import BloggerCabinetView from './components/BloggerCabinetView';
import AccessManagementView from './components/AccessManagementView';
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
  resetDatabase,
} from './services/api';

import {
  Project,
  Integration,
  Report,
  BloggerSubmission,
  AllowedUser,
  INITIAL_ALLOWED_USERS
} from './data/mockData';

import { Info, HelpCircle, RefreshCw, Layers } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'projects' | 'reports' | 'blogger' | 'code' | 'access'>('projects');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const handleAddUser = async (email: string, role: 'super_admin' | 'pr_manager' | 'product_manager') => {
    const newUser = await createAllowedUser(email, role);
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
    await deleteProject(projectId);
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
  };

  const handleAddSubmission = async (newSub: Omit<BloggerSubmission, 'id' | 'submittedAt'>) => {
    const submission = await createSubmission(newSub.integrationId, newSub.data);
    setSubmissions((prev) => [submission, ...prev]);
  };

  // URL Simulator router check
  // Watcher listening for simulated link-clicks (e.g. "?cabinet=true")
  useEffect(() => {
    const handleUrlSim = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const isCabinet = searchParams.get('cabinet') === 'true';
      const platform = searchParams.get('platform');
      const slotsCount = searchParams.get('slots_count');
      const integrationId = searchParams.get('id');

      if (isCabinet) {
        setSimulatedUrlParams({
          platform: platform || undefined,
          slotsCount: slotsCount || undefined,
          integrationId: integrationId || undefined
        });
        setActiveTab('blogger');
        
        // Clean URL to prevent recurring loops
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    // Run on startup
    handleUrlSim();

    // Listen for custom address mutations
    window.addEventListener('popstate', handleUrlSim);
    return () => window.removeEventListener('popstate', handleUrlSim);
  }, []);

  // Database Reset handler
  const handleResetToFactory = async () => {
    if (confirm("Reset simulator database back to initial campaign defaults?")) {
      setLoading(true);
      try {
        await resetDatabase();
        const [users, projs, ints, reps, subs] = await Promise.all([
          fetchAllowedUsers(),
          fetchProjects(),
          fetchIntegrations(),
          fetchReports(),
          fetchSubmissions()
        ]);
        setAllowedUsers(users);
        setProjects(projs);
        setIntegrations(ints);
        setReports(reps);
        setSubmissions(subs);
        alert("Database successfully reset!");
      } catch (err) {
        console.error("Reset failed", err);
        alert("Reset failed. Check server logs.");
      } finally {
        setLoading(false);
      }
    }
  };

  // White-list Gate
  if (!currentUserEmail || !currentUserRole) {
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
    <div className={`flex bg-neutral-50 min-h-screen text-neutral-900 antialiased font-sans ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Dynamic Navigation Rail Sidebar */}
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

      {/* Main Core View Area */}
      <main className="flex-1 overflow-y-auto h-screen p-8 lg:p-12 relative">
        {/* Dynamic Simulated Query Parameter Info Bar */}
        {simulatedUrlParams.platform && (
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

        {/* Active Tab Router */}
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
          />
        )}

        {activeTab === 'reports' && currentUserRole !== 'product_manager' && (
          <ReportsView
            projects={projects}
            reports={reports}
            onAddReport={handleAddReport}
            lang={lang}
            userRole={currentUserRole}
          />
        )}

        {activeTab === 'blogger' && currentUserRole === 'super_admin' && (
          <BloggerCabinetView
            integrations={integrations}
            submissions={submissions}
            onAddSubmission={handleAddSubmission}
            urlParams={simulatedUrlParams}
            lang={lang}
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
      </main>
    </div>
  );
}

