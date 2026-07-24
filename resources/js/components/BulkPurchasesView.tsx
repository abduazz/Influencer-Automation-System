import React, { useState } from 'react';
import { Layers, Plus, Calendar, Search, Trash2, CheckCircle2, ArrowRight, DollarSign, Clock, FileText, X } from 'lucide-react';
import { Project, BulkPurchase, Integration } from '../data/mockData';
import { Language, translations } from '../translations';
import { createBulkPurchase, allocateBulkPurchaseSlots, deleteBulkPurchase } from '../services/api';

interface BulkPurchasesViewProps {
  projects: Project[];
  bulkPurchases: BulkPurchase[];
  onRefreshData: () => Promise<void>;
  lang: Language;
  userEmail?: string;
  userRole?: string | null;
}

const formatPrice = (val: number | ''): string => {
  if (val === '' || val === undefined || val === null) return '';
  return new Intl.NumberFormat('ru-RU').format(val);
};

const parsePrice = (str: string): number | '' => {
  const clean = str.replace(/\s/g, '').replace(/ /g, '');
  if (clean === '') return '';
  const num = Number(clean);
  return isNaN(num) ? '' : num;
};

export default function BulkPurchasesView({
  projects,
  bulkPurchases,
  onRefreshData,
  lang,
  userEmail,
  userRole,
}: BulkPurchasesViewProps) {
  const t = translations[lang];

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAllocateBp, setSelectedAllocateBp] = useState<BulkPurchase | null>(null);

  // Form State for New Bulk Purchase
  const [bloggerName, setBloggerName] = useState('');
  const [platform, setPlatform] = useState<'Telegram' | 'Instagram' | 'YouTube' | 'MAX'>('Telegram');
  const [totalSlots, setTotalSlots] = useState<number>(10);
  const [pricePerSlot, setPricePerSlot] = useState<number | ''>(0);
  const [totalAmount, setTotalAmount] = useState<number | ''>(0);
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referralLink, setReferralLink] = useState('');
  const [comments, setComments] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Allocation Modal State
  const [allocateProjectId, setAllocateProjectId] = useState<string>('');
  const [allocateSlotsCount, setAllocateSlotsCount] = useState<number>(1);
  const [isAllocating, setIsAllocating] = useState(false);

  // Filters
  const filteredBulk = bulkPurchases.filter(bp => {
    const searchLower = searchQuery.toLowerCase();
    return (
      bp.bloggerName.toLowerCase().includes(searchLower) ||
      bp.platform.toLowerCase().includes(searchLower) ||
      (bp.comments && bp.comments.toLowerCase().includes(searchLower))
    );
  });

  // Calculate totals
  const totalSlotsCount = bulkPurchases.reduce((acc, bp) => acc + bp.totalSlots, 0);
  const totalAllocated = bulkPurchases.reduce((acc, bp) => acc + bp.allocatedSlots, 0);
  const totalRemaining = bulkPurchases.reduce((acc, bp) => acc + bp.remainingSlots, 0);
  const totalSpend = bulkPurchases.reduce((acc, bp) => acc + bp.totalAmount, 0);

  const handlePricePerSlotChange = (val: number | '') => {
    setPricePerSlot(val);
    const p = val === '' ? 0 : val;
    setTotalAmount(p * totalSlots);
  };

  const handleTotalAmountChange = (val: number | '') => {
    setTotalAmount(val);
    const t = val === '' ? 0 : val;
    const p = totalSlots > 0 ? Math.round(t / totalSlots) : 0;
    setPricePerSlot(p);
  };

  const handleSlotsChange = (newSlots: number) => {
    const slots = Math.max(1, newSlots);
    setTotalSlots(slots);
    const p = pricePerSlot === '' ? 0 : pricePerSlot;
    setTotalAmount(slots * p);
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !bloggerName.trim()) return;

    try {
      setIsSubmitting(true);
      const unitPrice = pricePerSlot === '' ? 0 : pricePerSlot;
      const finalTotal = totalAmount === '' ? (totalSlots * unitPrice) : totalAmount;
      await createBulkPurchase({
        bloggerName: bloggerName.trim(),
        platform,
        totalSlots,
        pricePerSlot: unitPrice,
        paidAmount: finalTotal,
        purchaseDate,
        referralLink: referralLink.trim() || undefined,
        receipt,
        comments: comments.trim() || undefined,
      }, userEmail);

      await onRefreshData();
      setShowAddModal(false);
      // Reset
      setBloggerName('');
      setTotalSlots(10);
      setPricePerSlot(0);
      setTotalAmount(0);
      setReferralLink('');
      setComments('');
      setReceipt(null);
    } catch (err: any) {
      alert(err.message || 'Error creating bulk purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAllocateSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAllocating || !selectedAllocateBp || !allocateProjectId) return;

    try {
      setIsAllocating(true);
      await allocateBulkPurchaseSlots(selectedAllocateBp.id, allocateProjectId, allocateSlotsCount);
      await onRefreshData();
      setSelectedAllocateBp(null);
      setAllocateProjectId('');
      setAllocateSlotsCount(1);
    } catch (err: any) {
      alert(err.message || 'Error allocating slots');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(lang === 'ru' ? 'Удалить этот оптовый пакет?' : 'Ushbu paketni o\'chirmoqchimisiz?')) return;
    try {
      await deleteBulkPurchase(id);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error deleting bulk purchase');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-neutral-900 text-left">
      {/* Page Header */}
      <div className="border-b border-neutral-200 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-black tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-black" />
            {lang === 'ru' ? 'Оптовые закупки (Пул слотов)' : lang === 'uz' ? 'Ommaviy xaridlar (Slotlar puli)' : 'Bulk Purchases (Slot Pool)'}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {lang === 'ru' 
              ? 'Закупайте слоты у блогеров оптом и распределяйте их по проектам в любое время (сегодня, через неделю или месяц).'
              : lang === 'uz'
              ? 'Bloggerlardan slotlarni ommaviy xarid qiling va ularni istalgan vaqtda loyihalarga taqsimlang.'
              : 'Purchase slots from influencers in bulk and allocate them to projects whenever needed.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setPricePerSlot(0);
              setTotalAmount(0);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-black hover:bg-neutral-900 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>{lang === 'ru' ? 'Новая оптовая закупка' : lang === 'uz' ? 'Yangi ommaviy xarid' : 'New Bulk Purchase'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-3xs">
          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
            {lang === 'ru' ? 'Всего закуплено слотов' : lang === 'uz' ? 'Jami sotib olingan' : 'Total Slots Purchased'}
          </span>
          <div className="text-xl font-black text-black mt-1">
            {totalSlotsCount} <span className="text-xs font-bold text-neutral-400">слотов</span>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-3xs">
          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
            {lang === 'ru' ? 'Распределено по проектам' : lang === 'uz' ? 'Loyihalarga taqsimlangan' : 'Allocated to Projects'}
          </span>
          <div className="text-xl font-black text-black mt-1">
            {totalAllocated} <span className="text-xs font-bold text-neutral-400">слотов</span>
          </div>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/40 rounded-xl p-4 shadow-3xs">
          <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider block">
            {lang === 'ru' ? 'Свободно в Резерве' : lang === 'uz' ? 'Zahirada mavjud' : 'Available Reserve'}
          </span>
          <div className="text-xl font-black text-amber-900 mt-1">
            {totalRemaining} <span className="text-xs font-bold text-amber-600">слотов</span>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-3xs">
          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
            {lang === 'ru' ? 'Общие затраты на пакеты' : lang === 'uz' ? 'Jami paket xarajatlari' : 'Total Package Spend'}
          </span>
          <div className="text-xl font-black text-black mt-1">
            {formatPrice(totalSpend)} UZS
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-neutral-400" />
          </span>
          <input
            type="text"
            placeholder={lang === 'ru' ? 'Поиск пакетов...' : 'Paketlarni qidirish...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 focus:bg-white rounded-xl text-xs focus:outline-none focus:border-black text-black shadow-3xs transition"
          />
        </div>
      </div>

      {/* Bulk Packages List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredBulk.length === 0 ? (
          <div className="col-span-full bg-white border border-neutral-200 rounded-2xl p-12 text-center text-neutral-400 space-y-3">
            <Layers className="w-10 h-10 mx-auto text-neutral-300" />
            <p className="text-xs font-medium">
              {lang === 'ru' ? 'Нет зарегистрированных оптовых закупок' : 'Ommaviy xaridlar mavjud emas'}
            </p>
          </div>
        ) : (
          filteredBulk.map((bp) => {
            const percentAllocated = bp.totalSlots > 0 ? Math.round((bp.allocatedSlots / bp.totalSlots) * 100) : 0;

            return (
              <div
                key={bp.id}
                className="bg-white border border-neutral-200 rounded-xl p-5 shadow-3xs hover:border-black transition duration-150 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div>
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded border bg-neutral-50 text-neutral-600 border-neutral-200 uppercase">
                        {bp.platform}
                      </span>
                      <h3 className="font-black text-sm text-black uppercase tracking-tight mt-1">
                        {bp.bloggerName}
                      </h3>
                      <p className="text-[10px] text-neutral-400 font-medium flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-neutral-400" /> {bp.purchaseDate}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(bp.id)}
                      className="p-1 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded transition"
                      title="Удалить пакет"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Progress Bar & Slot Counts */}
                  <div className="space-y-2 mt-3">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-black">
                        Распределено: <strong className="text-black">{bp.allocatedSlots} из {bp.totalSlots}</strong>
                      </span>
                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        {bp.remainingSlots} в резерве
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-black h-full transition-all duration-300"
                        style={{ width: `${percentAllocated}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] bg-neutral-50 border border-neutral-100 p-2.5 rounded-lg">
                    <div>
                      <span className="text-neutral-400 block font-medium">Цена слота:</span>
                      <span className="font-bold text-black">{formatPrice(bp.pricePerSlot)} UZS</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">Общая сумма:</span>
                      <span className="font-black text-black">{formatPrice(bp.totalAmount)} UZS</span>
                    </div>
                  </div>

                  {/* Breakdown of allocated projects summary */}
                  {bp.slotsConfig && bp.slotsConfig.some(s => s.projectId) && (
                    <div className="mt-3 text-[9px] space-y-1">
                      <span className="font-bold text-neutral-400 uppercase tracking-wider block">
                        Назначено на проекты:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const counts: { [name: string]: number } = {};
                          bp.slotsConfig.forEach(s => {
                            if (s.projectId) {
                              const pName = projects.find(p => String(p.id) === String(s.projectId))?.name || `Project #${s.projectId}`;
                              counts[pName] = (counts[pName] || 0) + 1;
                            }
                          });
                          return Object.entries(counts).map(([name, count]) => (
                            <span key={name} className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded font-bold text-neutral-800">
                              {name}: {count} слотов
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Detailed Per-Slot Breakdown */}
                  {bp.slotsConfig && bp.slotsConfig.length > 0 && (
                    <div className="mt-4 border-t border-neutral-100 pt-3 space-y-2">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
                        Распределение слотов (#{bp.totalSlots}):
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {bp.slotsConfig.map((s, idx) => {
                          const targetProj = s.projectId ? projects.find(p => String(p.id) === String(s.projectId)) : null;
                          return (
                            <div
                              key={idx}
                              className={`p-1.5 rounded-lg border text-[10px] flex items-center justify-between transition ${
                                s.projectId
                                  ? 'bg-neutral-900 border-black text-white font-medium'
                                  : 'bg-amber-50/70 border-amber-200 text-amber-900 border-dashed'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                                  s.projectId ? 'bg-white text-black' : 'bg-amber-200 text-amber-900'
                                }`}>
                                  #{s.slot || (idx + 1)}
                                </span>
                                <span className="font-bold truncate text-[9px]">
                                  {s.projectId ? (targetProj?.name || `Project #${s.projectId}`) : 'Резерв'}
                                </span>
                              </div>
                              {s.allocatedAt && (
                                <span className="text-[7.5px] opacity-70 shrink-0 font-mono">
                                  {s.allocatedAt}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Allocate Button */}
                <button
                  type="button"
                  disabled={bp.remainingSlots <= 0}
                  onClick={() => {
                    setSelectedAllocateBp(bp);
                    setAllocateSlotsCount(1);
                    setAllocateProjectId(projects[0]?.id || '');
                  }}
                  className="w-full py-2 bg-black hover:bg-neutral-900 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <span>{bp.remainingSlots > 0 ? 'Выделить слоты на проект' : 'Все слоты распределены'}</span>
                  {bp.remainingSlots > 0 && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: New Bulk Purchase */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl text-left">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <h3 className="font-black text-sm text-black uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-black" />
                Новая оптовая закупка (Пакет)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-neutral-400 hover:text-black rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="space-y-3.5">
              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                  Название канала интеграции / Блогер *
                </label>
                <input
                  type="text"
                  required
                  placeholder="например, @top_channel_tg"
                  value={bloggerName}
                  onChange={(e) => setBloggerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] font-medium text-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                  Дата закупки *
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] font-medium text-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                    Куплено слотов (Всего) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={totalSlots}
                    onChange={(e) => handleSlotsChange(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] font-bold text-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                    Цена за 1 слот (UZS) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatPrice(pricePerSlot)}
                    onChange={(e) => handlePricePerSlotChange(parsePrice(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] font-bold text-black focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                  Общая сумма закупки (UZS) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={formatPrice(totalAmount)}
                  onChange={(e) => handleTotalAmountChange(parsePrice(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] font-bold text-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                  Ссылка на канал / материал (Опционально)
                </label>
                <input
                  type="text"
                  placeholder="https://t.me/..."
                  value={referralLink}
                  onChange={(e) => setReferralLink(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] font-medium text-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                  Заметки / Коментарии
                </label>
                <textarea
                  rows={2}
                  placeholder="Условия оптовой сделки..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] font-medium text-black focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-black hover:bg-neutral-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  {isSubmitting ? 'Сохранение...' : 'Зарегистрировать закупку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Allocate Slots to Project */}
      {selectedAllocateBp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-left">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-black uppercase tracking-wider">
                  Выделить слоты на проект
                </h3>
                <p className="text-[10px] text-neutral-400 font-medium">
                  Пакет: <strong className="text-black">{selectedAllocateBp.bloggerName}</strong> ({selectedAllocateBp.remainingSlots} слотов свободно)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAllocateBp(null)}
                className="p-1 text-neutral-400 hover:text-black rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAllocateSlots} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                  Выберите Целевой Проект *
                </label>
                <select
                  required
                  value={allocateProjectId}
                  onChange={(e) => setAllocateProjectId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] font-bold text-black focus:outline-none"
                >
                  <option value="" disabled>-- Выберите проект --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-1">
                  Количество выделяемых слотов *
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedAllocateBp.remainingSlots}
                  required
                  value={allocateSlotsCount}
                  onChange={(e) => setAllocateSlotsCount(Math.min(selectedAllocateBp.remainingSlots, Math.max(1, Number(e.target.value))))}
                  className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-black rounded-md text-[11px] font-bold text-black focus:outline-none"
                />
                <span className="text-[9px] text-neutral-400 mt-1 block">
                  Максимум доступно: {selectedAllocateBp.remainingSlots} слотов
                </span>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-1 text-xs">
                <div className="flex justify-between text-neutral-500">
                  <span>Стоимость 1 слота:</span>
                  <span className="font-bold text-black">{formatPrice(selectedAllocateBp.pricePerSlot)} UZS</span>
                </div>
                <div className="flex justify-between font-bold text-black border-t border-neutral-200 pt-1">
                  <span>Бюджет, выделяемый проекту:</span>
                  <span className="font-black text-sm">{formatPrice(allocateSlotsCount * selectedAllocateBp.pricePerSlot)} UZS</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isAllocating || !allocateProjectId}
                  className="w-full py-2.5 bg-black hover:bg-neutral-900 disabled:bg-neutral-200 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  {isAllocating ? 'Обработка...' : 'Подтвердить выделение слотов'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
