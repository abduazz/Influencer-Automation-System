/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, Report, SlotConfig, Integration } from '../data/mockData';
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

interface StepperInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

function StepperInput({ value, onChange, min = 0, max, disabled }: StepperInputProps) {
  return (
    <div className={`flex items-center border border-neutral-200 rounded-md bg-white overflow-hidden h-7 ${disabled ? 'opacity-40' : ''}`}>
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        className="w-7 h-full bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 flex items-center justify-center font-bold text-xs text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed select-none border-r border-neutral-200"
      >
        −
      </button>
      <input
        type="number"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          let val = Number(e.target.value);
          if (isNaN(val)) return;
          if (max !== undefined) val = Math.min(max, val);
          onChange(Math.max(min, val));
        }}
        className="w-full h-full text-center text-[10px] font-bold text-black focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(value + 1)}
        className="w-7 h-full bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 flex items-center justify-center font-bold text-xs text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed select-none border-l border-neutral-200"
      >
        +
      </button>
    </div>
  );
}

interface ReportsViewProps {
  projects: Project[];
  integrations: Integration[];
  reports: Report[];
  onAddReport: (report: Omit<Report, 'id' | 'totalAmount' | 'paidAmount' | 'projectName'>) => Promise<Report | undefined>;
  lang: Language;
  userRole?: 'super_admin' | 'pr_manager' | 'product_manager';
  isWebApp?: boolean;
}

export default function ReportsView({ projects, integrations, reports, onAddReport, lang, userRole, isWebApp }: ReportsViewProps) {
  const t = translations[lang];

  // Form State
  const [paymentType, setPaymentType] = useState<'prepaid' | 'full' | 'other'>('prepaid');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [projectId, setProjectId] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [channelBlogger, setChannelBlogger] = useState<string>('');
  const [bloggerType, setBloggerType] = useState<'existing' | 'new'>('existing');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [platform, setPlatform] = useState<'Telegram' | 'Instagram' | 'YouTube' | 'MAX'>('Telegram');


  const [slotsCount, setSlotsCount] = useState<number>(5);
  const [paidSlotsCount, setPaidSlotsCount] = useState<number>(3);
  const [pricePerSlot, setPricePerSlot] = useState<number | ''>(0);
  const [otherAmount, setOtherAmount] = useState<number | ''>(0);
  const [comments, setComments] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number>(1000);
  const [paidAmount, setPaidAmount] = useState<number>(600);
  const [slotsConfig, setSlotsConfig] = useState<SlotConfig[]>([]);

  const [customizeSlots, setCustomizeSlots] = useState<boolean>(false);
  const [slotGroups, setSlotGroups] = useState<{ quantity: number; platform: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX'; format: string }[]>([]);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState<number>(0);

  const existingBloggers = Array.from(new Set(integrations.map(i => i.bloggerName).filter(Boolean)));
  const suggestions = channelBlogger.trim() !== ''
    ? existingBloggers.filter(name => name.toLowerCase().includes(channelBlogger.toLowerCase()))
    : existingBloggers;

  const getDefaultFormat = (plat: 'Telegram' | 'Instagram' | 'YouTube' | 'MAX') => {
    if (plat === 'Instagram') return 'Stories';
    if (plat === 'Telegram') return 'Post';
    if (plat === 'YouTube') return 'Release';
    return 'Post';
  };

  // Reset slots configuration customization if slotsCount changes
  useEffect(() => {
    setCustomizeSlots(false);
    setSlotGroups([]);
  }, [slotsCount]);

  // Success state for toast
  const [successToast, setSuccessToast] = useState<{ message: string; link?: string | null } | null>(null);
  const [createdReportResult, setCreatedReportResult] = useState<Report | null>(null);

  // Sync slotsConfig size and platform/format with slotsCount and platform
  useEffect(() => {
    if (!customizeSlots) {
      const next: SlotConfig[] = [];
      for (let i = 0; i < slotsCount; i++) {
        next.push({
          platform: platform,
          format: platform === 'Instagram' ? 'Stories' : platform === 'Telegram' ? 'Post' : 'Release',
        });
      }
      setSlotsConfig(next);
    } else {
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
    }
  }, [slotsCount, platform, customizeSlots]);

  // Calculate total and paid amount "on the fly" mimicking ->live() and ->afterStateUpdated()
  useEffect(() => {
    const price = pricePerSlot === '' ? 0 : pricePerSlot;
    setTotalAmount(slotsCount * price);
  }, [slotsCount, pricePerSlot]);

  useEffect(() => {
    const price = pricePerSlot === '' ? 0 : pricePerSlot;
    setPaidAmount(paidSlotsCount * price);
  }, [paidSlotsCount, pricePerSlot]);

  // Ensure paid slots match when full payment or don't exceed total slots
  useEffect(() => {
    if (paymentType === 'full') {
      setPaidSlotsCount(slotsCount);
    } else if (paidSlotsCount > slotsCount) {
      setPaidSlotsCount(slotsCount);
    }
  }, [paymentType, slotsCount, paidSlotsCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;
    if (paymentType !== 'other' && (!projectId || !channelBlogger.trim())) return;

    if (paymentType !== 'other' && customizeSlots) {
      const currentSum = slotGroups.reduce((acc, g) => acc + g.quantity, 0);
      if (currentSum !== slotsCount) {
        alert(lang === 'ru' 
          ? `Пожалуйста, настройте все слоты. Настроено ${currentSum} из ${slotsCount}.` 
          : lang === 'uz' 
          ? `Iltimos, barcha slotlarni sozlang. Sozlangan: ${currentSum} ta (${slotsCount} tadan).` 
          : `Please configure all slots. Configured ${currentSum} out of ${slotsCount}.`
        );
        return;
      }
    }

    const payload: any = {
      date,
      destination,
      comments,
      paymentType,
      receipt,
      lang,
    };

    if (paymentType === 'other') {
      payload.projectId = projectId || null;
      payload.amount = otherAmount === '' ? 0 : otherAmount;
      payload.channelBlogger = null;
      payload.platform = null;
      payload.slotsCount = null;
      payload.paidSlotsCount = null;
      payload.pricePerSlot = null;
      payload.slotsConfig = [];
    } else {
      payload.projectId = projectId || null;
      payload.channelBlogger = channelBlogger;
      payload.platform = platform;
      payload.slotsCount = slotsCount;
      payload.paidSlotsCount = paidSlotsCount;
      payload.pricePerSlot = pricePerSlot === '' ? 0 : pricePerSlot;
      
      let finalSlotsConfig = slotsConfig;
      if (customizeSlots) {
        finalSlotsConfig = [];
        slotGroups.forEach(g => {
          for (let i = 0; i < g.quantity; i++) {
            finalSlotsConfig.push({ platform: g.platform, format: g.format });
          }
        });
      }
      payload.slotsConfig = finalSlotsConfig;
    }

    try {
      const createdReport = await onAddReport(payload);

      if (createdReport) {
        setCreatedReportResult(createdReport);
      }

      // Flash Toast
      const toastSubject = paymentType === 'other' ? destination : channelBlogger;
      let cabinetLink: string | null = null;
      if (createdReport?.bloggerCabinetToken) {
        cabinetLink = `${window.location.origin}/?cabinet=true&id=${createdReport.bloggerCabinetToken}`;
      }

      setSuccessToast({
        message: `${t.reportCreatedMsg} ${toastSubject}!`,
        link: cabinetLink
      });
      setTimeout(() => {
        setSuccessToast(null);
      }, 10000);

      // Reset inputs but preserve some logical constants
      setDestination('');
      setChannelBlogger('');
      setSlotsCount(5);
      setPaidSlotsCount(3);
      setPricePerSlot(0);
      setOtherAmount(0);
      setComments('');
      setReceipt(null);
      setFileInputKey(prev => prev + 1);
      setPaymentType('prepaid');
    } catch (err: any) {
      console.error(err);
      alert(lang === 'ru' 
        ? `Ошибка при сохранении отчета: ${err.message || err}` 
        : lang === 'uz' 
        ? `Hisobotni saqlashda xatolik: ${err.message || err}` 
        : `Error saving report: ${err.message || err}`
      );
    }
  };

  return (
    <div className={`space-y-8 max-w-7xl mx-auto text-neutral-900 ${isWebApp ? 'p-0' : ''}`}>
      {/* View Header */}
      {!isWebApp && (
        <div className="hidden md:block border-b border-neutral-200 pb-5 text-left">
          <h2 className="text-xl font-black text-black tracking-tight">{t.miniAppReportsTitle}</h2>
          <p className="text-xs text-neutral-500">
            {t.miniAppReportsDesc}
          </p>
        </div>
      )}

      <div className="w-full md:max-w-[380px] mx-auto p-0 md:p-4 flex justify-center">
        {/* LEFT COLUMN: Physical phone simulator containing the Mini App */}
        <div className="w-full">
          <div className={isWebApp ? 'w-full' : 'w-full md:relative md:mx-auto md:max-w-[340px] bg-neutral-50 md:bg-white p-0 md:p-3 md:rounded-[36px] md:shadow-xs md:border md:border-neutral-200'}>
            {/* Camera notch */}
            {!isWebApp && (
              <div className="hidden md:flex absolute top-4 left-1/2 transform -translate-x-1/2 w-28 h-3.5 bg-neutral-100 rounded-full z-20 justify-center items-center border border-neutral-200">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 mr-1.5"></span>
                <span className="w-1 h-1 rounded-full bg-neutral-200"></span>
              </div>
            )}

            {/* Inner Phone Screen */}
            <div className={isWebApp ? 'w-full bg-white border border-neutral-250 rounded-xl p-4 shadow-sm' : 'w-full bg-white border border-neutral-200 rounded-xl p-4 shadow-xs md:bg-neutral-50 md:rounded-[28px] md:overflow-hidden md:border-neutral-200 text-left md:min-h-[580px] flex flex-col justify-between'}>
              {/* Phone Status Bar */}
              {!isWebApp && (
                <div className="hidden md:flex bg-neutral-50 text-neutral-400 text-[9px] px-5 pt-3 pb-1.5 justify-between items-center font-bold font-mono">
                  <span>03:18 AM</span>
                  <div className="flex items-center gap-1">
                    <span>LTE</span>
                    <span className="w-3.5 h-2 bg-neutral-300 rounded-xs"></span>
                  </div>
                </div>
              )}

              {/* Telegram App Bar Header */}
              {!isWebApp && (
                <div className="hidden md:flex bg-white px-4 py-2.5 text-black justify-between items-center border-b border-neutral-100">
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
              )}

              {/* Mini App Canvas Scroll */}
              <div className={isWebApp ? 'space-y-3' : 'p-0 md:p-3.5 flex-1 overflow-y-auto md:max-h-[440px] space-y-3'}>
                {createdReportResult ? (
                  <div className={isWebApp ? 'bg-white border border-neutral-250 rounded-xl p-6 shadow-sm text-center space-y-4' : 'bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs text-center space-y-4'}>
                    <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center mx-auto shadow-sm">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-black uppercase tracking-wider">
                        {lang === 'ru' ? 'Отчет отправлен!' : lang === 'uz' ? 'Hisobot yuborildi!' : 'Report Sent!'}
                      </h3>
                      <p className="text-[10px] text-neutral-500 mt-1">
                        {createdReportResult.paymentType === 'other'
                          ? (lang === 'ru' ? 'Прочие расходы сохранены в базе данных.' : lang === 'uz' ? 'Boshqa xarajatlar ma\'lumotlar bazasida saqlandi.' : 'Other expenses saved in database.')
                          : (lang === 'ru' ? `Отчет по покупке слотов у ${createdReportResult.channelBlogger} успешно обработан.` : lang === 'uz' ? `Blogger ${createdReportResult.channelBlogger} uchun slot xaridi hisoboti muvaffaqiyatli saqlandi.` : `Report for slots purchase from ${createdReportResult.channelBlogger} processed successfully.`)}
                      </p>
                    </div>

                    {/* Copyable Cabinet URL for blogger campaigns */}
                    {createdReportResult.bloggerCabinetToken && (
                      <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-left space-y-1.5">
                        <label className="block text-[8px] font-black text-neutral-400 uppercase tracking-wider">
                          {lang === 'ru' ? 'Ссылка на кабинет блогера:' : lang === 'uz' ? 'Blogger kabineti havolasi:' : 'Blogger Cabinet URL:'}
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/?cabinet=true&id=${createdReportResult.bloggerCabinetToken}`}
                            onClick={(e) => {
                              const target = e.target as HTMLInputElement;
                              target.select();
                              navigator.clipboard.writeText(target.value);
                            }}
                            className="flex-1 bg-white border border-neutral-200 rounded px-2 py-0.5 text-[9px] text-neutral-600 font-mono font-bold focus:outline-none select-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const url = `${window.location.origin}/?cabinet=true&id=${createdReportResult.bloggerCabinetToken}`;
                              navigator.clipboard.writeText(url);
                              alert(lang === 'ru' ? 'Ссылка скопирована!' : lang === 'uz' ? 'Havola nusxalandi!' : 'Link copied!');
                            }}
                            className="px-2.5 py-0.5 bg-black hover:bg-neutral-900 text-white rounded text-[9px] font-bold shrink-0 transition"
                          >
                            {lang === 'ru' ? 'Копия' : lang === 'uz' ? 'Nusxa' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-[8px] text-neutral-400">
                          {lang === 'ru' ? 'Перешлите эту ссылку блогеру для загрузки скриншотов / ссылок.' : 
                           lang === 'uz' ? 'Bloggerga skrinshotlar / havolalarni yuklashi uchun ushbu havolani yuboring.' : 
                           'Send this link to the blogger to upload screenshots / links.'}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setCreatedReportResult(null)}
                      className="w-full py-2 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-lg transition duration-150 shadow-xs"
                    >
                      {lang === 'ru' ? 'Создать новый отчет' : lang === 'uz' ? 'Yangi hisobot yaratish' : 'Create New Report'}
                    </button>
                  </div>
                ) : (
                  <div className={isWebApp ? '' : 'w-full md:bg-white md:border md:border-neutral-200 md:rounded-xl md:p-3.5 md:shadow-2xs'}>
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
                      <div className="grid grid-cols-3 gap-1.5 mb-1">
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
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentType('other');
                          }}
                          className={`py-1.5 rounded-lg border text-[10px] font-bold transition duration-100 ${
                            paymentType === 'other'
                              ? 'bg-black border-black text-white'
                              : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                          }`}
                        >
                          {t.paymentOther}
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
                        {t.targetProjectField} {paymentType !== 'other' ? '*' : ''}
                      </label>
                      <select
                        value={projectId}
                        required={paymentType !== 'other'}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] focus:outline-none transition font-medium text-black"
                      >
                        <option value="" disabled={paymentType !== 'other'}>
                          {paymentType === 'other'
                            ? (lang === 'ru' ? '(Необязательно) Выберите проект' : lang === 'uz' ? '(Ixtiyoriy) Loyihani tanlang' : '(Optional) Select Project')
                            : (lang === 'ru' ? 'Выберите проект *' : lang === 'uz' ? 'Loyihani tanlang *' : 'Select Project *')
                          }
                        </option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                     {/* Destination */}
                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                        {paymentType === 'other' ? t.purposeField : t.referralLinkField} *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={paymentType === 'other' ? (lang === 'ru' ? 'например, Расходы на продакшн' : lang === 'uz' ? 'masalan, Ishlab chiqarish xarajatlari' : 'e.g. Production Expense') : 'Ссылка от bulink.io'}
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] focus:outline-none transition font-medium text-black"
                      />
                    </div>

                    {paymentType === 'other' ? (
                      /* Fields for "Other" payment type */
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                          {t.sumField} *
                        </label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={otherAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOtherAmount(val === '' ? '' : Math.max(0, Number(val)));
                          }}
                          className="w-full px-2.5 py-1 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] font-bold text-black focus:outline-none focus:border-black"
                        />
                      </div>
                    ) : (
                      /* Fields for standard blogger campaign payment types */
                      <>
                        {/* Blogger Type Selection */}
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                            {lang === 'ru' ? 'Тип блогера' : lang === 'uz' ? 'Blogger turi' : 'Blogger Type'} *
                          </label>
                          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setBloggerType('existing');
                                setChannelBlogger('');
                              }}
                              className={`py-1 rounded-lg border text-[9px] font-bold transition duration-100 ${
                                bloggerType === 'existing'
                                  ? 'bg-black border-black text-white'
                                  : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                              }`}
                            >
                              {lang === 'ru' ? 'Существующий' : lang === 'uz' ? 'Mavjud' : 'Existing'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBloggerType('new');
                                setChannelBlogger('');
                              }}
                              className={`py-1 rounded-lg border text-[9px] font-bold transition duration-100 ${
                                bloggerType === 'new'
                                  ? 'bg-black border-black text-white'
                                  : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                              }`}
                            >
                              {lang === 'ru' ? 'Новый' : lang === 'uz' ? 'Yangi' : 'New'}
                            </button>
                          </div>
                        </div>

                        {/* Blogger Input with Auto-Suggestions */}
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                            {t.bloggerColumn} *
                          </label>
                          <div className="relative">
                            {bloggerType === 'existing' ? (
                              <select
                                required
                                value={channelBlogger}
                                onChange={(e) => {
                                  const name = e.target.value;
                                  setChannelBlogger(name);
                                  // Auto-detect and pre-fill platform
                                  const matchedInt = integrations.find(i => i.bloggerName === name);
                                  if (matchedInt) {
                                    setPlatform(matchedInt.platform);
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] focus:outline-none transition font-medium text-black cursor-pointer appearance-none"
                              >
                                <option value="" disabled>
                                  {lang === 'ru' ? 'Выберите блогера...' : lang === 'uz' ? 'Bloggeri tanlang...' : 'Select blogger...'}
                                </option>
                                {existingBloggers.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                required
                                placeholder="e.g. @tech_geek_tg"
                                value={channelBlogger}
                                onChange={(e) => setChannelBlogger(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] focus:outline-none transition font-medium text-black"
                              />
                            )}
                          </div>
                        </div>

                        {/* Platform Selector */}
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                            {t.platformColumn} *
                          </label>
                          <select
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value as any)}
                            className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] focus:outline-none transition font-medium text-black"
                          >
                            {(['Telegram', 'Instagram', 'YouTube', 'MAX'] as const).map((plat) => (
                              <option
                                key={plat}
                                value={plat}
                              >
                                {plat}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Reactive Grid: Price & Slots */}
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                                {t.slotsCountField} *
                              </label>
                              <StepperInput
                                value={slotsCount}
                                min={1}
                                onChange={(val) => setSlotsCount(val)}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                                {t.paidSuffix} *
                              </label>
                              <StepperInput
                                value={paidSlotsCount}
                                min={0}
                                max={slotsCount}
                                disabled={paymentType === 'full'}
                                onChange={(val) => setPaidSlotsCount(val)}
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
                              onChange={(e) => {
                                const val = e.target.value;
                                setPricePerSlot(val === '' ? '' : Math.max(0, Number(val)));
                              }}
                              className="w-full px-2.5 py-1 bg-white border border-neutral-200 rounded-md text-[11px] font-bold text-black focus:outline-none focus:border-black"
                            />
                          </div>
                        </div>

                        {/* Checkbox to Toggle Individual Slots Configuration */}
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            id="customize-slots-checkbox"
                            checked={customizeSlots}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCustomizeSlots(checked);
                              if (checked && slotGroups.length === 0) {
                                setSlotGroups([{ quantity: slotsCount, platform: platform, format: getDefaultFormat(platform) }]);
                              }
                            }}
                            className="w-3.5 h-3.5 accent-black rounded border-neutral-300 focus:ring-black cursor-pointer"
                          />
                          <label htmlFor="customize-slots-checkbox" className="text-[10px] font-bold text-neutral-600 select-none cursor-pointer">
                            {t.customizeSlotsLabel}
                          </label>
                        </div>

                        {/* Grouped Slots Configurer */}
                        {customizeSlots && (
                          <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-left space-y-2">
                            <div className="flex justify-between items-center border-b border-neutral-200 pb-1">
                              <label className="block text-[8px] font-black text-neutral-500 uppercase tracking-wider truncate">
                                {t.configureSlotsTitle}
                              </label>
                              <span className="text-[9px] font-bold text-neutral-400 shrink-0 ml-2">
                                {slotGroups.reduce((acc, g) => acc + g.quantity, 0)} / {slotsCount}
                              </span>
                            </div>
                            
                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                              {slotGroups.map((group, index) => (
                                <div key={index} className="flex items-center gap-1.5 p-1 bg-white border border-neutral-150 rounded text-[10px]">
                                  {/* Quantity select instead of typing */}
                                  <select
                                    value={group.quantity}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      const otherSum = slotGroups.reduce((acc, g, idx) => idx === index ? acc : acc + g.quantity, 0);
                                      if (otherSum + val > slotsCount) {
                                        alert(lang === 'ru' 
                                          ? `Количество настроенных слотов не должно превышать общее количество (${slotsCount})!` 
                                          : lang === 'uz' 
                                          ? `Sozlangan slotlar soni umumiy slotlar sonidan (${slotsCount}) oshib ketmasligi kerak!` 
                                          : `Configured slots count cannot exceed total slots count (${slotsCount})!`
                                        );
                                        return;
                                      }
                                      const nextGroups = [...slotGroups];
                                      nextGroups[index].quantity = val;
                                      setSlotGroups(nextGroups);
                                    }}
                                    className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-0.5 text-[9px] font-bold text-black focus:outline-none"
                                  >
                                    {Array.from({ length: slotsCount }, (_, i) => i + 1).map(num => (
                                      <option key={num} value={num}>{num}</option>
                                    ))}
                                  </select>

                                  {/* Platform selector */}
                                  <select
                                    value={group.platform}
                                    onChange={(e) => {
                                      const platVal = e.target.value as 'Telegram' | 'Instagram' | 'YouTube' | 'MAX';
                                      const nextGroups = [...slotGroups];
                                      nextGroups[index] = {
                                        ...nextGroups[index],
                                        platform: platVal,
                                        format: getDefaultFormat(platVal)
                                      };
                                      setSlotGroups(nextGroups);
                                    }}
                                    className="bg-neutral-50 border border-neutral-200 rounded px-1 py-0.5 text-[9px] font-bold text-black focus:outline-none"
                                  >
                                    <option value="Telegram">TG</option>
                                    <option value="Instagram">IG</option>
                                    <option value="YouTube">YT</option>
                                    <option value="MAX">MAX</option>
                                  </select>

                                  {/* Format Selector */}
                                  <select
                                    value={group.format}
                                    onChange={(e) => {
                                      const nextGroups = [...slotGroups];
                                      nextGroups[index].format = e.target.value;
                                      setSlotGroups(nextGroups);
                                    }}
                                    className="bg-neutral-50 border border-neutral-200 rounded px-1 py-0.5 text-[9px] font-bold text-black focus:outline-none flex-1 min-w-[70px] truncate"
                                  >
                                    {group.platform === 'Instagram' && (
                                      <>
                                        <option value="Reels">Reels</option>
                                        <option value="Stories">Stories</option>
                                        <option value="Post">Post</option>
                                      </>
                                    )}
                                    {group.platform === 'Telegram' && (
                                      <>
                                        <option value="Post">Post</option>
                                        <option value="Stories">Stories</option>
                                      </>
                                    )}
                                    {group.platform === 'YouTube' && (
                                      <>
                                        <option value="Release">Release</option>
                                        <option value="Shorts">Shorts</option>
                                        <option value="Integration">Integration</option>
                                      </>
                                    )}
                                    {group.platform === 'MAX' && (
                                      <>
                                        <option value="Post">Post</option>
                                        <option value="Integration">Integration</option>
                                      </>
                                    )}
                                  </select>

                                  {/* Delete group button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSlotGroups(slotGroups.filter((_, idx) => idx !== index));
                                    }}
                                    className="text-red-500 hover:bg-neutral-100 p-1 rounded text-[9px] font-bold shrink-0"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Add group button */}
                            <button
                              type="button"
                              onClick={() => {
                                const currentSum = slotGroups.reduce((acc, g) => acc + g.quantity, 0);
                                if (currentSum + 1 > slotsCount) {
                                  alert(lang === 'ru' 
                                    ? `Количество настроенных слотов не должно превышать общее количество (${slotsCount})!` 
                                    : lang === 'uz' 
                                    ? `Sozlangan slotlar soni umumiy slotlar sonidan (${slotsCount}) oshib ketmasligi kerak!` 
                                    : `Configured slots count cannot exceed total slots count (${slotsCount})!`
                                  );
                                  return;
                                }
                                setSlotGroups([...slotGroups, { quantity: 1, platform: platform, format: getDefaultFormat(platform) }]);
                              }}
                              className="w-full py-1 text-[9px] font-extrabold text-neutral-600 hover:text-black border border-dashed border-neutral-300 rounded hover:border-neutral-400 bg-white transition"
                            >
                              + {lang === 'ru' ? 'Добавить группу слотов' : lang === 'uz' ? 'Slotlar guruhini qo‘shish' : 'Add Slot Group'}
                            </button>
                          </div>
                        )}

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
                      </>
                    )}

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

                    {/* Attachment: Screenshot/Receipt */}
                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                        {lang === 'ru' ? 'Прикрепить чек / скриншот' : lang === 'uz' ? 'Chek / skrinshot biriktirish' : 'Attach receipt / screenshot'}
                      </label>
                      <input
                        type="file"
                        key={fileInputKey}
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setReceipt(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          } else {
                            setReceipt(null);
                          }
                        }}
                        className="w-full text-[10px] text-neutral-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[9px] file:font-bold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-250 cursor-pointer"
                      />
                    </div>

                    {/* Submit inside TG Mini App */}
                    <button
                      type="submit"
                      className="w-full mt-2 py-2 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-2xs transition"
                    >
                      <Send className="w-3 h-3 text-white" />
                      <span>
                        {paymentType === 'other'
                          ? t.submitReportBtn
                          : bloggerType === 'new'
                          ? t.addIntegrationBtn
                          : t.submitReportBtn}
                      </span>
                    </button>
                  </form>
                </div>
                )}
              </div>

              {/* Bot menu bar bottom */}
              {!isWebApp && (
                <div className="bg-white border-t border-neutral-100 p-2.5 flex justify-around items-center text-[9px] text-neutral-400 font-bold">
                  <span className="text-black">{t.reportForm}</span>
                  <span className="w-1 h-1 rounded-full bg-neutral-300"></span>
                  <span>{t.integrationsTitle}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 bg-white border border-neutral-300 text-black p-4 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-sm">
          <div className="w-7 h-7 rounded-full bg-neutral-100 text-black flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-black" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs font-bold text-black">{t.dbSyncedToast}</p>
            <p className="text-[10px] text-neutral-500 break-words">{successToast.message}</p>
            {successToast.link && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={successToast.link}
                  className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-0.5 text-[9px] text-neutral-600 focus:outline-none w-full select-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(successToast.link!);
                    alert(t.copiedAlert || 'Copied to clipboard!');
                  }}
                  className="px-2 py-0.5 bg-black hover:bg-neutral-900 text-white rounded text-[8px] font-bold shrink-0 transition"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
