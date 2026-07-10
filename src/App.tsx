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
  Project,
  Integration,
  Report,
  BloggerSubmission,
  AllowedUser,
  INITIAL_PROJECTS,
  INITIAL_INTEGRATIONS,
  INITIAL_REPORTS,
  INITIAL_SUBMISSIONS,
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

  // Whitelisted Users & Role State
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>(() => {
    const cached = localStorage.getItem('ff_allowed_users');
    if (cached) return JSON.parse(cached);
    return INITIAL_ALLOWED_USERS;
  });

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('ff_user_email');
  });

  const [currentUserRole, setCurrentUserRole] = useState<'super_admin' | 'pr_manager' | 'product_manager' | null>(() => {
    const cachedRole = localStorage.getItem('ff_user_role');
    if (cachedRole) return cachedRole as any;

    const email = localStorage.getItem('ff_user_email');
    if (email) {
      const cachedUsers = localStorage.getItem('ff_allowed_users');
      const usersList: AllowedUser[] = cachedUsers ? JSON.parse(cachedUsers) : INITIAL_ALLOWED_USERS;
      const found = usersList.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (found) {
        localStorage.setItem('ff_user_role', found.role);
        return found.role;
      }
    }
    return null;
  });

  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState<'projects' | 'reports' | 'blogger' | 'code' | 'access'>('projects');

  // Whitelist operations helper
  const saveAllowedUsers = (newUsers: AllowedUser[]) => {
    setAllowedUsers(newUsers);
    localStorage.setItem('ff_allowed_users', JSON.stringify(newUsers));
  };

  const handleAddUser = (email: string, role: 'super_admin' | 'pr_manager' | 'product_manager') => {
    const newUser: AllowedUser = {
      id: `user-${Date.now()}`,
      email,
      role,
      createdAt: new Date().toISOString().split('T')[0]
    };
    saveAllowedUsers([...allowedUsers, newUser]);
  };

  const handleRemoveUser = (id: string) => {
    saveAllowedUsers(allowedUsers.filter(u => u.id !== id));
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

  // Core Persistent State Hook (Persisting data to client localStorage)
  const [projects, setProjects] = useState<Project[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [submissions, setSubmissions] = useState<BloggerSubmission[]>([]);

  // Load from LocalStorage or initialize with mock data
  useEffect(() => {
    const cachedProjects = localStorage.getItem('ff_projects');
    const cachedIntegrations = localStorage.getItem('ff_integrations');
    const cachedReports = localStorage.getItem('ff_reports');
    const cachedSubmissions = localStorage.getItem('ff_submissions');

    if (cachedProjects) setProjects(JSON.parse(cachedProjects));
    else {
      setProjects(INITIAL_PROJECTS);
      localStorage.setItem('ff_projects', JSON.stringify(INITIAL_PROJECTS));
    }

    if (cachedIntegrations) setIntegrations(JSON.parse(cachedIntegrations));
    else {
      setIntegrations(INITIAL_INTEGRATIONS);
      localStorage.setItem('ff_integrations', JSON.stringify(INITIAL_INTEGRATIONS));
    }

    if (cachedReports) setReports(JSON.parse(cachedReports));
    else {
      setReports(INITIAL_REPORTS);
      localStorage.setItem('ff_reports', JSON.stringify(INITIAL_REPORTS));
    }

    if (cachedSubmissions) setSubmissions(JSON.parse(cachedSubmissions));
    else {
      setSubmissions(INITIAL_SUBMISSIONS);
      localStorage.setItem('ff_submissions', JSON.stringify(INITIAL_SUBMISSIONS));
    }
  }, []);

  // Update localStorage when state changes
  const saveProjects = (newProjects: Project[]) => {
    setProjects(newProjects);
    localStorage.setItem('ff_projects', JSON.stringify(newProjects));
  };

  const saveIntegrations = (newIntegrations: Integration[]) => {
    setIntegrations(newIntegrations);
    localStorage.setItem('ff_integrations', JSON.stringify(newIntegrations));
  };

  const saveReports = (newReports: Report[]) => {
    setReports(newReports);
    localStorage.setItem('ff_reports', JSON.stringify(newReports));
  };

  const saveSubmissions = (newSubmissions: BloggerSubmission[]) => {
    setSubmissions(newSubmissions);
    localStorage.setItem('ff_submissions', JSON.stringify(newSubmissions));
  };

  // State manipulation handlers
  const handleAddProject = (newProj: Omit<Project, 'id' | 'createdAt'>) => {
    const project: Project = {
      ...newProj,
      id: `proj-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    saveProjects([...projects, project]);
  };

  const handleDeleteProject = (projectId: string) => {
    const remainingProj = projects.filter(p => p.id !== projectId);
    saveProjects(remainingProj);
    // Cascade delete integrations
    const remainingInt = integrations.filter(i => i.projectId !== projectId);
    saveIntegrations(remainingInt);
  };

  const handleAddIntegration = (newInt: Omit<Integration, 'id' | 'totalAmount' | 'paidAmount'>) => {
    const totalAmt = newInt.pricePerSlot * newInt.slotsCount;
    const paidSlots = newInt.paidSlotsCount !== undefined ? newInt.paidSlotsCount : newInt.slotsCount;
    const paidAmt = newInt.pricePerSlot * paidSlots;
    const cleanBloggerName = newInt.bloggerName.replace(/[@#]/g, '').trim();
    const token = `tok_${Date.now()}_${cleanBloggerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const integration: Integration = {
      ...newInt,
      id: `int-${Date.now()}`,
      paidSlotsCount: paidSlots,
      paidAmount: paidAmt,
      totalAmount: totalAmt,
      bloggerCabinetToken: token
    };
    saveIntegrations([...integrations, integration]);
  };

  const handleEditIntegration = (id: string, updatedFields: Partial<Integration>) => {
    const updatedInts = integrations.map(item => {
      if (item.id === id) {
        const merged = { ...item, ...updatedFields };
        merged.totalAmount = merged.pricePerSlot * merged.slotsCount;
        merged.paidAmount = merged.pricePerSlot * (merged.paidSlotsCount !== undefined ? merged.paidSlotsCount : merged.slotsCount);
        return merged;
      }
      return item;
    });
    saveIntegrations(updatedInts);
  };

  const handleDeleteIntegration = (id: string) => {
    saveIntegrations(integrations.filter(i => i.id !== id));
  };

  const handleAddReport = (newRep: Omit<Report, 'id' | 'totalAmount' | 'paidAmount' | 'projectName'>) => {
    const totalAmt = newRep.slotsCount * newRep.pricePerSlot;
    const paidAmt = newRep.paidSlotsCount * newRep.pricePerSlot;
    
    const report: Report = {
      ...newRep,
      id: `rep-${Date.now()}`,
      paidAmount: paidAmt,
      totalAmount: totalAmt
    };

    // Auto-create Integration record as requested by user
    const cleanBloggerName = newRep.channelBlogger.replace(/[@#]/g, '').trim();
    const token = `tok_${Date.now()}_${cleanBloggerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const referralLink = `https://fluenceflow.net/p/${newRep.projectId}?utm_source=${cleanBloggerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    const startDate = newRep.date;
    const parsedDate = new Date(startDate);
    parsedDate.setDate(parsedDate.getDate() + 14);
    const endDate = parsedDate.toISOString().split('T')[0];

    const integration: Integration = {
      id: `int-${Date.now()}`,
      projectId: newRep.projectId,
      bloggerName: cleanBloggerName,
      startDate,
      platform: newRep.platform,
      referralLink,
      pricePerSlot: newRep.pricePerSlot,
      slotsCount: newRep.slotsCount,
      paidSlotsCount: newRep.paidSlotsCount,
      paidAmount: paidAmt,
      totalAmount: totalAmt,
      endDate,
      status: 'active',
      bloggerCabinetToken: token,
      slotsConfig: newRep.slotsConfig
    };

    saveReports([report, ...reports]);
    saveIntegrations([integration, ...integrations]);
  };

  const handleAddSubmission = (newSub: Omit<BloggerSubmission, 'id' | 'submittedAt'>) => {
    const submission: BloggerSubmission = {
      ...newSub,
      id: `sub-${Date.now()}`,
      submittedAt: new Date().toISOString()
    };
    saveSubmissions([submission, ...submissions]);
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

  // Soft Reset to factory initial states
  const handleResetToFactory = () => {
    if (confirm("Reset simulator database back to initial campaign demos?")) {
      localStorage.clear();
      setProjects(INITIAL_PROJECTS);
      setIntegrations(INITIAL_INTEGRATIONS);
      setReports(INITIAL_REPORTS);
      setSubmissions(INITIAL_SUBMISSIONS);
      setAllowedUsers(INITIAL_ALLOWED_USERS);
      localStorage.setItem('ff_projects', JSON.stringify(INITIAL_PROJECTS));
      localStorage.setItem('ff_integrations', JSON.stringify(INITIAL_INTEGRATIONS));
      localStorage.setItem('ff_reports', JSON.stringify(INITIAL_REPORTS));
      localStorage.setItem('ff_submissions', JSON.stringify(INITIAL_SUBMISSIONS));
      localStorage.setItem('ff_allowed_users', JSON.stringify(INITIAL_ALLOWED_USERS));
      window.location.reload();
    }
  };

  // White-list Gate
  if (!currentUserEmail || !currentUserRole) {
    return (
      <LoginView
        allowedUsers={allowedUsers}
        onLoginSuccess={handleLoginSuccess}
        lang={lang}
        setLang={handleSetLang}
      />
    );
  }

  return (
    <div className="flex bg-neutral-50 min-h-screen text-neutral-900 antialiased font-sans">
      {/* Dynamic Navigation Rail Sidebar */}
      <Sidebar 
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

