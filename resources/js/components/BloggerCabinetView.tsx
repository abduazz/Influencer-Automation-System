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

interface BloggerCabinetViewProps {
  integrations: Integration[];
  submissions: BloggerSubmission[];
  onAddSubmission: (submission: Omit<BloggerSubmission, 'id' | 'submittedAt'>) => void;
  urlParams?: { platform?: string; slotsCount?: string; integrationId?: string };
  lang: Language;
}

export default function BloggerCabinetView({
  integrations,
  submissions,
  onAddSubmission,
  urlParams,
  lang
}: BloggerCabinetViewProps) {
  const t = translations[lang];

  // Controller State (allows interactive configuration in the preview)
  const [activePlatform, setActivePlatform] = useState<'Telegram' | 'Instagram' | 'YouTube'>('Instagram');
  const [activeSlotsCount, setActiveSlotsCount] = useState<number>(4);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('int-2');

  const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId);

  // Load state from URL parameters if present
  useEffect(() => {
    if (urlParams?.integrationId) {
      const matched = integrations.find(i => i.id === urlParams.integrationId);
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

  // Form Field States
  // Dynamic state object mapping slot keys (e.g. "slot_1") to text link or mock file name
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});

  const [formSubmitted, setFormSubmitted] = useState(false);

  // Re-initialize form data state when platform or slots count changes
  useEffect(() => {
    const initialData: Record<string, string> = {};
    const initialPreviews: Record<string, string> = {};
    for (let i = 1; i <= activeSlotsCount; i++) {
      initialData[`slot_${i}`] = '';
    }
    setFormData(initialData);
    setFilePreviews(initialPreviews);
    setFormSubmitted(false);
  }, [activePlatform, activeSlotsCount]);

  // Handle file picker simulation
  const handleFileChangeSim = (slotKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create a local URL for visual feedback
      const previewUrl = URL.createObjectURL(file);
      setFilePreviews(prev => ({
        ...prev,
        [slotKey]: previewUrl
      }));
      setFormData(prev => ({
        ...prev,
        [slotKey]: file.name
      }));
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

    // Check if only paid/prepaid slots are filled
    const maxPaid = selectedIntegration?.paidSlotsCount ?? activeSlotsCount;
    const unfilledPaid = Array.from({ length: maxPaid }).some((_, idx) => {
      const key = `slot_${idx + 1}`;
      return !formData[key];
    });

    if (unfilledPaid) {
      alert(t.unfilledSlotsError);
      return;
    }

    // Filter submitted data to only contain paid slots
    const submittedPayload: Record<string, string> = {};
    for (let i = 1; i <= maxPaid; i++) {
      const key = `slot_${i}`;
      submittedPayload[key] = formData[key] || '';
    }

    onAddSubmission({
      integrationId: selectedIntegrationId,
      status: 'pending',
      data: submittedPayload
    });

    setFormSubmitted(true);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-neutral-900">
      {/* View Header */}
      <div className="border-b border-neutral-200 pb-5 text-left">
        <h2 className="text-xl font-black text-black tracking-tight">{t.bloggerCabinetTitle}</h2>
        <p className="text-xs text-neutral-500">
          {t.bloggerCabinetDesc}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: URL Parameters / Form Controller (Manager Tool) */}
        <div className="lg:col-span-4 space-y-4 text-left">
          <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-2.5">
              <Settings className="w-4 h-4 text-black" />
              <h3 className="font-bold text-xs text-black uppercase tracking-wider">
                {t.interactiveControls}
              </h3>
            </div>
            
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              {t.interactiveControlsDesc}
            </p>

            {/* Platform Select */}
            <div>
              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                {t.platformColumn}
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['Telegram', 'Instagram', 'YouTube'] as const).map((plat) => (
                  <button
                    key={plat}
                    onClick={() => {
                      setActivePlatform(plat);
                      // Auto pick an integration of this platform type
                      const match = integrations.find(i => i.platform === plat);
                      if (match) setSelectedIntegrationId(match.id);
                    }}
                    className={`py-1 rounded text-[10px] font-bold border transition ${
                      activePlatform === plat
                        ? 'bg-black border-black text-white'
                        : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>

            {/* Slots count slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                  {t.slotsColumn}
                </label>
                <span className="text-xs font-black text-black">{activeSlotsCount} {t.slotsColumn.toLowerCase()}</span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                value={activeSlotsCount}
                onChange={(e) => setActiveSlotsCount(Number(e.target.value))}
                className="w-full accent-black cursor-pointer"
              />
            </div>

            {/* Integration link dropdown */}
            <div>
              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                {t.selectedProjectLabel}
              </label>
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
                className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-md text-[11px] font-medium text-black focus:border-black outline-none"
              >
                {integrations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.bloggerName} ({i.platform}, {i.slotsCount} {t.slotsColumn.toLowerCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Copy simulation link */}
            <button
              onClick={() => {
                const url = `${window.location.origin}/?cabinet=true&platform=${activePlatform}&slots_count=${activeSlotsCount}&integrationId=${selectedIntegrationId}`;
                navigator.clipboard.writeText(url);
                alert(`${t.copiedAlert}\n${url}`);
              }}
              className="w-full py-2 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-md transition flex items-center justify-center gap-1.5"
            >
              <Link className="w-3.5 h-3.5 text-white" />
              <span>{t.copyTooltip}</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: The Interactive Guest Web Page Frame */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
            {/* Browser Address Bar Header */}
            <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200 flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neutral-200"></span>
                <span className="w-2 h-2 rounded-full bg-neutral-200"></span>
                <span className="w-2 h-2 rounded-full bg-neutral-200"></span>
              </div>
              <div className="flex-1 max-w-xl mx-auto bg-white border border-neutral-200 rounded px-2.5 py-0.5 text-center text-[10px] text-neutral-400 truncate font-mono">
                <span>fluenceflow.net/submit-job?platform=</span>
                <span className="font-bold text-black">{activePlatform}</span>
                <span>&slots_count=</span>
                <span className="font-bold text-black">{activeSlotsCount}</span>
                {selectedIntegration && (
                  <>
                    <span>&blogger=</span>
                    <span className="font-bold text-black">{selectedIntegration.bloggerName.toLowerCase().replace(/\s+/g, '')}</span>
                  </>
                )}
              </div>
            </div>

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
                        <span className="font-bold text-black truncate max-w-[180px]">{val}</span>
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
              ) : (
                /* Interactive Submission Form */
                <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto w-full">
                  <div className="text-center">
                    <h2 className="text-base font-black text-black tracking-tight">{t.bloggerCabinetTitle}</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {t.platformColumn}: <span className="font-bold text-black uppercase">{activePlatform}</span> | 
                      {t.slotsColumn}: <span className="font-bold text-black">{activeSlotsCount}</span>
                    </p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-neutral-200">
                    {/* Generates EXACTLY activeSlotsCount fields according to configuration */}
                    {Array.from({ length: activeSlotsCount }).map((_, index) => {
                      const slotNum = index + 1;
                      const slotKey = `slot_${slotNum}`;

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

                          {slotPlatform === 'Instagram' ? (
                            /* SCREENSHOT FILE UPLOAD COMPONENT FOR INSTAGRAM STORIES/REELS */
                            <div className="space-y-2">
                              {filePreviews[slotKey] ? (
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
                                      required={isPaid}
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
                                    required={isPaid}
                                    onChange={(e) => handleFileChangeSim(slotKey, e)}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            /* URL TEXT INPUT FIELD FOR TELEGRAM AND YOUTUBE POSTS/RELEASES */
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Link className="w-3.5 h-3.5 text-neutral-400" />
                              </div>
                              <input
                                type="url"
                                required={isPaid}
                                placeholder={
                                  slotPlatform === 'Telegram' 
                                    ? `e.g. https://t.me/channel_name/123 (${slotFormat})` 
                                    : `e.g. https://youtube.com/watch?v=abc123xyz (${slotFormat})`
                                }
                                value={formData[slotKey] || ''}
                                onChange={(e) => handleLinkChange(slotKey, e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-xs focus:outline-none text-black font-medium"
                              />
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

          {/* ACTIVE SUBMISSIONS LOG TABLE */}
          <div className="space-y-3 text-left">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              {t.viewSubmissionTitle} ({submissions.length})
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
                    {submissions.map((sub) => {
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
                                {val.startsWith('http') ? (
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
                                    <span className="truncate">{val}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </td>
                        </tr>
                      );
                    })}

                    {submissions.length === 0 && (
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
        </div>
      </div>
    </div>
  );
}
