/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AllowedUser } from '../data/mockData';
import { translations, Language } from '../translations';
import { ShieldAlert, Globe, Radio, Mail, KeyRound } from 'lucide-react';

interface LoginViewProps {
  allowedUsers: AllowedUser[];
  onLoginSuccess: (email: string, role: 'super_admin' | 'pr_manager' | 'product_manager') => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

export default function LoginView({
  allowedUsers,
  onLoginSuccess,
  lang,
  setLang,
}: LoginViewProps) {
  const t = translations[lang];

  const [emailInput, setEmailInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) return;

    // Search email in the whitelist
    const foundUser = allowedUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (foundUser) {
      onLoginSuccess(foundUser.email, foundUser.role);
    } else {
      setErrorMsg(t.accessDeniedMessage);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-neutral-50 px-4 py-12 antialiased font-sans">
      {/* Floating Language Bar */}
      <div className="absolute top-6 right-6 flex items-center gap-2 bg-white border border-neutral-200/80 p-1 rounded-xl shadow-2xs">
        <div className="flex items-center gap-1.5 px-2 text-neutral-400 font-bold text-[10px] uppercase tracking-wider">
          <Globe className="w-3.5 h-3.5" />
        </div>
        <div className="flex gap-0.5">
          {(['ru', 'uz', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition ${
                lang === l
                  ? 'bg-black text-white'
                  : 'text-neutral-500 hover:text-black hover:bg-neutral-100'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center font-bold text-white mx-auto shadow-xs">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-black text-black text-2xl tracking-tight mt-3">
            FluenceFlow
          </h1>
          <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest leading-none">
            Campaign Manager Portal
          </p>
        </div>

        {/* Central Sign-In Card */}
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-8 shadow-sm space-y-6 text-left">
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-black tracking-tight">
              {t.loginTitle}
            </h2>
            <p className="text-xs text-neutral-500 font-medium">
              {t.loginDesc}
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-bold flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                {t.userEmailLabel}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4.5 h-4.5 text-neutral-400" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder={t.loginEmailPlaceholder}
                  className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-black focus:outline-hidden transition duration-150"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-black hover:bg-neutral-800 text-white font-extrabold text-xs py-3 rounded-xl transition duration-150 shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              {t.loginBtn}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
