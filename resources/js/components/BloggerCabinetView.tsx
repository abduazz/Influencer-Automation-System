/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BloggerSubmission, Integration, Project } from '../data/mockData';
import {
  Upload,
  Link,
  Send,
  CheckCircle,
  FileText,
  ExternalLink,
  AlertCircle,
  Check,
  Copy
} from 'lucide-react';
import { Language, translations } from '../translations';
import { getCabinetUrl } from '../utils/url';
import { copyToClipboard } from '../utils/clipboard';


interface BloggerCabinetViewProps {
  projects: Project[];
  integrations: Integration[];
  submissions: BloggerSubmission[];
  onAddSubmission: (submission: Omit<BloggerSubmission, 'id' | 'submittedAt'> & { lang?: string }) => Promise<void> | void;
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
  projects,
  integrations,
  submissions,
  onAddSubmission,
  urlParams,
  lang,
  userRole,
  setLang
}: BloggerCabinetViewProps) {
  const t = translations[lang];

  // Resolve initial integration synchronously from URL parameters or first available item
  const initialMatched = React.useMemo(() => {
    if (urlParams?.integrationId) {
      const matches = integrations.filter(i =>
        String(i.id) === String(urlParams.integrationId) ||
        i.bloggerCabinetToken === urlParams.integrationId
      );
      if (matches.length > 0) {
        // Prioritize active (uncompleted) integration so new slots are immediately visible
        const active = matches.find(i => i.status !== 'completed' && i.kanbanStage !== 'completed');
        if (active) return active;
        return matches[matches.length - 1];
      }
    }
    return integrations[0];
  }, [integrations, urlParams?.integrationId]);

  // Controller State (allows interactive configuration in the preview)
  const [activePlatform, setActivePlatform] = useState<'Telegram' | 'Instagram' | 'YouTube' | 'MAX' | 'TikTok'>(
    () => (urlParams?.platform as any) || initialMatched?.platform || 'Instagram'
  );
  const [activeSlotsCount, setActiveSlotsCount] = useState<number>(() => {
    if (urlParams?.slotsCount) {
      const s = parseInt(urlParams.slotsCount);
      if (s >= 1 && s <= 10) return s;
    }
    return initialMatched?.slotsCount || 4;
  });
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>(
    () => initialMatched?.id || 'int-2'
  );

  const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId) || initialMatched;
  const resolvedProject = projects.find(p => p.id === selectedIntegration?.projectId);
  const projectName = resolvedProject?.name || '';

  const currentSub = submissions.find(s => String(s.integrationId) === String(selectedIntegrationId));
  const currentSubmittedData = currentSub?.data || {};

  // Sort slot indices: empty (unsubmitted) slots at the top, completed (submitted) slots at the bottom
  const sortedSlotIndices = React.useMemo(() => {
    const indices = Array.from({ length: activeSlotsCount }, (_, i) => i);
    return indices.sort((a, b) => {
      const aSubmitted = !!(currentSubmittedData[`slot_${a + 1}`]);
      const bSubmitted = !!(currentSubmittedData[`slot_${b + 1}`]);
      if (aSubmitted === bSubmitted) {
        return a - b;
      }
      return aSubmitted ? 1 : -1;
    });
  }, [activeSlotsCount, currentSubmittedData]);

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
    : submissions.filter(sub => String(sub.integrationId) === String(selectedIntegrationId));

  // Load state from URL parameters if present
  useEffect(() => {
    if (urlParams?.integrationId) {
      const matches = integrations.filter(i => String(i.id) === String(urlParams.integrationId) || i.bloggerCabinetToken === urlParams.integrationId);
      if (matches.length > 0) {
        const matched = matches.find(i => i.status !== 'completed' && i.kanbanStage !== 'completed') || matches[matches.length - 1];
        if (matched && matched.id !== selectedIntegrationId) {
          setSelectedIntegrationId(matched.id);
          setActivePlatform(matched.platform);
          setActiveSlotsCount(matched.slotsCount);
          return;
        }
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
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initialData: Record<string, string> = {};
    const effId = initialMatched?.id || 'int-2';
    const effSlots = (urlParams?.slotsCount && parseInt(urlParams.slotsCount) >= 1 && parseInt(urlParams.slotsCount) <= 10)
      ? parseInt(urlParams.slotsCount)
      : (initialMatched?.slotsCount || 4);
    const existingSub = submissions.find(s => String(s.integrationId) === String(effId));
    const submittedData = existingSub?.data || {};
    for (let i = 1; i <= effSlots; i++) {
      const key = `slot_${i}`;
      initialData[key] = submittedData[key] || '';
    }
    return initialData;
  });

  const [filePreviews, setFilePreviews] = useState<Record<string, string>>(() => {
    const initialPreviews: Record<string, string> = {};
    const effId = initialMatched?.id || 'int-2';
    const effSlots = (urlParams?.slotsCount && parseInt(urlParams.slotsCount) >= 1 && parseInt(urlParams.slotsCount) <= 10)
      ? parseInt(urlParams.slotsCount)
      : (initialMatched?.slotsCount || 4);
    const existingSub = submissions.find(s => String(s.integrationId) === String(effId));
    const submittedData = existingSub?.data || {};
    for (let i = 1; i <= effSlots; i++) {
      const key = `slot_${i}`;
      if (submittedData[key] && submittedData[key].startsWith('data:image/')) {
        initialPreviews[key] = submittedData[key];
      } else if (submittedData[key] && !submittedData[key].startsWith('http')) {
        initialPreviews[key] = 'mock-file-url';
      }
    }
    return initialPreviews;
  });

  const [slotInputModes, setSlotInputModes] = useState<Record<string, 'link' | 'screenshot'>>({});
  const [activeFocusedSlotKey, setActiveFocusedSlotKey] = useState<string | null>(null);
  const [draggingOverSlotKey, setDraggingOverSlotKey] = useState<string | null>(null);
  const [pasteNotification, setPasteNotification] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-dismiss paste notification after 3.5 seconds
  useEffect(() => {
    if (!pasteNotification) return;
    const timer = setTimeout(() => {
      setPasteNotification(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [pasteNotification]);

  // Extract all image files from DataTransfer (files or items from clipboard / drag-and-drop)
  const extractImagesFromDataTransfer = (data: DataTransfer | null): File[] => {
    if (!data) return [];
    const files: File[] = [];

    if (data.files && data.files.length > 0) {
      for (let i = 0; i < data.files.length; i++) {
        const file = data.files[i];
        if (file && file.type.startsWith('image/')) {
          files.push(file);
        }
      }
    }

    if (files.length === 0 && data.items && data.items.length > 0) {
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        if (item && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }
    }

    return files;
  };

  const [formSubmitted, setFormSubmitted] = useState<boolean>(() => {
    const effId = initialMatched?.id || 'int-2';
    const effSlots = (urlParams?.slotsCount && parseInt(urlParams.slotsCount) >= 1 && parseInt(urlParams.slotsCount) <= 10)
      ? parseInt(urlParams.slotsCount)
      : (initialMatched?.slotsCount || 4);
    const existingSub = submissions.find(s => String(s.integrationId) === String(effId));
    if (!existingSub) return false;
    const submittedData = existingSub.data || {};
    for (let i = 1; i <= effSlots; i++) {
      if (!submittedData[`slot_${i}`]) return false;
    }
    return true;
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [copiedCabinetLink, setCopiedCabinetLink] = useState(false);
  const [copiedReferralLink, setCopiedReferralLink] = useState(false);

  // Re-initialize form data state when platform or slots count changes
  useEffect(() => {
    const initialData: Record<string, string> = {};
    const initialPreviews: Record<string, string> = {};

    const existingSub = submissions.find(s => String(s.integrationId) === String(selectedIntegrationId));
    const submittedData = existingSub?.data || {};

    for (let i = 1; i <= activeSlotsCount; i++) {
      const key = `slot_${i}`;
      initialData[key] = submittedData[key] || '';

      // If it's a base64 image submission, load it directly into previews; otherwise mock preview
      if (submittedData[key] && submittedData[key].startsWith('data:image/')) {
        initialPreviews[key] = submittedData[key];
      } else if (submittedData[key] && !submittedData[key].startsWith('http')) {
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

  // Process an image file from file input, drop or clipboard paste
  const handleFileProcess = async (slotKey: string, file: File) => {
    if (!file) return;
    // Automatically switch this slot to screenshot mode so the user sees the preview immediately
    setSlotInputModes(prev => ({ ...prev, [slotKey]: 'screenshot' }));
    try {
      const compressedBase64 = await compressImage(file, 1200, 1200, 0.7);
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
        const base64String = (reader.result as string) || '';
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
  };

  // Handle file picker simulation (converting screenshot to base64 with compression)
  const handleFileChangeSim = async (slotKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileProcess(slotKey, file);
    }
  };

  // Global paste handler for Blogger Cabinet (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (formSubmitted) return;
      const activeEl = document.activeElement;
      const isTextInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement).isContentEditable
      );
      const textData = e.clipboardData?.getData('text/plain') || '';
      // If typing in a text input and clipboard contains text, allow standard paste
      if (isTextInput && textData.trim().length > 0) return;

      const images = extractImagesFromDataTransfer(e.clipboardData);
      if (images.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      // Check which slot to target:
      // 1. Element inside a slot container
      let targetSlotKey: string | null = null;
      if (activeEl) {
        const slotEl = activeEl.closest('[data-slot-key]');
        if (slotEl) {
          targetSlotKey = slotEl.getAttribute('data-slot-key');
        }
      }

      // 2. Focused/clicked slot recorded in state
      if (!targetSlotKey && activeFocusedSlotKey) {
        targetSlotKey = activeFocusedSlotKey;
      }

      // 3. First unfilled slot
      if (!targetSlotKey) {
        for (let i = 1; i <= activeSlotsCount; i++) {
          const key = `slot_${i}`;
          if (!formData[key]) {
            targetSlotKey = key;
            break;
          }
        }
      }

      // 4. Default to slot_1
      if (!targetSlotKey) {
        targetSlotKey = 'slot_1';
      }

      handleFileProcess(targetSlotKey, images[0]);
      const slotNumStr = targetSlotKey.replace('slot_', '');
      setPasteNotification(
        lang === 'ru'
          ? `✓ Скриншот слота #${slotNumStr} добавлен из буфера обмена (Ctrl+V / ⌘V)`
          : lang === 'uz'
            ? `✓ Слот #${slotNumStr} skrinshoti buferdan qo‘shildi (Ctrl+V / ⌘V)`
            : `✓ Slot #${slotNumStr} screenshot added from clipboard (Ctrl+V / ⌘V)`
      );
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [formSubmitted, activeSlotsCount, formData, activeFocusedSlotKey, lang]);

  const handleClearSlot = (slotKey: string) => {
    setFilePreviews(prev => {
      const copy = { ...prev };
      delete copy[slotKey];
      return copy;
    });
    setFormData(prev => ({
      ...prev,
      [slotKey]: ''
    }));
  };

  const handleLinkChange = (slotKey: string, val: string) => {
    setFormData(prev => ({
      ...prev,
      [slotKey]: val
    }));
  };

  const validateSlotUrl = (
    url: string,
    platform: string,
    _format?: string
  ): { valid: boolean; errorKey?: 'cabinetUrlForbidden' | 'invalidPlatformUrl' } => {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return { valid: true };
    }

    if (url.startsWith('data:image/') || url.startsWith('mock')) {
      return { valid: true };
    }

    let trimmed = url.trim();
    if (!trimmed.match(/^https?:\/\//i)) {
      trimmed = `https://${trimmed}`;
    }

    const lower = trimmed.toLowerCase();

    // 1. Block cabinet links
    const isCabinetLink = lower.includes('/c/') ||
      lower.includes('cabinet') ||
      (typeof window !== 'undefined' && window.location.host && lower.includes(window.location.host.toLowerCase())) ||
      lower.includes('khalilovdev.uz');
    if (isCabinetLink) {
      return { valid: false, errorKey: 'cabinetUrlForbidden' };
    }

    // 2. Validate HTTP/HTTPS protocol
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
      return { valid: false, errorKey: 'invalidPlatformUrl' };
    }

    // 3. Platform specific rules
    if (platform === 'Instagram') {
      if (!lower.includes('instagram.com') && !lower.includes('instagr.am')) {
        return { valid: false, errorKey: 'invalidPlatformUrl' };
      }
    } else if (platform === 'Telegram') {
      if (!lower.includes('t.me') && !lower.includes('telegram.me') && !lower.includes('telegram.org') && !lower.includes('telegram.dog')) {
        return { valid: false, errorKey: 'invalidPlatformUrl' };
      }
    } else if (platform === 'YouTube') {
      if (!lower.includes('youtube.com') && !lower.includes('youtu.be')) {
        return { valid: false, errorKey: 'invalidPlatformUrl' };
      }
    } else if (platform === 'TikTok') {
      if (!lower.includes('tiktok.com')) {
        return { valid: false, errorKey: 'invalidPlatformUrl' };
      }
    }

    return { valid: true };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const existingSub = submissions.find(s => String(s.integrationId) === String(selectedIntegrationId));
    const submittedData = existingSub?.data || {};

    // Auto-normalize any URLs that lack protocol
    const normalizedFormData: Record<string, string> = { ...formData };
    for (let idx = 0; idx < activeSlotsCount; idx++) {
      const k = `slot_${idx + 1}`;
      let val = (normalizedFormData[k] || '').trim();
      if (val && !val.match(/^https?:\/\//i) && !val.startsWith('data:') && !val.startsWith('mock')) {
        normalizedFormData[k] = `https://${val}`;
      }
    }
    setFormData(normalizedFormData);

    // Check if at least one new slot is being filled in this turn
    const hasNewInput = Array.from({ length: activeSlotsCount }).some((_, idx) => {
      const key = `slot_${idx + 1}`;
      return !submittedData[key] && !!normalizedFormData[key] && normalizedFormData[key].trim() !== '';
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

    // Validate all filled new inputs
    for (let idx = 0; idx < activeSlotsCount; idx++) {
      const slotNum = idx + 1;
      const key = `slot_${slotNum}`;
      const val = normalizedFormData[key];
      if (!submittedData[key] && val && val.trim() !== '') {
        const slotConfig = selectedIntegration?.slotsConfig?.[idx];
        const slotPlatform = slotConfig ? slotConfig.platform : activePlatform;
        const slotFormat = slotConfig ? slotConfig.format : (
          activePlatform === 'Instagram' ? 'Stories' :
            activePlatform === 'Telegram' ? 'Post' :
              activePlatform === 'YouTube' ? 'Shorts' :
                activePlatform === 'TikTok' ? 'VideoPost' :
                  'Post'
        );
        const validation = validateSlotUrl(val, slotPlatform, slotFormat);
        if (!validation.valid) {
          const errorMsg = validation.errorKey === 'cabinetUrlForbidden'
            ? `Slot #${slotNum} (${slotPlatform}): ${t.cabinetUrlForbidden}`
            : `Slot #${slotNum} (${slotPlatform}): ${t.invalidPlatformUrl.replace('{platform}', slotPlatform)}`;
          alert(errorMsg);
          return;
        }
      }
    }

    setShowConfirm(true);
  };


  const handleFinalSubmit = async () => {
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
      let val = (formData[key] || '').trim();
      if (val && !val.match(/^https?:\/\//i) && !val.startsWith('data:') && !val.startsWith('mock')) {
        val = `https://${val}`;
      }
      submittedPayload[key] = val;
    }

    setIsSubmitting(true);
    try {
      await onAddSubmission({
        integrationId: selectedIntegration?.id || selectedIntegrationId,
        status: 'approved',
        data: submittedPayload,
        lang: lang
      });

      setFormSubmitted(true);
      setShowConfirm(false);
    } catch (err: any) {
      console.error('Failed to submit deliverable:', err);
      alert(err?.message || (lang === 'ru' ? 'Ошибка при отправке материалов' : 'Xatolik yuz berdi'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (integrations.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-8 space-y-4 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-200 rounded-md w-1/3 mx-auto"></div>
          <div className="h-4 bg-neutral-100 rounded-md w-1/2 mx-auto"></div>
          <div className="pt-6 space-y-3">
            <div className="h-28 bg-white border border-neutral-200 rounded-xl"></div>
            <div className="h-28 bg-white border border-neutral-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

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
              const cabinetUrl = getCabinetUrl(tokenOrId);
              const ok = await copyToClipboard(cabinetUrl);
              if (ok) {
                setCopiedCabinetLink(true);
                setTimeout(() => setCopiedCabinetLink(false), 2000);
              }
            }}
            className={`px-3.5 py-1.5 font-extrabold rounded-lg transition duration-150 flex items-center gap-1.5 cursor-pointer ${copiedCabinetLink
                ? 'bg-emerald-600 text-white'
                : 'bg-black hover:bg-neutral-900 text-white'
              }`}
          >
            {copiedCabinetLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Link className="w-3.5 h-3.5" />}
            <span>
              {copiedCabinetLink
                ? (lang === 'ru' ? 'Ссылка скопирована!' : lang === 'uz' ? 'Havola nusxalandi!' : 'Link copied!')
                : (lang === 'ru' ? 'Копировать ссылку для блогера' : lang === 'uz' ? 'Blogger havolasini nusxalash' : 'Copy Blogger Link')}
            </span>
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
                  {sortedSlotIndices.map((index) => {
                    const slotNum = index + 1;
                    const slotKey = `slot_${slotNum}`;
                    const slotConfig = selectedIntegration?.slotsConfig?.[index];
                    const slotPlatform = slotConfig ? slotConfig.platform : activePlatform;
                    const slotFormat = slotConfig ? slotConfig.format : (
                      activePlatform === 'Instagram' ? 'Stories' :
                        activePlatform === 'Telegram' ? 'Post' :
                          activePlatform === 'YouTube' ? 'Shorts' :
                            activePlatform === 'TikTok' ? 'VideoPost' :
                              'Post'
                    );
                    const isPaid = selectedIntegration
                      ? (index < (selectedIntegration.paidSlotsCount ?? selectedIntegration.slotsCount))
                      : true;

                    const value = formData[slotKey];
                    if (!value && !isPaid) return null;

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
                    disabled={isSubmitting}
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 py-2.5 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    {lang === 'ru' ? 'Назад / Изменить' : lang === 'uz' ? 'Orqaga / O‘zgartirish' : 'Back / Edit'}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleFinalSubmit}
                    className="flex-1 py-2.5 bg-black hover:bg-neutral-900 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <span>{lang === 'ru' ? 'Отправка...' : lang === 'uz' ? 'Yuborilmoqda...' : 'Submitting...'}</span>
                    ) : (
                      <span>{lang === 'ru' ? 'Подтверждаю отправку' : lang === 'uz' ? 'Yuborishni tasdiqlayman' : 'Confirm & Submit'}</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Interactive Submission Form */
              <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto w-full">
                <div className="flex justify-between items-center border-b border-neutral-100 pb-3 mb-4">
                  <div className="text-left">
                    <h2 className="text-base font-black text-black tracking-tight flex items-center gap-2">
                      <span>{t.bloggerCabinetTitle} {projectName ? `— ${projectName}` : ''}</span>
                    </h2>
                    {selectedIntegration && (
                      <div className="flex items-center gap-2 mt-1 text-xs font-bold text-neutral-700 flex-wrap">
                        {selectedIntegration.bloggerName && (
                          <span className="shrink-0">👤 {selectedIntegration.bloggerName}</span>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            const refLink = selectedIntegration.referralLink?.trim();
                            if (!refLink) {
                              alert(
                                lang === 'ru'
                                  ? 'Реферальная ссылка пока не указана'
                                  : lang === 'uz'
                                    ? 'Referal havola hali ko‘rsatilmagan'
                                    : 'Referral link is not specified yet'
                              );
                              return;
                            }
                            const ok = await copyToClipboard(refLink);
                            if (ok) {
                              setCopiedReferralLink(true);
                              setTimeout(() => setCopiedReferralLink(false), 2000);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-extrabold transition cursor-pointer select-none ${copiedReferralLink
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-200 text-neutral-800'
                            }`}
                          title={
                            selectedIntegration.referralLink
                              ? selectedIntegration.referralLink
                              : (lang === 'ru' ? 'Реферальная ссылка не указана' : lang === 'uz' ? 'Referal havola ko‘rsatilmagan' : 'Referral link not set')
                          }
                        >
                          {copiedReferralLink ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>{lang === 'ru' ? 'Ссылка скопирована!' : lang === 'uz' ? 'Havola nusxalandi!' : 'Link copied!'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-neutral-500" />
                              <span>{lang === 'ru' ? 'Копировать реферальную ссылку' : lang === 'uz' ? 'Referal havolani nusxalash' : 'Copy referral link'}</span>
                            </>
                          )}
                        </button>
                        <a
                          href="https://t.me/globalpr_admin"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[10px] text-sky-700 font-extrabold hover:bg-sky-500 hover:text-white transition group cursor-pointer"
                          title={lang === 'ru' ? 'Открыть диалог с менеджером в Telegram (@globalpr_admin)' : lang === 'uz' ? 'Telegramda menejer bilan bog‘lanish (@globalpr_admin)' : 'Open Telegram chat with manager (@globalpr_admin)'}
                        >
                          <Send className="w-2.5 h-2.5 text-sky-500 group-hover:text-white" />
                          <span>{lang === 'ru' ? 'Чат с менеджером' : lang === 'uz' ? 'Menejer bilan Telegram chat' : 'Telegram chat with manager'}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-sky-400 group-hover:text-white" />
                        </a>
                      </div>
                    )}
                    <p className="text-[10px] text-neutral-500 mt-1">
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
                          className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all duration-100 ${lang === l
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

                {/* Paste Notification Toast */}
                {pasteNotification && (
                  <div className="mb-3 flex items-center justify-between gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{pasteNotification}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPasteNotification(null)}
                      className="text-emerald-500 hover:text-emerald-800 text-xs font-bold leading-none cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t border-neutral-200">
                  {/* Generates activeSlotsCount fields: empty (unsubmitted) slots first, completed slots below */}
                  {sortedSlotIndices.map((index, renderIdx) => {
                    const slotNum = index + 1;
                    const slotKey = `slot_${slotNum}`;

                    const existingSub = submissions.find(s => String(s.integrationId) === String(selectedIntegrationId));
                    const submittedData = existingSub?.data || {};
                    const isSlotSubmitted = !!(submittedData[slotKey]);

                    const prevIndex = renderIdx > 0 ? sortedSlotIndices[renderIdx - 1] : null;
                    const isFirstCompleted = isSlotSubmitted && (prevIndex === null || !submittedData[`slot_${prevIndex + 1}`]);

                    // Retrieve individual slot configuration if set in Report Form
                    const slotConfig = selectedIntegration?.slotsConfig?.[index];
                    const slotPlatform = slotConfig ? slotConfig.platform : activePlatform;
                    const slotFormat = slotConfig ? slotConfig.format : (
                      activePlatform === 'Instagram' ? 'Stories' :
                        activePlatform === 'Telegram' ? 'Post' :
                          activePlatform === 'YouTube' ? 'Shorts' :
                            activePlatform === 'TikTok' ? 'VideoPost' :
                              'Post'
                    );

                    // Check if slot is prepaid based on selectedIntegration
                    const isPaid = selectedIntegration
                      ? (index < (selectedIntegration.paidSlotsCount ?? selectedIntegration.slotsCount))
                      : true; // fallback to true if no integration mapped

                    const slotVal = formData[slotKey] || '';
                    const isImageValue = slotVal.startsWith('data:image/') || slotVal.startsWith('mock') || !!filePreviews[slotKey];
                    const currentMode = slotInputModes[slotKey] || (
                      isImageValue
                        ? 'screenshot'
                        : (slotPlatform === 'Instagram' && slotFormat === 'Stories' ? 'screenshot' : 'link')
                    );

                    return (
                      <React.Fragment key={slotKey}>
                        {isFirstCompleted && renderIdx > 0 && (
                          <div className="pt-4 pb-2 flex items-center gap-2 select-none">
                            <div className="h-px bg-neutral-200 flex-1" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{lang === 'ru' ? 'Выполненные слоты' : lang === 'uz' ? 'Bajarilgan slotlar' : 'Completed slots'}</span>
                            </span>
                            <div className="h-px bg-neutral-200 flex-1" />
                          </div>
                        )}

                        <div
                          data-slot-key={slotKey}
                          tabIndex={0}
                          onFocus={() => setActiveFocusedSlotKey(slotKey)}
                          onClick={() => setActiveFocusedSlotKey(slotKey)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDraggingOverSlotKey(slotKey);
                          }}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDraggingOverSlotKey(slotKey);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (draggingOverSlotKey === slotKey) setDraggingOverSlotKey(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDraggingOverSlotKey(null);
                            const images = extractImagesFromDataTransfer(e.dataTransfer);
                            if (images.length > 0) {
                              handleFileProcess(slotKey, images[0]);
                              setPasteNotification(
                                lang === 'ru'
                                  ? `✓ Скриншот слота #${slotNum} успешно загружен`
                                  : lang === 'uz'
                                    ? `✓ Слот #${slotNum} skrinshoti yuklandi`
                                    : `✓ Slot #${slotNum} screenshot uploaded`
                              );
                            }
                          }}
                          onPaste={(e) => {
                            const images = extractImagesFromDataTransfer(e.clipboardData);
                            if (images.length > 0) {
                              e.preventDefault();
                              e.stopPropagation();
                              handleFileProcess(slotKey, images[0]);
                              setPasteNotification(
                                lang === 'ru'
                                  ? `✓ Скриншот слота #${slotNum} добавлен из буфера обмена (Ctrl+V / ⌘V)`
                                  : lang === 'uz'
                                    ? `✓ Слот #${slotNum} skrinshoti buferdan qo‘shildi (Ctrl+V / ⌘V)`
                                    : `✓ Slot #${slotNum} screenshot added from clipboard (Ctrl+V / ⌘V)`
                              );
                            }
                          }}
                          className={`p-4 bg-white border rounded-xl space-y-3 transition duration-150 ${draggingOverSlotKey === slotKey
                              ? 'border-black ring-2 ring-black/10 bg-neutral-50/80 shadow-md'
                              : 'border-neutral-200 shadow-2xs'
                            }`}
                        >
                          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black text-black uppercase tracking-wider">
                                {t.slotLabel} #{slotNum}
                              </span>

                              {/* Specific Platform & Format Badge */}
                              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide border ${slotPlatform === 'Instagram'
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

                          {/* Submission Mode Selector (Link vs Screenshot) - when slot is not locked */}
                          {!isSlotSubmitted && (
                            <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 w-fit text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => setSlotInputModes(prev => ({ ...prev, [slotKey]: 'link' }))}
                                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${currentMode === 'link' ? 'bg-white text-black shadow-2xs' : 'text-neutral-500 hover:text-black'
                                  }`}
                              >
                                <Link className="w-3 h-3" />
                                <span>{lang === 'ru' ? 'Ссылка на пост' : lang === 'uz' ? 'Post havolasi' : 'Post Link'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSlotInputModes(prev => ({ ...prev, [slotKey]: 'screenshot' }))}
                                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${currentMode === 'screenshot' ? 'bg-white text-black shadow-2xs' : 'text-neutral-500 hover:text-black'
                                  }`}
                              >
                                <Upload className="w-3 h-3" />
                                <span>{lang === 'ru' ? 'Фото / Скриншот' : lang === 'uz' ? 'Rasm / Skrinshot' : 'Photo / Screenshot'}</span>
                              </button>
                            </div>
                          )}

                          {/* Slot content */}
                          {isSlotSubmitted ? (
                            /* Already submitted slot */
                            isImageValue ? (
                              <div className="flex items-center gap-3 p-2.5 bg-neutral-100 border border-neutral-200 rounded-xl select-none text-left">
                                <div
                                  className="w-10 h-10 rounded bg-white overflow-hidden border border-neutral-200 shrink-0 cursor-pointer hover:opacity-80 transition flex items-center justify-center"
                                  onClick={() => {
                                    const src = filePreviews[slotKey] || slotVal;
                                    if (src) {
                                      const win = window.open();
                                      if (win) {
                                        win.document.write(`<img src="${src}" style="max-width:100%; height:auto;" />`);
                                      }
                                    }
                                  }}
                                  title={lang === 'ru' ? 'Нажмите, чтобы открыть фото' : lang === 'uz' ? 'Rasmni ochish uchun bosing' : 'Click to view image'}
                                >
                                  {filePreviews[slotKey] || slotVal.startsWith('data:image/') ? (
                                    <img src={filePreviews[slotKey] || slotVal} alt="Screenshot" className="w-full h-full object-cover" />
                                  ) : (
                                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-bold text-amber-700 truncate">
                                    {lang === 'ru' ? '📸 Скриншот-отчет' : lang === 'uz' ? '📸 Skrinshot-hisobot' : '📸 Screenshot report'}
                                  </p>
                                  <p className="text-[9px] text-emerald-600 font-extrabold uppercase">
                                    ✓ {lang === 'ru' ? 'Отправлено' : lang === 'uz' ? 'Yuborilgan' : 'Submitted'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 p-2.5 bg-neutral-100 border border-neutral-200 rounded-xl select-none text-left">
                                <div className="w-8 h-8 rounded bg-white border border-neutral-200 flex items-center justify-center shrink-0">
                                  <Link className="w-4 h-4 text-neutral-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <a
                                    href={slotVal.startsWith('http') ? slotVal : `https://${slotVal}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-bold text-blue-600 hover:underline truncate block"
                                  >
                                    {slotVal}
                                  </a>
                                  <p className="text-[9px] text-emerald-600 font-extrabold uppercase">
                                    ✓ {lang === 'ru' ? 'Отправлено' : lang === 'uz' ? 'Yuborilgan' : 'Submitted'}
                                  </p>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              </div>
                            )
                          ) : currentMode === 'screenshot' ? (
                            /* SCREENSHOT FILE UPLOAD COMPONENT */
                            <div className="space-y-1">
                              {filePreviews[slotKey] || slotVal.startsWith('data:image/') ? (
                                <div className="flex items-center gap-2.5 p-1.5 bg-neutral-50 border border-neutral-200 rounded-md">
                                  <div
                                    className="w-8 h-8 rounded bg-white overflow-hidden border border-neutral-200 shrink-0 cursor-pointer"
                                    onClick={() => {
                                      const src = filePreviews[slotKey] || slotVal;
                                      if (src) {
                                        const win = window.open();
                                        if (win) {
                                          win.document.write(`<img src="${src}" style="max-width:100%; height:auto;" />`);
                                        }
                                      }
                                    }}
                                  >
                                    <img src={filePreviews[slotKey] || slotVal} alt="Screenshot" className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-black truncate">
                                      {lang === 'ru' ? 'Фото-пруф загружен' : lang === 'uz' ? 'Rasm yuklandi' : 'Photo proof loaded'}
                                    </p>
                                    <p className="text-[8.5px] text-emerald-600 font-medium">
                                      {lang === 'ru' ? 'Готово к отправке' : lang === 'uz' ? 'Yuborishga tayyor' : 'Ready to submit'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <label className="text-[9.5px] font-bold text-black hover:bg-neutral-50 px-2 py-0.5 bg-white border border-neutral-200 rounded cursor-pointer transition">
                                      {lang === 'ru' ? 'Заменить' : lang === 'uz' ? 'O‘zgartirish' : 'Change'}
                                      <input
                                        type="file"
                                        accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif"
                                        onChange={(e) => handleFileChangeSim(slotKey, e)}
                                        className="hidden"
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleClearSlot(slotKey)}
                                      className="text-[9.5px] font-bold text-red-600 hover:bg-red-50 px-1.5 py-0.5 bg-white border border-neutral-200 rounded cursor-pointer transition"
                                      title={lang === 'ru' ? 'Очистить' : 'Tozalash'}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const images = extractImagesFromDataTransfer(e.dataTransfer);
                                      if (images.length > 0) {
                                        handleFileProcess(slotKey, images[0]);
                                        setPasteNotification(
                                          lang === 'ru'
                                            ? `✓ Скриншот слота #${slotNum} успешно загружен`
                                            : lang === 'uz'
                                              ? `✓ Слот #${slotNum} skrinshoti yuklandi`
                                              : `✓ Slot #${slotNum} screenshot uploaded`
                                        );
                                      }
                                    }}
                                    className="w-full border border-dashed border-neutral-300 hover:border-black rounded-md py-1.5 px-3 transition duration-150 bg-white hover:bg-neutral-50 flex items-center justify-center gap-2 cursor-pointer relative group text-xs text-neutral-600"
                                  >
                                    <Upload className="w-3.5 h-3.5 text-neutral-400 group-hover:text-black transition shrink-0" />
                                    <span className="text-xs font-medium text-neutral-700 truncate">
                                      {t.uploadProof} ({slotPlatform} - {slotFormat})
                                    </span>
                                    <input
                                      type="file"
                                      accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif"
                                      onChange={(e) => handleFileChangeSim(slotKey, e)}
                                      className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[7.5px] text-neutral-400 px-0.5">
                                    <span>{lang === 'ru' ? 'или вставьте скриншот (до 15 МБ):' : lang === 'uz' ? 'yoki skrinshotni qo‘ying:' : 'or paste screenshot:'}</span>
                                    <span className="inline-flex items-center gap-1 font-mono">
                                      <kbd className="px-1 py-0.2 bg-neutral-100 border border-neutral-200 rounded text-[7px] font-bold text-neutral-600 shadow-2xs">Ctrl + V</kbd>
                                      <span>/</span>
                                      <kbd className="px-1 py-0.2 bg-neutral-100 border border-neutral-200 rounded text-[7px] font-bold text-neutral-600 shadow-2xs">⌘V</kbd>
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* URL TEXT INPUT FIELD */
                            <div className="space-y-1">
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <Link className="w-3.5 h-3.5 text-neutral-400" />
                                </div>
                                {(() => {
                                  const isInvalid = slotVal.trim() !== '' && !validateSlotUrl(slotVal, slotPlatform, slotFormat).valid;
                                  return (
                                    <input
                                      type="text"
                                      data-slot-input={slotKey}
                                      onFocus={() => setActiveFocusedSlotKey(slotKey)}
                                      onPaste={(e) => {
                                        const images = extractImagesFromDataTransfer(e.clipboardData);
                                        if (images.length > 0) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleFileProcess(slotKey, images[0]);
                                          setPasteNotification(
                                            lang === 'ru'
                                              ? `✓ Скриншот слота #${slotNum} добавлен из буфера обмена (Ctrl+V / ⌘V)`
                                              : lang === 'uz'
                                                ? `✓ Слот #${slotNum} skrinshoti buferdan qo‘shildi (Ctrl+V / ⌘V)`
                                                : `✓ Slot #${slotNum} screenshot added from clipboard (Ctrl+V / ⌘V)`
                                          );
                                        }
                                      }}
                                      placeholder={
                                        slotPlatform === 'Instagram'
                                          ? `e.g. https://instagram.com/reel/abc123xyz (${slotFormat})`
                                          : slotPlatform === 'Telegram'
                                            ? `e.g. https://t.me/channel_name/123 (${slotFormat})`
                                            : `e.g. https://youtube.com/watch?v=abc123xyz (${slotFormat})`
                                      }
                                      value={slotVal}
                                      onChange={(e) => handleLinkChange(slotKey, e.target.value)}
                                      onBlur={(e) => {
                                        let v = e.target.value.trim();
                                        if (v && !v.match(/^https?:\/\//i) && !v.startsWith('data:') && !v.startsWith('mock')) {
                                          handleLinkChange(slotKey, `https://${v}`);
                                        }
                                      }}
                                      className={`w-full pl-9 pr-10 py-1.5 border focus:outline-none rounded-md text-xs transition ${isInvalid
                                          ? 'bg-red-50 border-red-500 text-red-900 focus:border-red-600'
                                          : 'bg-white border-neutral-200 text-black font-medium focus:border-black'
                                        }`}
                                    />
                                  );
                                })()}
                              </div>
                              <div className="flex items-center justify-between text-[7.5px] text-neutral-400 px-0.5">
                                <span>{lang === 'ru' ? 'Вставьте ссылку или скриншот:' : lang === 'uz' ? 'Havola yoki skrinshotni qo‘ying:' : 'Paste link or screenshot:'}</span>
                                <span className="inline-flex items-center gap-1 font-mono">
                                  <kbd className="px-1 py-0.2 bg-neutral-100 border border-neutral-200 rounded text-[7px] font-bold text-neutral-600 shadow-2xs">Ctrl + V</kbd>
                                  <span>/</span>
                                  <kbd className="px-1 py-0.2 bg-neutral-100 border border-neutral-200 rounded text-[7px] font-bold text-neutral-600 shadow-2xs">⌘V</kbd>
                                </span>
                              </div>
                              {(() => {
                                if (slotVal.trim() !== '') {
                                  const v = validateSlotUrl(slotVal, slotPlatform, slotFormat);
                                  if (!v.valid) {
                                    return (
                                      <p className="text-[10px] font-bold text-red-600 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                                        <span>
                                          {v.errorKey === 'cabinetUrlForbidden'
                                            ? t.cabinetUrlForbidden
                                            : t.invalidPlatformUrl.replace('{platform}', slotPlatform)}
                                        </span>
                                      </p>
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
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
                      const matchingInt = integrations.find(i => String(i.id) === String(sub.integrationId));

                      return (
                        <tr key={sub.id}>
                          <td className="py-3 px-5 font-bold text-black">
                            {matchingInt?.bloggerName || 'Simulated Influencer'}
                            <span className="text-[9px] text-neutral-400 font-normal block mt-0.5">
                              Platform: {matchingInt?.platform || 'Unknown'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-neutral-500 text-[11px]">
                            {new Date(sub.submittedAt).toLocaleDateString()} {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] border uppercase ${sub.status === 'approved'
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
