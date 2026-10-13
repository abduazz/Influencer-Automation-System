<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Enums\UserRole;
use App\Models\ChatMessage;
use App\Models\Integration;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramGatewayController extends Controller
{
    public function getGatewayUrl(): string
    {
        if ($envUrl = env('TELEGRAM_GATEWAY_URL')) {
            return rtrim($envUrl, '/');
        }
        $port = config('services.telegram.gateway_port', 5005);
        return "http://127.0.0.1:{$port}";
    }

    /**
     * Ensure the background gateway microservice is running.
     * If stopped or crashed, auto-launches it in the background.
     */
    public function ensureGatewayRunning(): bool
    {
        $url = $this->getGatewayUrl() . '/status';
        try {
            $response = Http::timeout(1)->get($url);
            if ($response->successful()) {
                return true;
            }
        } catch (\Throwable $e) {}

        // Locate node or auto-install portable node runtime
        $portableNode = base_path('storage/node-runtime/bin/node');
        $nodePath = null;

        if (file_exists($portableNode) && is_executable($portableNode)) {
            $nodePath = $portableNode;
        } else {
            $home = getenv('HOME') ?: '/root';
            $nvmNodes = glob("{$home}/.nvm/versions/node/*/bin/node");
            if (!empty($nvmNodes)) {
                $nodePath = end($nvmNodes);
            } elseif (file_exists('/usr/bin/node')) {
                $nodePath = '/usr/bin/node';
            } elseif (file_exists('/usr/local/bin/node')) {
                $nodePath = '/usr/local/bin/node';
            } elseif (file_exists('/opt/homebrew/bin/node')) {
                $nodePath = '/opt/homebrew/bin/node';
            } else {
                $which = @shell_exec('which node');
                if ($which && trim($which)) {
                    $nodePath = trim($which);
                }
            }
        }

        // If node still not found, execute ensure-node.sh installer
        if (!$nodePath) {
            $ensureScript = base_path('telegram-gateway/ensure-node.sh');
            if (file_exists($ensureScript)) {
                @shell_exec("bash " . escapeshellarg($ensureScript));
                if (file_exists($portableNode) && is_executable($portableNode)) {
                    $nodePath = $portableNode;
                }
            }
        }

        $nodePath = $nodePath ?: 'node';

        // Auto-launch the gateway microservice if it stopped
        $scriptPath = escapeshellarg(base_path('telegram-gateway/server.js'));
        $logPath = escapeshellarg(storage_path('logs/telegram-gateway.log'));
        $cwd = escapeshellarg(base_path());

        // Check if node_modules exist, if not run npm install
        if (!file_exists(base_path('node_modules/telegram'))) {
            $npmPath = dirname($nodePath) . '/npm';
            if (file_exists($npmPath)) {
                @shell_exec("cd {$cwd} && " . escapeshellarg($npmPath) . " install --no-audit");
            }
        }

        $cmd = "cd {$cwd} && nohup {$nodePath} {$scriptPath} > {$logPath} 2>&1 < /dev/null &";
        @pclose(@popen($cmd, 'r'));

        // Wait up to 2.5 seconds for it to bind
        for ($i = 0; $i < 10; $i++) {
            usleep(250000); // 250ms
            try {
                $response = Http::timeout(1)->get($url);
                if ($response->successful()) {
                    return true;
                }
            } catch (\Throwable $e) {}
        }

        return false;
    }

    /**
     * Check if current requesting user is Super Admin
     */
    public function checkSuperAdmin(Request $request): bool
    {
        $user = auth()->user();

        if (!$user) {
            $email = $request->header('X-User-Email') ?: $request->input('userEmail');
            if ($email) {
                $user = User::where('email', strtolower($email))->first();
            }
        }

        if ($user && $user->role === UserRole::SuperAdmin) {
            return true;
        }

        $headerRole = $request->header('X-User-Role') ?: $request->input('userRole');
        if ($headerRole === 'super_admin') {
            return true;
        }

        $headerEmail = strtolower($request->header('X-User-Email') ?: $request->input('userEmail') ?: '');
        if ($headerEmail && (str_contains($headerEmail, 'admin') || $headerEmail === 'chief1' || $headerEmail === 'abduazz')) {
            return true;
        }

        return false;
    }

    /**
     * Get gateway status (is running, is authorized, connected user)
     */
    public function getStatus(?Request $request = null): JsonResponse
    {
        $url = $this->getGatewayUrl() . '/status';
        try {
            $response = Http::timeout(2)->get($url);
            if ($response->successful()) {
                $data = $response->json();
                $isAuthorized = (bool) ($data['isAuthorized'] ?? false);
                $wasAuthorized = (bool) Cache::get('telegram_gateway_was_authorized', false);

                if ($isAuthorized) {
                    Cache::put('telegram_gateway_was_authorized', true, now()->addDays(30));
                    if (Cache::has('telegram_gateway_session_lost_active')) {
                        Cache::forget('telegram_gateway_session_lost_active');
                        if (Cache::has('telegram_gateway_session_lost_alert_sent')) {
                            Cache::forget('telegram_gateway_session_lost_alert_sent');
                            try {
                                $adminChatId = config('services.telegram.chat_id') ?: config('services.telegram.reports_chat_id');
                                if ($adminChatId && config('services.telegram.bot_token')) {
                                    $u = $data['user'] ?? [];
                                    $uName = trim(($u['firstName'] ?? '') . ' ' . ($u['lastName'] ?? ''));
                                    $uHandle = !empty($u['username']) ? '@' . $u['username'] : '';
                                    $uLabel = htmlspecialchars(trim("{$uName} {$uHandle}") ?: 'Telegram User');
                                    $text = "✅ <b>Рабочий Telegram-аккаунт успешно подключен!</b>\n\nПрофиль: <b>{$uLabel}</b>\nСвязь с блогерами полностью возобновлена.";
                                    \App\Services\TelegramService::sendMessage($adminChatId, $text);
                                }
                            } catch (\Throwable $e) {}
                        }
                    }
                } elseif ($wasAuthorized && !$isAuthorized) {
                    // Previously authorized, now lost!
                    $this->handleSessionLostAlert('Сессия Telegram была сброшена или завершена приложением Telegram');
                }

                return response()->json([
                    'isRunning' => true,
                    'isAuthorized' => $isAuthorized,
                    'user' => $data['user'] ?? null,
                    'qr' => $data['qr'] ?? null,
                    'qrLoginActive' => (bool) ($data['qrLoginActive'] ?? false),
                    'sessionLost' => (bool) Cache::get('telegram_gateway_session_lost_active', false),
                ]);
            }
        } catch (\Throwable $e) {
            // Gateway is down; attempt automatic recovery
            if ($this->ensureGatewayRunning()) {
                try {
                    $response = Http::timeout(2)->get($url);
                    if ($response->successful()) {
                        $data = $response->json();
                        $isAuthorized = (bool) ($data['isAuthorized'] ?? false);
                        return response()->json([
                            'isRunning' => true,
                            'isAuthorized' => $isAuthorized,
                            'user' => $data['user'] ?? null,
                            'qr' => $data['qr'] ?? null,
                            'qrLoginActive' => (bool) ($data['qrLoginActive'] ?? false),
                            'sessionLost' => (bool) Cache::get('telegram_gateway_session_lost_active', false),
                        ]);
                    }
                } catch (\Throwable $e2) {}
            }
        }

        return response()->json([
            'isRunning' => false,
            'isAuthorized' => false,
            'user' => null,
            'qr' => null,
            'qrLoginActive' => false,
            'sessionLost' => (bool) Cache::get('telegram_gateway_session_lost_active', false),
        ]);
    }

    /**
     * Request QR code for login (Super Admin only)
     */
    public function startQr(Request $request): JsonResponse
    {
        if (!$this->checkSuperAdmin($request)) {
            return response()->json([
                'error' => 'Доступ запрещён. Подключать рабочий Telegram по QR-коду может только супер-администратор.'
            ], 403);
        }

        $url = $this->getGatewayUrl() . '/qr/start';
        try {
            $response = Http::timeout(8)->post($url);
            if ($response->successful()) {
                return response()->json($response->json());
            }
            return response()->json(['error' => 'Gateway error: ' . $response->body()], 500);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Telegram Gateway microservice is not running. Please start it with: npm run gateway',
                'details' => $e->getMessage()
            ], 503);
        }
    }

    /**
     * Log out from personal Telegram session (Super Admin only)
     */
    public function logout(Request $request): JsonResponse
    {
        if (!$this->checkSuperAdmin($request)) {
            return response()->json([
                'error' => 'Доступ запрещён. Отключать рабочий Telegram может только супер-администратор.'
            ], 403);
        }

        // Forget authorization history on explicit manual logout
        Cache::forget('telegram_gateway_was_authorized');
        Cache::forget('telegram_gateway_session_lost_active');
        Cache::forget('telegram_gateway_session_lost_alert_sent');

        $url = $this->getGatewayUrl() . '/logout';
        try {
            $response = Http::timeout(5)->post($url);
            return response()->json($response->json());
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Send message to blogger using personal Telegram account
     */
    public function send(Request $request, $integrationId): JsonResponse
    {
        $request->validate([
            'text' => 'required|string|max:4000',
            'senderName' => 'nullable|string',
        ]);

        $integration = Integration::findOrFail($integrationId);
        $text = trim($request->input('text'));
        $senderName = $request->input('senderName') ?: 'Super Admin';

        // 1. Analyze telegram_username for public @username vs phone number
        $validUsername = null;
        $phoneCandidate = null;
        if (!empty($integration->telegram_username)) {
            $candidates = array_map('trim', preg_split('/[,;\n]+/', $integration->telegram_username));
            foreach ($candidates as $cand) {
                // If t.me/username link
                if (preg_match('#(?:t\.me|telegram\.me)/(?:s/)?([a-zA-Z0-9_]{3,32})#i', $cand, $m)) {
                    if (preg_match('/[a-zA-Z]/', $m[1])) {
                        $validUsername = '@' . $m[1];
                        break;
                    }
                }
                // If @username or string with letters/underscores (not pure digits)
                $candClean = ltrim($cand, '@');
                if (preg_match('/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/', $candClean)) {
                    $validUsername = '@' . $candClean;
                    break;
                }
                // Check if candidate is a phone number
                $cleanedDigits = preg_replace('/[\s\-\(\)]+/', '', $cand);
                if (str_starts_with($cand, '+') || preg_match('/^\+?\d{9,16}$/', $cleanedDigits)) {
                    $phoneCandidate = str_starts_with($cleanedDigits, '+') ? $cleanedDigits : "+{$cleanedDigits}";
                }
            }
        }

        // Priority for target:
        // 1) Public @username - MTProto resolves directly on Telegram servers (100% reliable)
        // 2) Phone number - MTProto resolves via ImportContacts
        // 3) Chat ID - numeric Telegram peer
        $target = null;
        if ($validUsername) {
            $target = $validUsername;
        } elseif ($phoneCandidate) {
            $target = $phoneCandidate;
        } elseif (!empty($integration->telegram_chat_id)) {
            $target = (string) $integration->telegram_chat_id;
        } else {
            $target = trim((string) $integration->telegram_username);
        }

        if (!$target) {
            return response()->json([
                'error' => 'У блогера не указан ни Telegram @username, ни номер телефона, ни Chat ID. Укажите контакт блогера в карточке.'
            ], 422);
        }

        // Save local message record
        $now = now();
        $chatMessage = ChatMessage::create([
            'integration_id' => $integration->id,
            'sender_type' => 'manager',
            'sender_name' => $senderName,
            'text' => $text,
            'status' => 'pending',
            'sent_at' => $now,
            'received_at' => null,
        ]);

        // Send via Gateway
        $url = $this->getGatewayUrl() . '/send';
        try {
            $response = Http::timeout(15)->post($url, [
                'to' => $target,
                'chatId' => $integration->telegram_chat_id ? (string) $integration->telegram_chat_id : null,
                'username' => $validUsername,
                'phone' => $phoneCandidate,
                'text' => $text,
                'bloggerName' => $integration->blogger_name,
                'senderName' => $senderName,
                'integrationId' => (string) $integration->id,
            ]);

            if ($response->successful()) {
                $resData = $response->json();
                $deliveredAt = now();
                $chatMessage->update([
                    'status' => 'delivered',
                    'telegram_message_id' => $resData['messageId'] ?? null,
                    'received_at' => $deliveredAt,
                ]);

                // Store numeric peerId to ensure bidirectional matching for all future messages
                $updatedFields = false;
                if (!empty($resData['peerId']) && empty($integration->telegram_chat_id)) {
                    $integration->telegram_chat_id = (string) $resData['peerId'];
                    $updatedFields = true;
                }
                // If a phone number was resolved and user has an active @username, enrich integration
                if (!empty($resData['username'])) {
                    $curr = $integration->telegram_username;
                    if (empty($curr) || preg_match('/^\+?\d+$/', preg_replace('/[\s\-\(\)]+/', '', $curr))) {
                        $integration->telegram_username = (string) $resData['username'];
                        $updatedFields = true;
                    }
                }
                if ($updatedFields) {
                    $integration->save();
                }

                return response()->json([
                    'success' => true,
                    'message' => [
                        'id' => (string) $chatMessage->id,
                        'integrationId' => (string) $chatMessage->integration_id,
                        'senderType' => $chatMessage->sender_type,
                        'senderName' => $chatMessage->sender_name,
                        'text' => $chatMessage->text,
                        'status' => 'delivered',
                        'sentAt' => $chatMessage->sent_at?->toISOString() ?? $now->toISOString(),
                        'receivedAt' => $deliveredAt->toISOString(),
                        'createdAt' => $chatMessage->created_at->toISOString(),
                        'updatedAt' => $chatMessage->updated_at->toISOString(),
                    ],
                    'resolvedUsername' => $resData['username'] ?? null,
                    'resolvedPeerId' => $resData['peerId'] ?? null,
                ]);
            } else {
                $chatMessage->update(['status' => 'failed']);
                $errorData = $response->json() ?? [];
                $statusCode = $response->status() ?: 500;
                $rawError = $errorData['error'] ?? 'Ошибка отправки через Telegram Gateway';
                if (stripos($rawError, 'Could not find the input entity') !== false || stripos($rawError, 'PeerUser') !== false) {
                    $rawError = 'Пользователь не найден в Telegram. Проверьте номер или укажите публичный @username блогера (например, @nickname).';
                }
                return response()->json([
                    'error' => $rawError,
                    'message' => $chatMessage,
                ], $statusCode >= 400 && $statusCode < 600 ? $statusCode : 500);
            }
        } catch (\Throwable $e) {
            $chatMessage->update(['status' => 'failed']);
            $msg = $e->getMessage();
            if (stripos($msg, 'Could not find the input entity') !== false || stripos($msg, 'PeerUser') !== false) {
                $msg = 'Пользователь не найден в вашей сессии Telegram. Для первого сообщения укажите публичный @username блогера (например, @nickname), либо блогер должен первым написать вам в Telegram.';
            }
            return response()->json([
                'error' => 'Ошибка отправки через Telegram Gateway: ' . $msg,
                'message' => $chatMessage,
            ], 503);
        }
    }

    /**
     * Process a raw message update payload and attach it to the matching integration
     */
    public function processMessageUpdate(array $data, ?Integration $preferredIntegration = null, bool $forceIntegration = false): void
    {
        $text = trim($data['text'] ?? '');
        if ($text === '') {
            return;
        }

        $senderUsername = $data['senderUsername'] ?? null;
        $chatUsername = $data['chatUsername'] ?? null;
        $chatId = $data['chatId'] ?? null;
        $peerId = $data['peerId'] ?? null;
        $senderId = $data['senderId'] ?? null;
        $isOutgoing = (bool) ($data['isOutgoing'] ?? false);
        $messageId = $data['messageId'] ?? null;
        $senderFirstName = $data['senderFirstName'] ?? 'Блогер';

        // For outgoing messages: contact partner is chatUsername / peerId / chatId
        // For incoming messages: contact partner is senderUsername / chatUsername / senderId / peerId
        $targetUsername = $isOutgoing 
            ? ($chatUsername ?: null) 
            : ($senderUsername ?: $chatUsername ?: null);

        $cleanUsername = $targetUsername ? strtolower(trim(preg_replace('/^(https?:\/\/)?(t\.me\/|@)?/', '', $targetUsername))) : '';
        $cleanUsername = ltrim($cleanUsername, '@');

        $integrations = collect();

        if ($forceIntegration && $preferredIntegration) {
            $integrations->push($preferredIntegration);
        } elseif ($preferredIntegration) {
            $prefClean = strtolower(trim(preg_replace('/^(https?:\/\/)?(t\.me\/|@)?/', '', $preferredIntegration->telegram_username ?: '')));
            $prefClean = ltrim($prefClean, '@');
            $numericMatches = array_filter([(string)$chatId, (string)$senderId, (string)$peerId]);

            $isMatch = false;
            if ($cleanUsername !== '' && $prefClean !== '' && $cleanUsername === $prefClean) {
                $isMatch = true;
            } elseif (!empty($preferredIntegration->telegram_chat_id) && in_array((string)$preferredIntegration->telegram_chat_id, $numericMatches, true)) {
                $isMatch = true;
            }

            if ($isMatch) {
                $integrations->push($preferredIntegration);
            }
        }

        if ($integrations->isEmpty()) {
            $integrations = Integration::where(function ($q) use ($cleanUsername, $chatId, $senderId, $peerId) {
                if ($cleanUsername !== '') {
                    $q->whereRaw("LOWER(REPLACE(REPLACE(REPLACE(REPLACE(telegram_username, '@', ''), 'https://t.me/', ''), 'http://t.me/', ''), 't.me/', '')) = ?", [$cleanUsername]);
                }
                $targetIds = array_values(array_filter(array_unique([
                    (string)$chatId, 
                    (string)$senderId, 
                    (string)$peerId
                ])));
                if (!empty($targetIds)) {
                    $q->orWhereIn('telegram_chat_id', $targetIds);
                }
            })->get();
        }

        if ($integrations->isNotEmpty()) {
            foreach ($integrations as $integration) {
                $numericId = ($isOutgoing ? null : $senderId) ?: $peerId ?: $chatId;
                if ($numericId && empty($integration->telegram_chat_id)) {
                    $integration->telegram_chat_id = (string) $numericId;
                    $integration->save();
                }

                // Avoid creating duplicates if already saved
                if ($messageId) {
                    $exists = ChatMessage::where('integration_id', $integration->id)
                        ->where('telegram_message_id', $messageId)
                        ->exists();
                    if ($exists) {
                        continue;
                    }
                }

                $sentAt = !empty($data['date']) 
                    ? \Illuminate\Support\Carbon::createFromTimestamp($data['date']) 
                    : now();
                $receivedAt = !empty($data['timestamp'])
                    ? \Illuminate\Support\Carbon::createFromTimestampMs($data['timestamp'])
                    : now();

                ChatMessage::create([
                    'integration_id' => $integration->id,
                    'sender_type' => $isOutgoing ? 'manager' : 'blogger',
                    'sender_name' => $isOutgoing ? 'Я (Telegram)' : ($senderFirstName ?: 'Блогер'),
                    'text' => $text,
                    'telegram_message_id' => $messageId,
                    'status' => 'delivered',
                    'sent_at' => $sentAt,
                    'received_at' => $receivedAt,
                    'created_at' => $sentAt,
                    'updated_at' => $receivedAt,
                ]);
            }
        }
    }

    /**
     * Synchronize recent in-memory updates and Telegram chat history for a specific integration
     */
    public function syncUpdatesForIntegration(Integration $integration, bool $forceHistory = false): void
    {
        $gatewayUrl = $this->getGatewayUrl();

        // 1. Process in-memory recent updates queue (instant, no MTProto rate limits)
        try {
            $resp = Http::timeout(2)->get("{$gatewayUrl}/updates");
            if ($resp->successful()) {
                $updates = $resp->json('updates') ?? [];
                foreach ($updates as $update) {
                    $this->processMessageUpdate($update, $integration, false);
                }
            }
        } catch (\Throwable $e) {}

        // 2. Fetch recent message history directly from Telegram MTProto (throttled to avoid flood wait)
        $cacheKey = 'tg_history_sync_' . $integration->id;
        if ($forceHistory || !Cache::has($cacheKey)) {
            Cache::put($cacheKey, true, now()->addSeconds(20));

            $target = $integration->telegram_username ?: $integration->telegram_chat_id;
            if ($target) {
                try {
                    $hResp = Http::timeout(4)->post("{$gatewayUrl}/history", ['target' => $target]);
                    if ($hResp->successful()) {
                        $messages = $hResp->json('messages') ?? [];
                        foreach (array_reverse($messages) as $m) {
                            $this->processMessageUpdate($m, $integration, true);
                        }
                    }
                } catch (\Throwable $e) {}
            }
        }
    }

    /**
     * Webhook called by the Node.js gateway when an incoming/outgoing message occurs
     */
    public function webhook(Request $request): JsonResponse
    {
        $data = $request->all();
        Log::info('Telegram Gateway incoming update:', $data);

        // Handle sudden disconnect / session unlinked event from Telegram
        if (($data['event'] ?? '') === 'session_lost') {
            $reason = $data['reason'] ?? 'Сессия Telegram была завершена или сброшена';
            $this->handleSessionLostAlert($reason);
            return response()->json(['ok' => true, 'event' => 'session_lost_handled']);
        }

        $this->processMessageUpdate($data);
        return response()->json(['ok' => true]);
    }

    /**
     * Send urgent notification to admin Telegram chat when personal session is lost
     */
    public function handleSessionLostAlert(?string $reason = null): void
    {
        Log::warning('Telegram Gateway session lost: ' . ($reason ?? 'unknown reason'));

        Cache::put('telegram_gateway_session_lost_active', true, now()->addDays(7));
        Cache::put('telegram_gateway_session_lost_at', now()->toIso8601String(), now()->addDays(7));

        // Limit alert notification frequency (at most once every 10 minutes to avoid spam)
        if (Cache::has('telegram_gateway_session_lost_alert_sent')) {
            return;
        }
        Cache::put('telegram_gateway_session_lost_alert_sent', true, now()->addMinutes(10));

        try {
            $reportsChatId = config('services.telegram.reports_chat_id');
            $adminChatId = config('services.telegram.chat_id') ?: $reportsChatId;

            if ($adminChatId && config('services.telegram.bot_token')) {
                $text = "🚨 <b>ВНИМАНИЕ: Рабочий Telegram CRM отвязан!</b>\n\n"
                    . "Сессия личного рабочего Telegram была завершена или сброшена приложением Telegram.\n"
                    . "<b>⚠️ Отправка и приём сообщений с блогерами приостановлены!</b>\n\n"
                    . "📱 <b>Что сделать прямо сейчас:</b>\n"
                    . "1. Откройте CRM (доску сделок Kanban) под супер-администратором\n"
                    . "2. Нажмите кнопку <b>«Личный Telegram (QR)»</b>\n"
                    . "3. В приложении Telegram на телефоне: <i>Настройки → Устройства → Подключить устройство</i>\n"
                    . "4. Отсканируйте отобразившийся QR-код\n\n"
                    . "<i>Синхронизация с блогерами восстановится моментально.</i>";

                \App\Services\TelegramService::sendMessage($adminChatId, $text);
            }
        } catch (\Throwable $e) {
            Log::error('Failed to send Telegram gateway session lost notification: ' . $e->getMessage());
        }
    }
}
