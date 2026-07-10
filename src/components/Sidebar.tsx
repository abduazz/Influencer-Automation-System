/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  FolderKanban, 
  FilePlus, 
  UserSquare2, 
  Radio, 
  Layers,
  Globe
} from 'lucide-react';
import { Language, translations } from '../translations';

interface SidebarProps {
  activeTab: 'projects' | 'reports' | 'blogger' | 'code';
  setActiveTab: (tab: 'projects' | 'reports' | 'blogger' | 'code') => void;
  projectsCount: number;
  integrationsCount: number;
  lang: Language;
  setLang: (lang: Language) => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  projectsCount, 
  integrationsCount,
  lang,
  setLang
}: SidebarProps) {
  const t = translations[lang];

  return (
    <aside className="w-80 bg-white border-r border-neutral-200 flex flex-col justify-between h-screen sticky top-0 text-neutral-800">
      {/* Upper Brand */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center font-bold text-white">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-black text-black text-lg tracking-tight animate-pulse">
              FluenceFlow
            </h1>
            <p className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
              Campaign Manager
            </p>
          </div>
        </div>

        {/* Main Navigation Menu */}
        <nav className="space-y-1.5">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-3 mb-2">
            {t.workspace}
          </p>

          <button
            id="nav-projects-btn"
            onClick={() => setActiveTab('projects')}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 group ${
              activeTab === 'projects'
                ? 'bg-black text-white'
                : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <FolderKanban className="w-4 h-4" />
              <span>{t.projectsAndIntegrations}</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'projects' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}>
              {projectsCount}
            </span>
          </button>

          <button
            id="nav-reports-btn"
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 group ${
              activeTab === 'reports'
                ? 'bg-black text-white'
                : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <FilePlus className="w-4 h-4" />
              <span>{t.createReport}</span>
            </div>
          </button>

          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-3 pt-6 mb-2">
            {t.bloggerPortal}
          </p>

          <button
            id="nav-blogger-btn"
            onClick={() => setActiveTab('blogger')}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 group ${
              activeTab === 'blogger'
                ? 'bg-black text-white'
                : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <UserSquare2 className="w-4 h-4" />
              <span>{t.bloggerWorkCabinet}</span>
            </div>
          </button>
        </nav>
      </div>

      <div>
        {/* Language Switcher */}
        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/30">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2.5">
            <Globe className="w-3.5 h-3.5" />
            <span>{t.language}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-neutral-100 p-1 rounded-lg">
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

        {/* Footer (Simplified to absolute minimum) */}
        <div className="p-6 border-t border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t.systemActive}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
