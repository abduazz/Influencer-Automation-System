/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { AllowedUser } from '../data/mockData';
import { translations, Language } from '../translations';
import {
  ShieldAlert,
  Globe,
  Radio,
  KeyRound,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  User,
  Hash,
} from 'lucide-react';
import {
  requestTelegramCode,
  pollTelegramOtpStatus,
  verifyTelegramCode,
} from '../services/api';

interface LoginViewProps {
  onLoginSuccess: (user: AllowedUser, token?: string) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  initialError?: string | null;
}

export default function LoginView({
  onLoginSuccess,
  lang,
  setLang,
  initialError = null,
}: LoginViewProps) {
  const t = translations[lang] || translations['ru'];

  const [usernameInput, setUsernameInput] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [needsBotStart, setNeedsBotStart] = useState(false);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [codeSentConfirmed, setCodeSentConfirmed] = useState(false);

  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);

  const pollRef = useRef<number | null>(null);
  const cooldownRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialError) {
      setErrorMsg(initialError);
    }
  }, [initialError]);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const stopCooldown = () => {
    if (cooldownRef.current !== null) {
      window.clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
      stopCooldown();
    };
  }, []);

  const startResendCooldown = () => {
    stopCooldown();
    setResendCooldown(25);
    cooldownRef.current = window.setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          stopCooldown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startWaitingForBotStart = (token: string) => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await pollTelegramOtpStatus(token);
        if (res.status === 'code_sent') {
          stopPolling();
          setCodeSentConfirmed(true);
          setNeedsBotStart(false);
        } else if (res.status === 'expired') {
          stopPolling();
        }
      } catch {
        // Ignore transient network errors while polling
      }
    }, 1500);
  };

  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = usernameInput.trim();
    if (!clean) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await requestTelegramCode(clean);
      setChallengeToken(res.challengeToken);
      setOtpCode('');
      setNeedsBotStart(res.needsBotStart);
      setBotUrl(res.botUrl || null);
      setCodeSentConfirmed(!res.needsBotStart);
      startResendCooldown();

      if (res.needsBotStart) {
        startWaitingForBotStart(res.challengeToken);
      } else {
        stopPolling();
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          (lang === 'ru'
            ? 'Доступ запрещён.'
            : lang === 'uz'
              ? 'Kirish taqiqlangan.'
              : 'Access denied.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitOtpCode = async (codeValue: string) => {
    if (!challengeToken || codeValue.length !== 4 || isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await verifyTelegramCode(challengeToken, codeValue);
      stopPolling();
      stopCooldown();
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          (lang === 'ru'
            ? 'Неверный код.'
            : lang === 'uz'
              ? 'Noto‘g‘ri kod.'
              : 'Invalid code.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeInputChange = (val: string) => {
    const digitsOnly = val.replace(/\D+/g, '').slice(0, 4);
    setOtpCode(digitsOnly);
    if (digitsOnly.length === 4) {
      submitOtpCode(digitsOnly);
    }
  };

  const handleResetToUsername = () => {
    stopPolling();
    setChallengeToken(null);
    setNeedsBotStart(false);
    setBotUrl(null);
    setCodeSentConfirmed(false);
    setOtpCode('');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-neutral-50 px-4 py-12 antialiased font-sans relative">
      {/* Floating Language Bar */}
      <div className="absolute top-6 right-6 flex items-center gap-2 bg-white border border-neutral-200/80 p-1 rounded-xl shadow-2xs">
        <div className="flex items-center gap-1.5 px-2 text-neutral-400 font-bold text-[10px] uppercase tracking-wider">
          <Globe className="w-3.5 h-3.5" />
        </div>
        <div className="flex gap-0.5">
          {(['ru', 'uz', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition cursor-pointer ${
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
            Tezi.uz
          </h1>
          <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest leading-none">
            Special TezPay ecosystem management system
          </p>
        </div>

        {/* Central Sign-In Card */}
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-7 sm:p-8 shadow-sm space-y-5 text-left">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-black tracking-tight">
              {t.loginTitle}
            </h2>
            <p className="text-xs text-neutral-500 font-medium leading-relaxed">
              {lang === 'ru'
                ? 'Введите ваш логин для входа в систему.'
                : lang === 'uz'
                  ? 'Tizimga kirish uchun loginingizni kiriting.'
                  : 'Enter your login to sign in.'}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-bold flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Enter login */}
          {!challengeToken ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                  {lang === 'ru' ? 'Логин' : lang === 'uz' ? 'Login' : 'Login'}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4.5 h-4.5 text-neutral-400" />
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder={lang === 'ru' ? 'Введите логин...' : lang === 'uz' ? 'Loginni kiriting...' : 'Enter login...'}
                    className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-black focus:outline-hidden transition duration-150"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-extrabold text-xs py-3 rounded-xl transition duration-150 shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>
                  {isSubmitting
                    ? (lang === 'ru' ? 'Проверка...' : lang === 'uz' ? 'Tekshirilmoqda...' : 'Checking...')
                    : (lang === 'ru' ? 'Получить код' : lang === 'uz' ? 'Kodni olish' : 'Get code')}
                </span>
              </button>
            </form>
          ) : (
            /* STEP 2: Enter verification code */
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleResetToUsername}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 hover:text-black cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ru' ? 'Изменить логин' : lang === 'uz' ? 'Loginni o‘zgartirish' : 'Change login'}
                </span>
              </button>

              {needsBotStart && botUrl && (
                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3">
                  <p className="text-xs font-bold text-neutral-800 leading-relaxed">
                    {lang === 'ru'
                      ? 'Первая активация доступа: перейдите по кнопке ниже и подтвердите запуск, чтобы получить код.'
                      : lang === 'uz'
                        ? 'Birinchi kirishni faollashtirish: kod olish uchun quyidagi tugma orqali tasdiqlang.'
                        : 'First-time activation: open the link below and confirm to receive your code.'}
                  </p>
                  <a
                    href={botUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-black hover:bg-neutral-800 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>
                      {lang === 'ru' ? 'Получить код подтверждения' : lang === 'uz' ? 'Tasdiqlash kodini olish' : 'Activate & get code'}
                    </span>
                  </a>
                </div>
              )}

              {codeSentConfirmed && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === 'ru'
                      ? 'Одноразовый код отправлен.'
                      : lang === 'uz'
                        ? 'Bir martalik kod yuborildi.'
                        : 'One-time code sent.'}
                  </span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitOtpCode(otpCode);
                }}
                className="space-y-3"
              >
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    {lang === 'ru' ? 'Код подтверждения' : lang === 'uz' ? 'Tasdiqlash kodi' : 'Verification code'}
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3.5 w-4.5 h-4.5 text-neutral-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={4}
                      value={otpCode}
                      onChange={(e) => handleCodeInputChange(e.target.value)}
                      placeholder="••••"
                      className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl pl-10 pr-4 py-3 text-lg font-mono font-black tracking-[0.5em] text-black focus:outline-hidden transition"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otpCode.length < 4}
                  className="w-full bg-black hover:bg-neutral-800 disabled:bg-neutral-400 disabled:cursor-not-allowed text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  <span>{t.loginBtn}</span>
                </button>
              </form>

              <div className="text-center pt-1">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || isSubmitting}
                  onClick={() => handleRequestCode()}
                  className="text-[11px] font-bold text-neutral-500 hover:text-black disabled:text-neutral-300 underline cursor-pointer disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0
                    ? (lang === 'ru' ? `Отправить повторно через ${resendCooldown} сек` : `Qayta yuborish: ${resendCooldown} s`)
                    : (lang === 'ru' ? 'Отправить код повторно' : 'Kodni qayta yuborish')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
