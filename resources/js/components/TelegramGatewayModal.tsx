/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  LogOut, 
  Smartphone, 
  ShieldCheck, 
  Zap,
  ExternalLink
} from 'lucide-react';
import { 
  fetchTelegramGatewayStatus, 
  startTelegramGatewayQr, 
  logoutTelegramGateway, 
  restartTelegramGateway,
  TelegramGatewayStatus 
} from '../services/api';
import { Language } from '../translations';

interface TelegramGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
}

export default function TelegramGatewayModal({
  isOpen,
  onClose,
  lang = 'ru',
}: TelegramGatewayModalProps) {
  const [status, setStatus] = useState<TelegramGatewayStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const checkStatus = async () => {
    try {
      const res = await fetchTelegramGatewayStatus();
      setStatus(res);
      return res;
    } catch (err: any) {
      console.error('Failed to fetch gateway status:', err);
      setStatus({ isRunning: false, isAuthorized: false });
    }
  };

  const handleStartQr = async () => {
    setError(null);
    setQrLoading(true);
    try {
      await startTelegramGatewayQr();
      await checkStatus();
    } catch (err: any) {
      setError(err.message || 'Ошибка генерации QR-кода');
    } finally {
      setQrLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Вы уверены, что хотите отключить этот рабочий Telegram-аккаунт?')) {
      return;
    }
    setLoading(true);
    try {
      await logoutTelegramGateway();
      await checkStatus();
    } catch (err: any) {
      alert('Ошибка при выходе: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!window.confirm('Перезапустить микросервис Telegram Gateway?')) {
      return;
    }
    setLoading(true);
    try {
      await restartTelegramGateway();
      await new Promise(r => setTimeout(r, 1000));
      await checkStatus();
    } catch (err: any) {
      alert('Ошибка при перезапуске: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    setLoading(true);
    checkStatus().then((current) => {
      setLoading(false);
      // If running but not authorized, automatically start QR if not active
      if (current?.isRunning && !current?.isAuthorized && !current?.qr) {
        handleStartQr();
      }
    });

    // Start polling status every 2.5s while modal is open
    pollingRef.current = setInterval(async () => {
      const current = await checkStatus();
      // Auto-refresh QR if expiring in less than 3s
      if (current?.isRunning && !current?.isAuthorized && current?.qr?.expires) {
        const expMs = current.qr.expires > 10000000000 ? current.qr.expires : current.qr.expires * 1000;
        if (expMs < Date.now() + 3000 && !qrLoading) {
          handleStartQr();
        }
      }
    }, 2500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-neutral-200 relative animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900 tracking-tight">
                {lang === 'uz' ? 'Telegram shlyuz (QR-kod)' : lang === 'en' ? 'Telegram Gateway (QR Code)' : 'Личный Telegram шлюз'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {lang === 'uz' ? 'Jonli hisobingizni ulash' : lang === 'en' ? 'Connect your personal account' : 'Прямая синхронизация с вашим рабочим профилем'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center font-bold text-sm transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4">
          {/* Microservice not running state */}
          {status && !status.isRunning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2 text-amber-900">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Сервис шлюза не запущен</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Чтобы авторизоваться и общаться от имени своего аккаунта, запустите микросервис в терминале проекта командой:
              </p>
              <div className="px-3 py-2 bg-slate-900 text-emerald-400 font-mono rounded-xl select-all font-bold">
                npm run gateway
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleRestart}
                  disabled={loading}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>Запустить шлюз</span>
                </button>
                <button
                  type="button"
                  onClick={checkStatus}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Проверить снова</span>
                </button>
              </div>
            </div>
          )}

          {/* Authorized State */}
          {status?.isRunning && status?.isAuthorized && status?.user && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0 font-bold text-lg">
                  {status.user.firstName ? status.user.firstName[0].toUpperCase() : 'TG'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {status.user.firstName} {status.user.lastName}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Подключен
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    {status.user.username ? `@${status.user.username}` : (status.user.phone ? `+${status.user.phone}` : 'Telegram User')}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs space-y-2 text-slate-600">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Как сейчас работает общение:</span>
                </div>
                <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-600 pl-1">
                  <li>Сообщения из карточек CRM отправляются <strong>от вашего личного аккаунта</strong>.</li>
                  <li>Для блогера <strong>нет никаких плашек бота</strong> — 100% живой чат человека.</li>
                  <li>Если вы отвечаете с телефона, ответ автоматически появится в карточке CRM.</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleRestart}
                  disabled={loading}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  title="Перезапустить микросервис шлюза при неполадках"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Перезапустить шлюз</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loading}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Отключить аккаунт</span>
                </button>
              </div>
            </div>
          )}

          {/* QR Code Scan State */}
          {status?.isRunning && !status?.isAuthorized && (
            <div className="space-y-4">
              <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-3.5 space-y-2 text-xs text-sky-950">
                <div className="font-bold flex items-center gap-2 text-sky-900 text-sm">
                  <Smartphone className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>
                    {lang === 'uz' ? 'Telefondan 5 soniyada ulanish:' : lang === 'en' ? 'Connect in 5 seconds from phone:' : 'Быстрое подключение с телефона (за 5 секунд):'}
                  </span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 font-medium pl-1 text-[11px] leading-relaxed">
                  <li>{lang === 'uz' ? 'Telefoningizda Telegram ilovasini oching' : lang === 'en' ? 'Open Telegram app on your phone' : 'Откройте Telegram на телефоне'}</li>
                  <li>
                    {lang === 'uz' ? <><strong>Sozlamalar</strong> → <strong>Qurilmalar</strong></> : lang === 'en' ? <><strong>Settings</strong> → <strong>Devices</strong></> : <><strong>Настройки</strong> → <strong>Устройства</strong></>}
                  </li>
                  <li>
                    {lang === 'uz' ? <><strong>«Qurilmani ulash»</strong> tugmasini bosing</> : lang === 'en' ? <>Tap <strong>"Link Desktop Device"</strong></> : <>Нажмите <strong>«Подключить устройство»</strong></>}
                  </li>
                  <li>{lang === 'uz' ? 'Kamerani quyidagi QR-kodga yo‘naltiring' : lang === 'en' ? 'Point camera at the QR code below' : 'Наведите камеру телефона на QR-код ниже'}</li>
                </ol>
              </div>

              {/* QR Image Box */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                {qrLoading || !status.qr?.dataUrl ? (
                  <div className="w-64 h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
                    <span className="text-xs font-medium">Генерация QR-кода Telegram...</span>
                  </div>
                ) : (
                  <div className="space-y-3 flex flex-col items-center">
                    <div className="p-2 bg-white rounded-2xl shadow-md border border-slate-200">
                      <img 
                        src={status.qr.dataUrl} 
                        alt="Telegram Login QR Code" 
                        className="w-60 h-60 object-contain rounded-xl"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium animate-pulse">
                      <Smartphone className="w-3.5 h-3.5 text-sky-500" />
                      <span>Ожидание сканирования камерой...</span>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)} className="font-bold">×</button>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={handleStartQr}
                  disabled={qrLoading}
                  className="text-sky-600 hover:text-sky-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${qrLoading ? 'animate-spin' : ''}`} />
                  <span>Обновить QR-код</span>
                </button>

                <span className="text-[11px] text-slate-400">
                  Безопасное официальное подключение MTProto
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
