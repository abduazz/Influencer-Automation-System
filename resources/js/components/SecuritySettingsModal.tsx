import { useEffect, useState } from 'react';
import { AllowedUser } from '../data/mockData';
import { Language } from '../translations';
import {
  fetchUserSessions,
  revokeUserSession,
  UserSessionItem,
} from '../services/api';
import {
  X,
  ShieldCheck,
  Monitor,
  Trash2,
  Loader2,
  LogOut,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AllowedUser;
  lang: Language;
}

export default function SecuritySettingsModal({
  isOpen,
  onClose,
  user,
  lang,
}: SecuritySettingsModalProps) {
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const sessList = await fetchUserSessions();
      setSessions(sessList);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to load sessions' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStatusMsg(null);
      loadSessions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRevokeSession = async (id: string) => {
    try {
      await revokeUserSession(id);
      if (id === 'others') {
        setSessions((prev) => prev.filter((s) => s.isCurrent));
        setStatusMsg({
          type: 'success',
          text: lang === 'ru' ? 'Все остальные устройства отключены.' : 'All other sessions signed out.',
        });
      } else {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to revoke session' });
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(lang === 'uz' ? 'uz-UZ' : lang === 'en' ? 'en-US' : 'ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 text-left shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-black text-white flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-black">
                {lang === 'ru' ? 'Активные устройства и сеансы' : lang === 'uz' ? 'Faol qurilmalar va seanslar' : 'Active Devices & Sessions'}
              </h3>
              <p className="text-[11px] font-medium text-neutral-400">
                {user.telegramUsername || user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-black p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="space-y-3 bg-neutral-50 border border-neutral-200/80 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-black" />
              <h4 className="text-xs font-black text-black uppercase tracking-wider">
                {lang === 'ru' ? 'Сеансы (до 1 года)' : 'Active sessions (up to 1 year)'}
              </h4>
            </div>
            {sessions.filter((s) => !s.isCurrent).length > 0 && (
              <button
                type="button"
                onClick={() => handleRevokeSession('others')}
                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-600 hover:text-red-800 cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                <span>{lang === 'ru' ? 'Выйти на других' : 'Sign out others'}</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-neutral-900 truncate">
                        {s.authMethod} · {s.ipAddress || 'IP —'}
                      </span>
                      {s.isCurrent && (
                        <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 rounded">
                          {lang === 'ru' ? 'Текущий' : 'Current'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-400 truncate">
                      {formatDate(s.lastUsedAt || s.createdAt)} · {s.userAgent || 'Browser'}
                    </p>
                  </div>
                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(s.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
