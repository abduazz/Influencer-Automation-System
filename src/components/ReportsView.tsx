/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, Report, SlotConfig } from '../data/mockData';
import { 
  Send, 
  CheckCircle2, 
  Calendar,
  ChevronLeft,
  MoreVertical,
  Clock,
  MessageSquare
} from 'lucide-react';
import { Language, translations } from '../translations';

interface ReportsViewProps {
  projects: Project[];
  reports: Report[];
  onAddReport: (report: Omit<Report, 'id' | 'totalAmount' | 'paidAmount' | 'projectName'>) => void;
  lang: Language;
}

export default function ReportsView({ projects, reports, onAddReport, lang }: ReportsViewProps) {
  const t = translations[lang];

  // Form State
  const [paymentType, setPaymentType] = useState<'prepaid' | 'full'>('prepaid');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [projectId, setProjectId] = useState<string>(projects[0]?.id || '');
  const [destination, setDestination] = useState<string>('');
  const [channelBlogger, setChannelBlogger] = useState<string>('');
  const [platform, setPlatform] = useState<'Telegram' | 'Instagram' | 'YouTube'>('Telegram');
  const [slotsCount, setSlotsCount] = useState<number>(5);
  const [paidSlotsCount, setPaidSlotsCount] = useState<number>(3);
  const [pricePerSlot, setPricePerSlot] = useState<number>(200);
  const [comments, setComments] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number>(1000);
  const [paidAmount, setPaidAmount] = useState<number>(600);
  const [slotsConfig, setSlotsConfig] = useState<SlotConfig[]>([]);

  // Success state for toast
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sync slotsConfig size with slotsCount
  useEffect(() => {
    setSlotsConfig((prev) => {
      const next = [...prev];
      if (next.length < slotsCount) {
        for (let i = next.length; i < slotsCount; i++) {
          next.push({
            platform: platform,
            format: platform === 'Instagram' ? 'Stories' : platform === 'Telegram' ? 'Post' : 'Release',
          });
        }
      } else if (next.length > slotsCount) {
        next.splice(slotsCount);
      }
      return next;
    });
  }, [slotsCount, platform]);

  // Calculate total and paid amount "on the fly" mimicking ->live() and ->afterStateUpdated()
  useEffect(() => {
    setTotalAmount(slotsCount * pricePerSlot);
  }, [slotsCount, pricePerSlot]);

  useEffect(() => {
    setPaidAmount(paidSlotsCount * pricePerSlot);
  }, [paidSlotsCount, pricePerSlot]);

  // Ensure paid slots match when full payment or don't exceed total slots
  useEffect(() => {
    if (paymentType === 'full') {
      setPaidSlotsCount(slotsCount);
    } else if (paidSlotsCount > slotsCount) {
      setPaidSlotsCount(slotsCount);
    }
  }, [paymentType, slotsCount, paidSlotsCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim() || !channelBlogger.trim() || !projectId) return;

    onAddReport({
      date,
      projectId,
      destination,
      channelBlogger,
      platform,
      slotsCount,
      paidSlotsCount,
      pricePerSlot,
      comments,
      slotsConfig,
    });

    // Flash Toast
    setSuccessToast(`${t.reportCreatedMsg} ${channelBlogger}!`);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);

    // Reset inputs but preserve some logical constants
    setDestination('');
    setChannelBlogger('');
    setSlotsCount(5);
    setPaidSlotsCount(3);
    setPricePerSlot(200);
    setComments('');
    setPaymentType('prepaid');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-neutral-900">
      {/* View Header */}
      <div className="border-b border-neutral-200 pb-5 text-left">
        <h2 className="text-xl font-black text-black tracking-tight">{t.miniAppReportsTitle}</h2>
        <p className="text-xs text-neutral-500">
          {t.miniAppReportsDesc}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Physical phone simulator containing the Mini App */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative mx-auto max-w-[340px] w-full bg-white p-3 rounded-[36px] shadow-sm border border-neutral-200">
            {/* Camera notch */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-28 h-3.5 bg-neutral-100 rounded-full z-20 flex justify-center items-center border border-neutral-200">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 mr-1.5"></span>
              <span className="w-1 h-1 rounded-full bg-neutral-200"></span>
            </div>

            {/* Inner Phone Screen */}
            <div className="bg-neutral-50 rounded-[28px] overflow-hidden border border-neutral-200 text-left min-h-[580px] flex flex-col justify-between">
              {/* Phone Status Bar */}
              <div className="bg-neutral-50 text-neutral-400 text-[9px] px-5 pt-3 pb-1.5 flex justify-between items-center font-bold font-mono">
                <span>03:18 AM</span>
                <div className="flex items-center gap-1">
                  <span>LTE</span>
                  <span className="w-3.5 h-2 bg-neutral-300 rounded-xs"></span>
                </div>
              </div>

              {/* Telegram App Bar Header */}
              <div className="bg-white px-4 py-2.5 text-black flex justify-between items-center border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4 text-black cursor-pointer" />
                  <div>
                    <h4 className="font-bold text-[11px] tracking-tight text-black">FluenceFlow Bot</h4>
                    <p className="text-[8px] text-neutral-400">Telegram Mini App</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] border border-neutral-200 text-neutral-600 font-bold px-1.5 py-0.2 rounded-md">
                    close
                  </span>
                  <MoreVertical className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </div>

              {/* Mini App Canvas Scroll */}
              <div className="p-3.5 flex-1 overflow-y-auto max-h-[440px] space-y-3">
                <div className="bg-white border border-neutral-200 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 mb-2.5 border-b border-neutral-100 pb-2">
                    <span className="text-[9px] uppercase font-bold text-black tracking-wider">
                      {t.reportForm}
                    </span>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Payment Type Selection */}
                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                        {t.paymentTypeLabel} *
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 mb-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentType('prepaid');
                            setPaidSlotsCount(Math.max(1, Math.floor(slotsCount / 2)));
                          }}
                          className={`py-1.5 rounded-lg border text-[10px] font-bold transition duration-100 ${
                            paymentType === 'prepaid'
                              ? 'bg-black border-black text-white'
                              : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                          }`}
                        >
                          {t.paymentPrepaid}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentType('full');
                            setPaidSlotsCount(slotsCount);
                          }}
                          className={`py-1.5 rounded-lg border text-[10px] font-bold transition duration-100 ${
                            paymentType === 'full'
                              ? 'bg-black border-black text-white'
                              : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                          }`}
                        >
                          {t.paymentFull}
                        </button>
                      </div>
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                        {t.reportDateField} *
                      </label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] focus:outline-none transition font-medium text-black"
                      />
                    </div>

                    {/* Project Select */}
                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                        {t.targetProjectField} *
                      </label>
                      <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] focus:outline-none transition font-medium text-black"
                      >
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Destination */}
                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                        {t.referralLinkField} *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Stories Conversion Boost"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] focus:outline-none transition font-medium text-black"
                      />
                    </div>

                    {/* Blogger */}
                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                        {t.bloggerColumn} *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. @tech_geek_tg"
                        value={channelBlogger}
                        onChange={(e) => setChannelBlogger(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] focus:outline-none transition font-medium text-black"
                      />
                    </div>

                    {/* Platform Selector */}
                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                        {t.platformColumn} *
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['Telegram', 'Instagram', 'YouTube'] as const).map((plat) => (
                          <button
                            key={plat}
                            type="button"
                            onClick={() => setPlatform(plat)}
                            className={`py-1 rounded border text-[9px] font-bold transition duration-100 ${
                              platform === plat
                                ? 'bg-black border-black text-white'
                                : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                            }`}
                          >
                            {plat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reactive Grid: Price & Slots */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                            {t.slotsCountField} *
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={slotsCount}
                            onChange={(e) => setSlotsCount(Math.max(1, Number(e.target.value)))}
                            className="w-full px-2.5 py-1 bg-white border border-neutral-200 rounded-md text-[11px] font-bold text-black focus:outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                            {t.paidSuffix} *
                          </label>
                          <input
                            type="number"
                            required
                            min={0}
                            max={slotsCount}
                            disabled={paymentType === 'full'}
                            value={paidSlotsCount}
                            onChange={(e) => setPaidSlotsCount(Math.min(slotsCount, Math.max(0, Number(e.target.value))))}
                            className={`w-full px-2.5 py-1 border rounded-md text-[11px] font-bold focus:outline-none ${
                              paymentType === 'full'
                                ? 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed'
                                : 'bg-white border-neutral-200 text-black focus:border-black'
                            }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                          {t.pricePerSlotField} *
                        </label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={pricePerSlot}
                          onChange={(e) => setPricePerSlot(Number(e.target.value))}
                          className="w-full px-2.5 py-1 bg-white border border-neutral-200 rounded-md text-[11px] font-bold text-black focus:outline-none focus:border-black"
                        />
                      </div>
                    </div>

                    {/* Dynamic Slots Multi-Platform/Format Configurer */}
                    <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-left space-y-2">
                      <label className="block text-[9px] font-black text-neutral-500 uppercase tracking-wide border-b border-neutral-200 pb-1">
                        {t.configureSlotsTitle}
                      </label>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {slotsConfig.map((slot, index) => (
                          <div key={index} className="flex items-center gap-1.5 p-1 bg-white border border-neutral-150 rounded text-[10px]">
                            <span className="font-extrabold text-neutral-500 min-w-[20px] text-center">
                              #{index + 1}
                            </span>
                            
                            {/* Platform selector */}
                            <select
                              value={slot.platform}
                              onChange={(e) => {
                                const platVal = e.target.value as 'Telegram' | 'Instagram' | 'YouTube';
                                const nextConfig = [...slotsConfig];
                                nextConfig[index] = {
                                  platform: platVal,
                                  format: platVal === 'Instagram' ? 'Stories' : platVal === 'Telegram' ? 'Post' : 'Release'
                                };
                                setSlotsConfig(nextConfig);
                              }}
                              className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-0.5 text-[9px] font-bold text-black focus:outline-none"
                            >
                              <option value="Telegram">Telegram</option>
                              <option value="Instagram">Instagram</option>
                              <option value="YouTube">YouTube</option>
                            </select>

                            {/* Format Selector based on Platform */}
                            <select
                              value={slot.format}
                              onChange={(e) => {
                                const nextConfig = [...slotsConfig];
                                nextConfig[index] = {
                                  ...nextConfig[index],
                                  format: e.target.value
                                };
                                setSlotsConfig(nextConfig);
                              }}
                              className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-0.5 text-[9px] font-bold text-black focus:outline-none flex-1"
                            >
                              {slot.platform === 'Instagram' && (
                                <>
                                  <option value="Reels">Instagram Reels</option>
                                  <option value="Stories">Instagram Stories</option>
                                  <option value="Post">Instagram Post</option>
                                </>
                              )}
                              {slot.platform === 'Telegram' && (
                                <>
                                  <option value="Post">Telegram Post</option>
                                  <option value="Stories">Telegram Stories</option>
                                </>
                              )}
                              {slot.platform === 'YouTube' && (
                                <>
                                  <option value="Release">YouTube Release</option>
                                  <option value="Shorts">YouTube Shorts</option>
                                  <option value="Integration">YouTube Integration</option>
                                </>
                              )}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Calculated Sums Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-100">
                      <div>
                        <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wide mb-0.5">
                          {t.prepaidField}
                        </label>
                        <input
                          type="text"
                          disabled
                          value={paidAmount.toLocaleString()}
                          className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md text-[11px] font-bold text-black text-center select-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wide mb-0.5">
                          {t.totalSumField}
                        </label>
                        <input
                          type="text"
                          disabled
                          value={totalAmount.toLocaleString()}
                          className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md text-[11px] font-bold text-black text-center select-none"
                        />
                      </div>
                    </div>

                    {/* Comments */}
                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                        {t.campaignDescField}
                      </label>
                      <textarea
                        placeholder="Additional notes..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        rows={2}
                        className="w-full px-2.5 py-1 bg-white border border-neutral-200 focus:bg-white rounded-md text-[11px] focus:outline-none focus:border-black text-black"
                      />
                    </div>

                    {/* Submit inside TG Mini App */}
                    <button
                      type="submit"
                      className="w-full mt-2 py-2 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-2xs transition"
                    >
                      <Send className="w-3 h-3 text-white" />
                      <span>{t.addIntegrationBtn}</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Bot menu bar bottom */}
              <div className="bg-white border-t border-neutral-100 p-2.5 flex justify-around items-center text-[9px] text-neutral-400 font-bold">
                <span className="text-black">{t.reportForm}</span>
                <span className="w-1 h-1 rounded-full bg-neutral-300"></span>
                <span>{t.integrationsTitle}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Saved Reports List Feed */}
        <div className="lg:col-span-7 space-y-4 text-left">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            {t.savedReportsTitle} ({reports.length})
          </h3>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {reports.map((rep) => {
              const resolvedProject = projects.find(p => p.id === rep.projectId);

              return (
                <div
                  key={rep.id}
                  className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs hover:border-black transition duration-150"
                >
                  <div className="flex justify-between items-start gap-3 mb-2 pb-2 border-b border-neutral-100">
                    <div>
                      <h4 className="font-bold text-xs text-black">{rep.channelBlogger}</h4>
                      <p className="text-[10px] text-neutral-400 font-medium mt-0.5">
                        {t.campaignTitleField}: <span className="text-neutral-700 font-bold">{resolvedProject?.name || 'Unknown Project'}</span>
                      </p>
                    </div>
                    <span className="text-[10px] bg-neutral-50 font-bold px-2 py-0.5 rounded border border-neutral-200 text-neutral-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-neutral-400" /> {rep.date}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1 text-[11px]">
                    <div>
                      <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">{t.platformColumn}</span>
                      <span className="font-bold text-neutral-800">{rep.platform}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">{t.slotsColumn} x {t.priceColumn}</span>
                      <span className="font-bold text-neutral-800">{rep.slotsCount} x {rep.pricePerSlot}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">{t.totalSumColumn}</span>
                      <span className="font-bold text-black">{rep.totalAmount}</span>
                    </div>
                  </div>

                  {rep.comments && (
                    <div className="text-[11px] text-neutral-600 bg-neutral-50 p-2.5 rounded-lg flex items-start gap-2 border border-neutral-150 mt-2">
                      <MessageSquare className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
                      <p className="italic">"{rep.comments}"</p>
                    </div>
                  )}
                </div>
              );
            })}

            {reports.length === 0 && (
              <div className="p-8 text-center bg-white border border-dashed border-neutral-200 rounded-xl">
                <Clock className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-neutral-600">{t.noReportsTitle}</p>
                <p className="text-[11px] text-neutral-400 mt-1">{t.noReportsDesc}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 bg-white border border-neutral-300 text-black p-4 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="w-7 h-7 rounded-full bg-neutral-100 text-black flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-black" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-black">{t.dbSyncedToast}</p>
            <p className="text-[10px] text-neutral-500">{successToast}</p>
          </div>
        </div>
      )}
    </div>
  );
}
