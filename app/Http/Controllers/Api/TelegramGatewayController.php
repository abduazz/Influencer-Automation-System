<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\Integration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramGatewayController extends Controller
{
    private function getGatewayUrl(): string
    {
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

        // Auto-launch the gateway microservice if it stopped
        $scriptPath = base_path('telegram-gateway/server.js');
        $logPath = storage_path('logs/telegram-gateway.log');
        $nodePath = file_exists('/usr/local/bin/node') ? '/usr/local/bin/node' : 'node';

        $cmd = "nohup {$nodePath} {$scriptPath} > {$logPath} 2>&1 &";
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
     * Webhook called by the Node.js gateway when an incoming/outgoing message occurs
     */
    public function webhook(Request $request): JsonResponse
    {
        $data = $request->all();
        Log::info('Telegram Gateway incoming update:', $data);

        $text = trim($data['text'] ?? '');
        if ($text === '') {
            return response()->json(['ok' => true]);
        }

        $senderUsername = $data['senderUsername'] ?? null;
        $chatUsername = $data['chatUsername'] ?? null;
        $chatId = $data['chatId'] ?? null;
        $isOutgoing = (bool) ($data['isOutgoing'] ?? false);
        $messageId = $data['messageId'] ?? null;
        $senderFirstName = $data['senderFirstName'] ?? 'Блогер';

        // Find all matching integrations (e.g. if one admin represents multiple bloggers)
        $integrations = collect();

        // 1. Try username match (sender or chat)
        $cleanUsername = strtolower(ltrim($senderUsername ?: $chatUsername ?: '', '@'));
        if ($cleanUsername !== '') {
            $integrations = Integration::whereRaw("LOWER(REPLACE(telegram_username, '@', '')) = ?", [$cleanUsername])->get();
        }

        // 2. Try chat ID match if username yielded nothing
        if ($integrations->isEmpty() && $chatId) {
            $integrations = Integration::where('telegram_chat_id', (string) $chatId)->get();
        }

        if ($integrations->isNotEmpty()) {
            foreach ($integrations as $integration) {
                // Update chat_id if not set
                if ($chatId && empty($integration->telegram_chat_id)) {
                    $integration->telegram_chat_id = (string) $chatId;
                    $integration->save();
                }

                ChatMessage::create([
                    'integration_id' => $integration->id,
                    'sender_type' => $isOutgoing ? 'manager' : 'blogger',
                    'sender_name' => $isOutgoing ? 'Я (Telegram)' : $senderFirstName,
                    'text' => $text,
                    'telegram_message_id' => $messageId,
                    'status' => 'delivered',
                ]);
            }
        }

        return response()->json(['ok' => true]);
    }
}
