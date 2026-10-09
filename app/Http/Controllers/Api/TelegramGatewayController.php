<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\Integration;
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
        @exec($cmd);

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
     * Get gateway status (is running, is authorized, connected user)
     */
    public function getStatus(): JsonResponse
    {
        $url = $this->getGatewayUrl() . '/status';
        try {
            $response = Http::timeout(2)->get($url);
            if ($response->successful()) {
                $data = $response->json();
                return response()->json([
                    'isRunning' => true,
                    'isAuthorized' => (bool) ($data['isAuthorized'] ?? false),
                    'user' => $data['user'] ?? null,
                    'qr' => $data['qr'] ?? null,
                    'qrLoginActive' => (bool) ($data['qrLoginActive'] ?? false),
                ]);
            }
        } catch (\Throwable $e) {
            // Gateway is down; attempt automatic recovery
            if ($this->ensureGatewayRunning()) {
                try {
                    $response = Http::timeout(2)->get($url);
                    if ($response->successful()) {
                        $data = $response->json();
                        return response()->json([
                            'isRunning' => true,
                            'isAuthorized' => (bool) ($data['isAuthorized'] ?? false),
                            'user' => $data['user'] ?? null,
                            'qr' => $data['qr'] ?? null,
                            'qrLoginActive' => (bool) ($data['qrLoginActive'] ?? false),
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
        ]);
    }

    /**
     * Request QR code for login
     */
    public function startQr(): JsonResponse
    {
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
     * Log out from personal Telegram session
     */
    public function logout(): JsonResponse
    {
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

        $target = $integration->telegram_username ?: $integration->telegram_chat_id;
        if (!$target) {
            return response()->json([
                'error' => 'У блогера не указан ни Telegram Username (@ник), ни Chat ID. Укажите логин блогера в карточке.'
            ], 422);
        }

        // Save local message record
        $chatMessage = ChatMessage::create([
            'integration_id' => $integration->id,
            'sender_type' => 'manager',
            'sender_name' => $senderName,
            'text' => $text,
            'status' => 'pending',
        ]);

        // Send via Gateway
        $url = $this->getGatewayUrl() . '/send';
        try {
            $response = Http::timeout(10)->post($url, [
                'to' => $target,
                'text' => $text,
                'integrationId' => (string) $integration->id,
            ]);

            if ($response->successful()) {
                $resData = $response->json();
                $chatMessage->update([
                    'status' => 'delivered',
                    'telegram_message_id' => $resData['messageId'] ?? null,
                ]);

                // Store numeric peerId to ensure bidirectional matching for all future messages
                if (!empty($resData['peerId']) && empty($integration->telegram_chat_id)) {
                    $integration->telegram_chat_id = (string) $resData['peerId'];
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
                        'createdAt' => $chatMessage->created_at->toISOString(),
                    ],
                ]);
            } else {
                $chatMessage->update(['status' => 'failed']);
                $errorData = $response->json();
                return response()->json([
                    'error' => $errorData['error'] ?? 'Ошибка отправки через Telegram Gateway',
                    'message' => $chatMessage,
                ], 500);
            }
        } catch (\Throwable $e) {
            $chatMessage->update(['status' => 'failed']);
            return response()->json([
                'error' => 'Не удалось связаться с Telegram Gateway: ' . $e->getMessage(),
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

                $createdAt = !empty($data['date']) 
                    ? \Illuminate\Support\Carbon::createFromTimestamp($data['date']) 
                    : now();

                ChatMessage::create([
                    'integration_id' => $integration->id,
                    'sender_type' => $isOutgoing ? 'manager' : 'blogger',
                    'sender_name' => $isOutgoing ? 'Я (Telegram)' : ($senderFirstName ?: 'Блогер'),
                    'text' => $text,
                    'telegram_message_id' => $messageId,
                    'status' => 'delivered',
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
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
        $this->processMessageUpdate($data);
        return response()->json(['ok' => true]);
    }
}
