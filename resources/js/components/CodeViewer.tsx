/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LARAVEL_FILAMENT_CODE, CodeBlock } from '../laravelCode';
import { 
  Copy, 
  Check, 
  FileCode, 
  Layers, 
  FolderIcon, 
  Info,
  Database,
  Grid,
  Zap
} from 'lucide-react';

export default function CodeViewer() {
  const [selectedCategory, setSelectedCategory] = useState<'Migrations' | 'Models' | 'Filament Resources' | 'Blogger Cabinet'>('Migrations');
  
  // Filter codeblocks by active category
  const activeBlocks = LARAVEL_FILAMENT_CODE.filter(b => b.category === selectedCategory);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(activeBlocks[0]?.id || 'mig-projects');

  // If active block doesn't exist in current category, auto-select first from active category
  const activeBlock = LARAVEL_FILAMENT_CODE.find(b => b.id === selectedBlockId) || activeBlocks[0];

  // Copy-paste state
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBlockId(id);
    setTimeout(() => {
      setCopiedBlockId(null);
    }, 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* View Header */}
      <div className="border-b border-slate-200 pb-5 text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Laravel 11 & Filament v3 Code Hub</h2>
          <p className="text-sm text-slate-500">
            Pragmatic, production-ready, highly commented PHP components, Eloquent relationships, and forms schemas.
          </p>
        </div>

        {/* Copy All Info */}
        <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          PHP STACK: Laravel 11.x + Livewire 3.x + Filament v3
        </span>
      </div>

      {/* Category selector pills */}
      <div className="flex flex-wrap gap-2 text-left">
        {(['Migrations', 'Models', 'Filament Resources', 'Blogger Cabinet'] as const).map((cat) => {
          const count = LARAVEL_FILAMENT_CODE.filter(b => b.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                const firstOfCat = LARAVEL_FILAMENT_CODE.find(b => b.category === cat);
                if (firstOfCat) setSelectedBlockId(firstOfCat.id);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                selectedCategory === cat
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {cat === 'Migrations' && <Database className="w-4 h-4" />}
              {cat === 'Models' && <Layers className="w-4 h-4" />}
              {cat === 'Filament Resources' && <Grid className="w-4 h-4" />}
              {cat === 'Blogger Cabinet' && <Zap className="w-4 h-4" />}
              <span>{cat}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                selectedCategory === cat ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Split screen file browser & code viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left pane: File listing index */}
        <div className="lg:col-span-3 space-y-4 text-left">
          <div className="flex items-center gap-1.5">
            <FolderIcon className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              File Index
            </h3>
          </div>

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-2">
            {activeBlocks.map((b) => {
              const isSelected = activeBlock?.id === b.id;

              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBlockId(b.id)}
                  className={`p-3 border-2 rounded-xl cursor-pointer transition-all duration-150 relative overflow-hidden group ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 text-amber-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-extrabold text-xs truncate font-mono">{b.filename}</p>
                  <p className="text-[10px] text-slate-400 mt-1 truncate font-mono">{b.path}</p>
                </div>
              );
            })}
          </div>

          {/* Quick Guide card */}
          {activeBlock && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Info className="w-4 h-4 text-amber-500" />
                <span>Architect Guide</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {activeBlock.description}
              </p>
            </div>
          )}
        </div>

        {/* Right pane: Elegant code canvas with editor-style titlebar */}
        <div className="lg:col-span-9 space-y-4">
          {activeBlock ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-left">
              {/* Editor Title Bar */}
              <div className="bg-slate-900 border-b border-slate-800/80 px-5 py-3 flex justify-between items-center text-slate-300">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-mono font-bold">{activeBlock.path}</span>
                </div>

                <button
                  onClick={() => handleCopy(activeBlock.code, activeBlock.id)}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-700/60 transition"
                >
                  {copiedBlockId === activeBlock.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Precise Code block */}
              <div className="p-6 overflow-x-auto text-slate-300 font-mono text-xs leading-relaxed max-h-[580px] overflow-y-auto">
                <pre><code>{activeBlock.code}</code></pre>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
              <p className="text-sm text-slate-500">Please choose a file to inspect its code.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
