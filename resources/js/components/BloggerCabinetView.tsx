/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BloggerSubmission, Integration } from '../data/mockData';
import { 
  Upload, 
  Link, 
  Send, 
  Settings, 
  CheckCircle, 
  FileText, 
  ExternalLink,
  ChevronRight,
  Eye,
  AlertCircle
} from 'lucide-react';
import { Language, translations } from '../translations';
import { shortenUrl } from '../services/api';

interface BloggerCabinetViewProps {
  integrations: Integration[];
  submissions: BloggerSubmission[];
  onAddSubmission: (submission: Omit<BloggerSubmission, 'id' | 'submittedAt'> & { lang?: string }) => void;
  urlParams?: { platform?: string; slotsCount?: string; integrationId?: string };
  lang: Language;
  userRole?: string | null;
  setLang?: (lang: Language) => void;
}
const compressImage = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = () => {
        resolve(event.target?.result as string);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
export default function BloggerCabinetView({
  integrations,
  submissions,
  onAddSubmission,
  urlParams,
  lang,
  userRole,
  setLang
}: BloggerCabinetViewProps) {
  const t = translations[lang];

  // Controller State (allows interactive configuration in the preview)
  const [activePlatform, setActivePlatform] = useState<'Telegram' | 'Instagram' | 'YouTube' | 'MAX'>('Instagram');
  const [activeSlotsCount, setActiveSlotsCount] = useState<number>(4);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('int-2');
  const [isShortening, setIsShortening] = useState(false);

  const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId);

  const getSlotSummaryString = () => {
    if (selectedIntegration?.slotsConfig && selectedIntegration.slotsConfig.length > 0) {
      const counts: Record<string, number> = {};
      selectedIntegration.slotsConfig.forEach((cfg) => {
        const plat = cfg.platform || selectedIntegration.platform || activePlatform;
        counts[plat] = (counts[plat] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([plat, count]) => `${count} ${plat}`)
        .join(' | ');
    }
    return `${activeSlotsCount} ${activePlatform}`;
  };

  const visibleSubmissions = userRole === 'super_admin'
    ? submissions
    : submissions.filter(sub => sub.integrationId === selectedIntegrationId);

  // Load state from URL parameters if present
  useEffect(() => {
    if (urlParams?.integrationId) {
      const matched = integrations.find(i => i.id === urlParams.integrationId || i.bloggerCabinetToken === urlParams.integrationId);
      if (matched) {
        setSelectedIntegrationId(matched.id);
        setActivePlatform(matched.platform);
        setActiveSlotsCount(matched.slotsCount);
        return;
      }
    }
    
    if (urlParams?.platform) {
      const p = urlParams.platform as any;
      if (['Telegram', 'Instagram', 'YouTube'].includes(p)) {
        setActivePlatform(p);
      }
    }
    if (urlParams?.slotsCount) {
      const s = parseInt(urlParams.slotsCount);
      if (s >= 1 && s <= 10) {
        setActiveSlotsCount(s);
      }
    }
  }, [urlParams, integrations]);

  // Auto-select first integration on load if default 'int-2' is not found
  useEffect(() => {
    if (integrations.length > 0) {
      const exists = integrations.some(i => i.id === selectedIntegrationId);
      if (!exists && !urlParams?.integrationId) {
        setSelectedIntegrationId(integrations[0].id);
        setActivePlatform(integrations[0].platform);
        setActiveSlotsCount(integrations[0].slotsCount);
      }
    }
  }, [integrations, selectedIntegrationId, urlParams]);

  // Form Field States
  // Dynamic state object mapping slot keys (e.g. "slot_1") to text link or mock file name
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Re-initialize form data state when platform or slots count changes
  useEffect(() => {
    const initialData: Record<string, string> = {};
    const initialPreviews: Record<string, string> = {};

    const existingSub = submissions.find(s => s.integrationId === selectedIntegrationId);
    const submittedData = existingSub?.data || {};

    for (let i = 1; i <= activeSlotsCount; i++) {
      const key = `slot_${i}`;
      initialData[key] = submittedData[key] || '';
      
      // If it's a file submission (visual simulator), set a fake preview URL
      if (submittedData[key] && !submittedData[key].startsWith('http')) {
        initialPreviews[key] = 'mock-file-url';
      }
    }

    setFormData(initialData);
    setFilePreviews(initialPreviews);

    // Determine if form is completely submitted (locked)
    let hasUnfilled = false;
    for (let i = 1; i <= activeSlotsCount; i++) {
      const key = `slot_${i}`;
      if (!submittedData[key]) {
        hasUnfilled = true;
        break;
      }
    }

    setFormSubmitted(!!existingSub && !hasUnfilled);
    setShowConfirm(false);
  }, [activePlatform, activeSlotsCount, selectedIntegrationId, submissions, integrations]);

  // Handle file picker simulation (converting screenshot to base64 with compression)
  const handleFileChangeSim = async (slotKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        setFilePreviews(prev => ({
          ...prev,
          [slotKey]: compressedBase64
        }));
        setFormData(prev => ({
          ...prev,
          [slotKey]: compressedBase64
        }));
      } catch (err) {
        console.error('Image compression failed:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setFilePreviews(prev => ({
            ...prev,
            [slotKey]: base64String
          }));
          setFormData(prev => ({
            ...prev,
            [slotKey]: base64String
          }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleLinkChange = (slotKey: string, val: string) => {
    setFormData(prev => ({
      ...prev,
      [slotKey]: val
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const existingSub = submissions.find(s => s.integrationId === selectedIntegrationId);
    const submittedData = existingSub?.data || {};

    // 1. Custom validation for required (paid) slots
    for (let i = 1; i <= activeSlotsCount; i++) {
      const slotKey = `slot_${i}`;
      const isPaid = selectedIntegration 
        ? (i - 1 < (selectedIntegration.paidSlotsCount ?? selectedIntegration.slotsCount))
        : true;

      if (isPaid) {
        const currentValue = formData[slotKey] || submittedData[slotKey];
        if (!currentValue || currentValue.trim() === '') {
          alert(lang === 'ru'
            ? `Пожалуйста, заполните Слот #${i} (обязательное поле)!`
            : lang === 'uz'
            ? `Iltimos, Slot #${i} ni to‘ldiring (majburiy maydon)!`
            : `Please fill Slot #${i} (required field)!`
          );
          return;
        }
      }
    }

    // 2. Check if at least one new slot is being filled in this turn
    const hasNewInput = Array.from({ length: activeSlotsCount }).some((_, idx) => {
      const key = `slot_${idx + 1}`;
      return !submittedData[key] && !!formData[key];
    });

    if (!hasNewInput) {
      alert(lang === 'ru' 
        ? "Пожалуйста, заполните хотя бы один новый слот перед отправкой!" 
        : lang === 'uz' 
        ? "Iltimos, yuborishdan oldin kamida bitta yangi slotni to‘ldiring!" 
        : "Please fill at least one new slot before submitting!"
      );
      return;
    }

    setShowConfirm(true);
  };

  const handleFinalSubmit = () => {
    const confirmText = lang === 'ru' 
      ? "Вы уверены, что хотите отправить материалы? Отправленные материалы будут заблокированы и их нельзя будет изменить!" 
      : lang === 'uz' 
      ? "Materiallarni yuborishga ishonchingiz komilmi? Yuborilgan materiallar bloklanadi va ularni o‘zgartirib bo‘lmaydi!" 
      : "Are you sure you want to submit? Submitted materials will be locked and cannot be edited!";
   
    if (!window.confirm(confirmText)) {
      return;
    }

    const submittedPayload: Record<string, string> = {};
    for (let i = 1; i <= activeSlotsCount; i++) {
      const key = `slot_${i}`;
      submittedPayload[key] = formData[key] || '';
    }

    onAddSubmission({
      integrationId: selectedIntegration?.id || selectedIntegrationId,
      status: 'approved',
      data: submittedPayload,
      lang: lang
    });

    setFormSubmitted(true);
    setShowConfirm(false);
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto text-neutral-900 w-full pb-12">
      {/* Quick Blogger Switch Bar (Only visible to managers/super-admins) */}
      {userRole === 'super_admin' && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs text-xs text-left">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-neutral-500 uppercase tracking-wider text-[9px]">
              {lang === 'ru' ? 'Выбор блогера для просмотра:' : lang === 'uz' ? 'Ko‘rish uchun blogger:' : 'Select Blogger to View:'}
            </span>
            <select
              value={selectedIntegrationId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedIntegrationId(id);
                const matched = integrations.find(i => i.id === id);
                if (matched) {
                  setActivePlatform(matched.platform);
                  setActiveSlotsCount(matched.slotsCount);
                }
              }}
              className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md font-bold text-black focus:border-black outline-none cursor-pointer"
            >
              {integrations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.bloggerName} ({i.platform}, {i.slotsCount} {t.slotsColumn.toLowerCase()})
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={async () => {
              const tokenOrId = selectedIntegration?.bloggerCabinetToken || selectedIntegrationId;
              const longUrl = `${window.location.origin}/c/${tokenOrId}`;
              setIsShortening(true);
              try {
                const shortUrl = await shortenUrl(longUrl);
                await navigator.clipboard.writeText(shortUrl);
                alert(`${t.copiedAlert}\n${shortUrl}`);
              } catch (err) {
                console.error("Failed to copy short URL", err);
              } finally {
                setIsShortening(false);
              }
            }}
            disabled={isShortening}
            className="px-3.5 py-1.5 bg-black hover:bg-neutral-900 text-white font-extrabold rounded-lg transition duration-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Link className="w-3.5 h-3.5" />
            <span>{isShortening ? (lang === 'ru' ? 'Сокращение...' : 'Shortening...') : (lang === 'ru' ? 'Копировать ссылку для блогера' : lang === 'uz' ? 'Blogger havolasini nusxalash' : 'Copy Blogger Link')}</span>
          </button>
        </div>
      )}

      {/* The Interactive Guest Web Page Frame */}
      <div className="space-y-6">
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
            {/* Blogger Portal Inside Content */}
            <div className="p-6 text-left bg-neutral-50 min-h-[420px] flex flex-col justify-between">
              {formSubmitted ? (
                /* Success Screen */
                <div className="max-w-md mx-auto text-center py-10 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-black">{t.alreadySubmittedTitle}</h3>
                    <p className="text-xs text-neutral-500 mt-1">
                      {t.alreadySubmittedDesc}
                    </p>
                  </div>
                  
                  <div className="p-3.5 bg-white border border-neutral-200 rounded-lg text-[11px] text-neutral-600 max-w-sm mx-auto text-left">
                    <p className="font-bold text-black mb-1.5 border-b border-neutral-100 pb-1">Data:</p>
                    {Object.entries(formData).map(([key, val]) => (
                      <div key={key} className="flex justify-between py-1 border-b border-neutral-50 last:border-0 font-mono">
                        <span className="text-neutral-400">{key}:</span>
                        <span className="font-bold text-black truncate max-w-[180px]">
                          {typeof val === 'string' && val.startsWith('data:image/') 
                            ? (lang === 'ru' ? '📸 Скриншот' : lang === 'uz' ? '📸 Skrinshot' : '📸 Screenshot')
                            : val}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setFormSubmitted(false)}
                    className="px-5 py-2 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded transition duration-150"
                  >
                    {t.resubmitBtn}
                  </button>
                </div>
              ) : showConfirm ? (
                /* Confirmation Review Screen */
                <div className="space-y-4 max-w-xl mx-auto w-full text-left">
                  <div className="text-center">
                    <h2 className="text-base font-black text-black tracking-tight">
                      {lang === 'ru' ? 'Подтверждение отправки' : lang === 'uz' ? 'Yuborishni tasdiqlash' : 'Confirm Submission'}
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">
                      {lang === 'ru' ? 'Пожалуйста, проверьте правильность введенных ссылок. После отправки редактирование невозможно.' : 
                       lang === 'uz' ? 'Iltimos, kiritilgan havolalar to‘g‘riligini tekshiring. Yuborilganidan so‘ng tahrirlab bo‘lmaydi.' : 
                       'Please review your links. You will not be able to modify them after submission.'}
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-neutral-200 rounded-xl space-y-3 shadow-2xs">
                    {Array.from({ length: activeSlotsCount }).map((_, index) => {
                      const slotNum = index + 1;
                      const slotKey = `slot_${slotNum}`;
                      const slotConfig = selectedIntegration?.slotsConfig?.[index];
                      const slotPlatform = slotConfig ? slotConfig.platform : activePlatform;
                      const slotFormat = slotConfig ? slotConfig.format : (activePlatform === 'Instagram' ? 'Stories' : activePlatform === 'Telegram' ? 'Post' : 'Release');
                      const isPaid = selectedIntegration 
                        ? (index < (selectedIntegration.paidSlotsCount ?? selectedIntegration.slotsCount))
                        : true;

                      if (!isPaid) return null;

                      return (
                        <div key={slotKey} className="flex justify-between items-center py-1.5 border-b border-neutral-100 last:border-0 last:pb-0 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-neutral-700">Слот #{slotNum}:</span>
                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 uppercase">
                              {slotPlatform} - {slotFormat}
                            </span>
                          </div>
                          <span className="font-mono text-black truncate max-w-[240px] select-all font-bold">
                            {formData[slotKey]?.startsWith('data:image/') 
                              ? (lang === 'ru' ? '📸 Скриншот' : lang === 'uz' ? '📸 Skrinshot' : '📸 Screenshot')
                              : formData[slotKey] || '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 py-2.5 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      {lang === 'ru' ? 'Назад / Изменить' : lang === 'uz' ? 'Orqaga / O‘zgartirish' : 'Back / Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={handleFinalSubmit}
                      className="flex-1 py-2.5 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      {lang === 'ru' ? 'Подтверждаю отправку' : lang === 'uz' ? 'Yuborishni tasdiqlayman' : 'Confirm & Submit'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Interactive Submission Form */
                <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto w-full">
                  <div className="flex justify-between items-center border-b border-neutral-100 pb-3 mb-4">
                    <div className="text-left">
                      <h2 className="text-base font-black text-black tracking-tight">{t.bloggerCabinetTitle}</h2>
                      <p className="text-[10px] text-neutral-500 mt-0.5">
                        {lang === 'ru' ? 'Слоты по платформам' : lang === 'uz' ? 'Platformalar bo‘yicha slotlar' : 'Slots by Platform'}:{' '}
                        <span className="font-bold text-black">{getSlotSummaryString()}</span>
                      </p>
                    </div>
                    {/* Compact Language Switcher */}
                    {setLang && (
                      <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 shrink-0">
                        {(['ru', 'uz', 'en'] as const).map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setLang(l)}
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
                    )}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-neutral-200">
                    {/* Generates EXACTLY activeSlotsCount fields according to configuration */}
                    {Array.from({ length: activeSlotsCount }).map((_, index) => {
                      const slotNum = index + 1;
                      const slotKey = `slot_${slotNum}`;

                      const existingSub = submissions.find(s => s.integrationId === selectedIntegrationId);
                      const submittedData = existingSub?.data || {};
                      const isSlotSubmitted = !!(submittedData[slotKey]);

                      // Retrieve individual slot configuration if set in Report Form
                      const slotConfig = selectedIntegration?.slotsConfig?.[index];
                      const slotPlatform = slotConfig ? slotConfig.platform : activePlatform;
                      const slotFormat = slotConfig ? slotConfig.format : (activePlatform === 'Instagram' ? 'Stories' : activePlatform === 'Telegram' ? 'Post' : 'Release');

                      // Check if slot is prepaid based on selectedIntegration
                      const isPaid = selectedIntegration 
                        ? (index < (selectedIntegration.paidSlotsCount ?? selectedIntegration.slotsCount))
                        : true; // fallback to true if no integration mapped

                      return (
                        <div 
                          key={slotKey} 
                          className="p-4 bg-white border border-neutral-200 shadow-2xs rounded-xl space-y-3 transition duration-150"
                        >
                          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black text-black uppercase tracking-wider">
                                {t.slotLabel} #{slotNum}
                              </span>
                              
                              {/* Specific Platform & Format Badge */}
                              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide border ${
                                slotPlatform === 'Instagram'
                                  ? 'bg-pink-50 text-pink-600 border-pink-100'
                                  : slotPlatform === 'Telegram'
                                  ? 'bg-sky-50 text-sky-600 border-sky-100'
                                  : 'bg-red-50 text-red-600 border-red-100'
                              }`}>
                                {slotPlatform} - {slotFormat}
                              </span>

                              {isPaid ? (
                                <span className="text-[8px] bg-black text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                                  {t.paidSuffix}
                                </span>
                              ) : (
                                <span className="text-[8px] bg-neutral-100 text-neutral-400 border border-neutral-200 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                                  {t.statusPending}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-neutral-400 font-bold">
                              {isPaid ? 'Required *' : 'Active'}
                            </span>
                          </div>

                          {(slotPlatform === 'Instagram' && slotFormat === 'Stories') ? (
                            /* SCREENSHOT FILE UPLOAD COMPONENT FOR INSTAGRAM STORIES ONLY */
                            <div className="space-y-2">
                              {isSlotSubmitted ? (
                                <div className="flex items-center gap-3 p-2.5 bg-neutral-100 border border-neutral-200 rounded-xl opacity-90 select-none text-left">
                                  <div className="w-10 h-10 rounded bg-white overflow-hidden border border-neutral-200 shrink-0 flex items-center justify-center">
                                    {formData[slotKey]?.startsWith('mock') || !filePreviews[slotKey] ? (
                                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                                    ) : (
                                      <img src={filePreviews[slotKey]} alt="Screenshot" className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-black truncate">{formData[slotKey]}</p>
                                    <p className="text-[9px] text-emerald-600 font-extrabold uppercase">✓ {lang === 'ru' ? 'Отправлено' : lang === 'uz' ? 'Yuborilgan' : 'Submitted'}</p>
                                  </div>
                                </div>
                              ) : filePreviews[slotKey] ? (
                                <div className="flex items-center gap-3 p-2 bg-neutral-50 border border-neutral-200 rounded-lg">
                                  <div className="w-10 h-10 rounded bg-white overflow-hidden border border-neutral-200 shrink-0">
                                    <img src={filePreviews[slotKey]} alt="Screenshot" className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-black truncate">{formData[slotKey]}</p>
                                    <p className="text-[9px] text-neutral-500">Screenshot proof loaded</p>
                                  </div>
                                  <label className="text-[10px] font-bold text-black hover:bg-neutral-50 px-2.5 py-1 bg-white border border-neutral-200 rounded cursor-pointer transition shrink-0">
                                    Change
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleFileChangeSim(slotKey, e)}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
                              ) : (
                                <div className="border border-dashed border-neutral-200 hover:border-black rounded-lg p-5 transition duration-150 bg-neutral-50/50 flex flex-col items-center justify-center cursor-pointer text-center relative group">
                                  <Upload className="w-5 h-5 text-neutral-300 group-hover:text-black mb-1.5 transition" />
                                  <p className="text-[11px] font-bold text-neutral-600">{t.uploadProof} ({slotFormat})</p>
                                  <p className="text-[9px] text-neutral-400 mt-0.5">PNG, JPG up to 10MB</p>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileChangeSim(slotKey, e)}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            /* URL TEXT INPUT FIELD FOR ALL POSTS/REELS/RELEASES (INCLUDING INSTAGRAM REELS/POSTS) */
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Link className="w-3.5 h-3.5 text-neutral-400" />
                              </div>
                              <input
                                type="text"
                                disabled={isSlotSubmitted}
                                placeholder={
                                  slotPlatform === 'Instagram'
                                    ? `e.g. https://instagram.com/reel/abc123xyz (${slotFormat})`
                                    : slotPlatform === 'Telegram' 
                                    ? `e.g. https://t.me/channel_name/123 (${slotFormat})` 
                                    : `e.g. https://youtube.com/watch?v=abc123xyz (${slotFormat})`
                                }
                                value={formData[slotKey] || ''}
                                onChange={(e) => handleLinkChange(slotKey, e.target.value)}
                                className={`w-full pl-9 pr-10 py-1.5 border focus:border-black rounded-md text-xs focus:outline-none transition ${
                                  isSlotSubmitted 
                                    ? 'bg-neutral-100 border-neutral-200 text-neutral-400 font-mono font-bold select-all' 
                                    : 'bg-white border-neutral-200 text-black font-medium'
                                }`}
                              />
                              {isSlotSubmitted && (
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-2xs transition"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span>{t.submitAllDeliverablesBtn} ({activeSlotsCount} {t.slotsColumn.toLowerCase()})</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* ACTIVE SUBMISSIONS LOG TABLE - ONLY FOR MANAGERS */}
          {userRole === 'super_admin' && (
            <div className="space-y-3 text-left">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                {t.viewSubmissionTitle} ({visibleSubmissions.length})
              </h3>

              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                        <th className="py-2.5 px-5">{t.bloggerColumn}</th>
                        <th className="py-2.5 px-4">{t.startDateColumn}</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-5">Assets</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                      {visibleSubmissions.map((sub) => {
                        const matchingInt = integrations.find(i => i.id === sub.integrationId);

                        return (
                          <tr key={sub.id}>
                            <td className="py-3 px-5 font-bold text-black">
                              {matchingInt?.bloggerName || 'Simulated Influencer'}
                              <span className="text-[9px] text-neutral-400 font-normal block mt-0.5">
                                Platform: {matchingInt?.platform || 'Unknown'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-neutral-500 text-[11px]">
                              {new Date(sub.submittedAt).toLocaleDateString()} {new Date(sub.submittedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded font-bold text-[9px] border uppercase ${
                                sub.status === 'approved'
                                  ? 'bg-black text-white border-black'
                                  : 'bg-white text-neutral-600 border-neutral-200'
                              }`}>
                                {sub.status === 'approved' ? t.statusApproved : t.statusPending}
                              </span>
                            </td>
                            <td className="py-3 px-5 space-y-1">
                              {Object.entries(sub.data).map(([key, val]) => (
                                <div key={key} className="flex items-center gap-1.5 font-medium">
                                  <span className="font-mono text-neutral-400 uppercase text-[8px] bg-neutral-50 border border-neutral-200 px-1 py-0.2 rounded">{key}:</span>
                                  {typeof val === 'string' && val.startsWith('data:image/') ? (
                                    <div className="flex items-center gap-2">
                                      <img 
                                        src={val} 
                                        alt="Screenshot" 
                                        onClick={() => {
                                          const w = window.open();
                                          if (w) w.document.write(`<img src="${val}" style="max-width:100%; height:auto;" />`);
                                        }}
                                        className="w-8 h-8 object-cover rounded border border-neutral-250 cursor-pointer hover:border-black transition" 
                                      />
                                      <span className="text-[10px] text-neutral-500 font-bold">
                                        {lang === 'ru' ? 'Скриншот' : lang === 'uz' ? 'Skrinshot' : 'Screenshot'}
                                      </span>
                                    </div>
                                  ) : typeof val === 'string' && val.startsWith('http') ? (
                                    <a
                                      href={val}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[11px] text-black hover:underline font-bold flex items-center gap-0.5 truncate max-w-[200px]"
                                    >
                                      <span className="truncate">{val}</span>
                                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                    </a>
                                  ) : (
                                    <div className="text-[11px] text-neutral-700 flex items-center gap-1 truncate max-w-[200px]">
                                      <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                      <span className="truncate">{val || ''}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </td>
                          </tr>
                        );
                      })}

                      {visibleSubmissions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 px-5 text-center text-neutral-400">
                            <AlertCircle className="w-5 h-5 text-neutral-300 mx-auto mb-1" />
                            <p className="font-bold text-xs text-neutral-500">No Submissions Recorded</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">Submit integration coordinates above to log them.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
