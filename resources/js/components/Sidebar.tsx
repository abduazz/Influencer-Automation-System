/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FolderKanban, 
  FilePlus, 
  FileText,
  UserSquare2, 
  Radio, 
  Layers,
  Globe,
  Shield,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Language, translations } from '../translations';

interface SidebarProps {
  activeTab: 'projects' | 'reports' | 'reports_feed' | 'blogger' | 'code' | 'access';
  setActiveTab: (tab: 'projects' | 'reports' | 'reports_feed' | 'blogger' | 'code' | 'access') => void;
  projectsCount: number;
  integrationsCount: number;
  lang: Language;
  setLang: (lang: Language) => void;
  userEmail: string;
  userRole: 'super_admin' | 'pr_manager' | 'product_manager';
  onLogout: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  projectsCount, 
  integrationsCount,
  lang,
  setLang,
  userEmail,
  userRole,
  onLogout,
  isCollapsed,
  setIsCollapsed
}: SidebarProps) {
  const t = translations[lang];

  return (
    <aside className={`hidden md:flex bg-white border-r border-neutral-200 flex-col justify-between h-screen sticky top-0 text-neutral-800 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-80'}`}>
      {/* Upper Brand */}
      <div className={`p-6 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
        <div className={`flex ${isCollapsed ? 'flex-col gap-4' : 'items-center justify-between'} mb-8 w-full`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center font-bold text-white shrink-0">
                <Radio className="w-4 h-4 text-white" />
              </div>
              <div className="overflow-hidden">
                <h1 className="font-black text-black text-lg tracking-tight animate-pulse truncate">
                  FluenceFlow
                </h1>
                <p className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider truncate">
                  Campaign Manager
                </p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center font-bold text-white shrink-0">
              <Radio className="w-4 h-4 text-white" />
            </div>
          )}
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-black transition duration-150 cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Main Navigation Menu */}
        <nav className="space-y-1.5 w-full">
          {!isCollapsed && (
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-3 mb-2">
              {t.workspace}
            </p>
          )}

          <button
            id="nav-projects-btn"
            onClick={() => setActiveTab('projects')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-2.5'} rounded-lg text-xs font-bold transition-all duration-150 group ${
              activeTab === 'projects'
                ? 'bg-black text-white'
                : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
            }`}
            title={t.projectsAndIntegrations}
          >
            <div className="flex items-center gap-3.5">
              <FolderKanban className="w-4 h-4" />
              {!isCollapsed && <span>{t.projectsAndIntegrations}</span>}
            </div>
            {!isCollapsed && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeTab === 'projects' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}>
                {projectsCount}
              </span>
            )}
          </button>

          {userRole !== 'product_manager' && (
            <>
              <button
                id="nav-reports-btn"
                onClick={() => setActiveTab('reports')}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-2.5'} rounded-lg text-xs font-bold transition-all duration-150 group ${
                  activeTab === 'reports'
                    ? 'bg-black text-white'
                    : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
                }`}
                title={t.createReport}
              >
                <div className="flex items-center gap-3.5">
                  <FilePlus className="w-4 h-4" />
                  {!isCollapsed && <span>{t.createReport}</span>}
                </div>
              </button>

              <button
                id="nav-reports-feed-btn"
                onClick={() => setActiveTab('reports_feed')}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-2.5'} rounded-lg text-xs font-bold transition-all duration-150 group ${
                  activeTab === 'reports_feed'
                    ? 'bg-black text-white'
                    : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
                }`}
                title={t.reportsListTab || 'Reports List'}
              >
                <div className="flex items-center gap-3.5">
                  <FileText className="w-4 h-4" />
                  {!isCollapsed && <span>{t.reportsListTab || 'Reports List'}</span>}
                </div>
              </button>
            </>
          )}

          {userRole === 'super_admin' && (
            <button
              id="nav-access-btn"
              onClick={() => setActiveTab('access')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-2.5'} rounded-lg text-xs font-bold transition-all duration-150 group ${
                activeTab === 'access'
                  ? 'bg-black text-white'
                  : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
              }`}
              title={t.accessTab}
            >
              <div className="flex items-center gap-3.5">
                <Shield className="w-4 h-4" />
                {!isCollapsed && <span>{t.accessTab}</span>}
              </div>
            </button>
          )}

          {userRole === 'super_admin' && (
            <>
              {!isCollapsed ? (
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-3 pt-6 mb-2">
                  {t.bloggerPortal}
                </p>
              ) : (
                <div className="border-t border-neutral-100 my-4 w-full" />
              )}

              <button
                id="nav-blogger-btn"
                onClick={() => setActiveTab('blogger')}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-2.5'} rounded-lg text-xs font-bold transition-all duration-150 group ${
                  activeTab === 'blogger'
                    ? 'bg-black text-white'
                    : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
                }`}
                title={t.bloggerWorkCabinet}
              >
                <div className="flex items-center gap-3.5">
                  <UserSquare2 className="w-4 h-4" />
                  {!isCollapsed && <span>{t.bloggerWorkCabinet}</span>}
                </div>
              </button>
            </>
          )}
        </nav>
      </div>

      <div>
        {/* Language Switcher */}
        <div className={`py-4 border-t border-neutral-100 bg-neutral-50/30 ${isCollapsed ? 'px-2' : 'px-6'}`}>
          {!isCollapsed && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2.5">
              <Globe className="w-3.5 h-3.5" />
              <span>{t.language}</span>
            </div>
          )}
          <div className={`grid ${isCollapsed ? 'grid-cols-1 gap-1' : 'grid-cols-3 gap-1'} bg-neutral-100 p-1 rounded-lg`}>
            {(['ru', 'uz', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`py-1 text-[10px] font-extrabold uppercase rounded-md transition ${
                  lang === l
                    ? 'bg-black text-white shadow-xs'
                    : 'text-neutral-500 hover:text-black hover:bg-neutral-200'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Profile Card and Logout */}
        <div className={`p-4 border-t border-neutral-100 bg-neutral-50/50 text-left ${isCollapsed ? 'flex flex-col items-center gap-3' : ''}`}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold shrink-0" title={userEmail}>
                <User className="w-4 h-4" />
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition duration-150 shrink-0 cursor-pointer"
                title={t.logoutBtn}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 bg-white border border-neutral-200/60 p-3 rounded-xl shadow-2xs">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-[11px] font-black text-neutral-900 truncate leading-tight" title={userEmail}>
                    {userEmail}
                  </h4>
                  <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider leading-none mt-1">
                    {userRole === 'super_admin' ? t.roleSuperAdmin : userRole === 'pr_manager' ? 'PR Manager' : 'Product'}
                  </p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition duration-150 shrink-0 cursor-pointer"
                title={t.logoutBtn}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {!isCollapsed && (
            <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-400 uppercase tracking-wider mt-3 pl-1">
              <Layers className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t.systemActive}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
