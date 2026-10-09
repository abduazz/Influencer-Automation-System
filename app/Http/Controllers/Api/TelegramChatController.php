<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\Integration;
use App\Services\TelegramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TelegramChatController extends Controller
{
    /**
     * Get chat messages for a specific integration
     */
    public function getMessages(Request $request, $integrationId): JsonResponse
    {
        $integration = Integration::find($integrationId);
        if (!$integration) {
            return response()->json(['message' => 'Integration not found'], 404);
        }

        // Auto-sync pending updates and recent Telegram history
        try {
            $forceHistory = $request->boolean('force_sync');
            app(TelegramGatewayController::class)->syncUpdatesForIntegration($integration, $forceHistory);
        } catch (\Throwable $e) {
            Log::debug('Telegram Gateway auto-sync skipped: ' . $e->getMessage());
        }

        $query = ChatMessage::where('integration_id', $integration->id)->orderBy('created_at', 'asc');

        if ($request->has('since_id')) {
            $query->where('id', '>', (int) $request->query('since_id'));
        }

        $messages = $query->get()->map(function ($msg) {
            return [
                'id' => (string) $msg->id,
                'integrationId' => (string) $msg->integration_id,
                'senderType' => $msg->sender_type,
                'senderName' => $msg->sender_name,
                'text' => $msg->text,
                'telegramMessageId' => $msg->telegram_message_id,
                'mediaUrl' => $msg->media_url,
                'mediaType' => $msg->media_type,
                'status' => $msg->status,
                'createdAt' => $msg->created_at ? $msg->created_at->toISOString() : now()->toISOString(),
            ];
        });

        $botUsername = TelegramService::getBotUsername();
        $chatUrl = TelegramService::getBloggerChatUrl($integration->id, $integration->blogger_cabinet_token);

        // Find other bloggers represented by this same Telegram admin/contact
        $siblingBloggers = [];
        if (!empty($integration->telegram_username)) {
            $cleanUser = strtolower(ltrim($integration->telegram_username, '@'));
            $siblingBloggers = Integration::where('id', '!=', $integration->id)
                ->whereRaw("LOWER(REPLACE(telegram_username, '@', '')) = ?", [$cleanUser])
                ->get(['id', 'blogger_name', 'platform', 'kanban_stage'])
                ->map(fn($item) => [
                    'id' => (string) $item->id,
                    'bloggerName' => $item->blogger_name,
                    'platform' => $item->platform,
                    'kanbanStage' => $item->kanban_stage,
                ])->values()->all();
        } elseif (!empty($integration->telegram_chat_id)) {
            $siblingBloggers = Integration::where('id', '!=', $integration->id)
                ->where('telegram_chat_id', (string) $integration->telegram_chat_id)
                ->get(['id', 'blogger_name', 'platform', 'kanban_stage'])
                ->map(fn($item) => [
                    'id' => (string) $item->id,
                    'bloggerName' => $item->blogger_name,
                    'platform' => $item->platform,
                    'kanbanStage' => $item->kanban_stage,
                ])->values()->all();
        }

        return response()->json([
            'integration' => [
                'id' => (string) $integration->id,
                'bloggerName' => $integration->blogger_name,
                'telegramUsername' => $integration->telegram_username,
                'telegramChatId' => $integration->telegram_chat_id,
                'chatUrl' => $chatUrl,
            ],
            'botUsername' => $botUsername,
            'siblingBloggers' => $siblingBloggers,
            'messages' => $messages,
        ]);
    }

    /**
     * Redirect to blogger Telegram chat bot with deeplink
     */
    public function redirectToTelegram($integrationId)
    {
        $integration = Integration::findOrFail($integrationId);
        $url = TelegramService::getBloggerChatUrl($integration->id, $integration->blogger_cabinet_token);
        return redirect()->away($url);
    }

    /**
     * Send message from CRM manager to the blogger
     */
    public function sendMessage(Request $request, $integrationId): JsonResponse
    {
        $request->validate([
            'text' => 'required|string|max:4000',
            'senderName' => 'nullable|string|max:255',
        ]);

        $integration = Integration::find($integrationId);
        if (!$integration) {
            return response()->json(['message' => 'Integration not found'], 404);
        }

        $text = trim($request->input('text'));
        $senderName = $request->input('senderName') ?: 'Super Admin';

        // Check if personal MTProto Gateway is configured / session exists
        $hasPersonalSession = file_exists(storage_path('app/telegram_user_session.json'));
        $gatewayController = app(TelegramGatewayController::class);
        $gatewayStatus = $gatewayController->getStatus()->getData(true);

        if (empty($integration->telegram_username) && empty($integration->telegram_chat_id)) {
            return response()->json([
                'error' => 'У блогера не указан Telegram логин. Укажите @username блогера в карточке для отправки сообщения.',
            ], 422);
        }

        // Send exclusively via Personal MTProto Gateway
        $gatewayController = app(TelegramGatewayController::class);
        $gatewayStatus = $gatewayController->getStatus()->getData(true);

        if (empty($gatewayStatus['isRunning'])) {
            $gatewayController->ensureGatewayRunning();
            $gatewayStatus = $gatewayController->getStatus()->getData(true);
        }

        if (empty($gatewayStatus['isAuthorized'])) {
            return response()->json([
                'error' => 'Личный Telegram-шлюз не авторизован. Откройте «Личный Telegram шлюз» в шапке доски и отсканируйте QR-код для синхронизации со своим профилем.',
            ], 422);
        }

        $gatewayRes = $gatewayController->send($request, $integrationId);
        $gData = $gatewayRes->getData(true);

        if ($gatewayRes->getStatusCode() === 200) {
            return response()->json([
                'message' => $gData['message'],
                'delivered' => true,
                'hasChatId' => true,
                'sentViaGateway' => true,
            ]);
        }

        return response()->json([
            'error' => $gData['error'] ?? 'Не удалось отправить сообщение через Telegram',
            'details' => $gData['details'] ?? null,
        ], $gatewayRes->getStatusCode() ?: 500);
    }

    /**
     * Update chat settings (e.g. manually set telegram_username or telegram_chat_id)
     */
    public function updateChatSettings(Request $request, $integrationId): JsonResponse
    {
        $integration = Integration::find($integrationId);
        if (!$integration) {
            return response()->json(['message' => 'Integration not found'], 404);
        }

        $request->validate([
            'telegramChatId' => 'nullable|string|max:100',
            'telegramUsername' => 'nullable|string|max:100',
        ]);

        $updates = [];
        if ($request->has('telegramChatId') || array_key_exists('telegramChatId', $request->all())) {
            $updates['telegram_chat_id'] = $request->input('telegramChatId') ?: null;
        }
        if ($request->has('telegramUsername') || array_key_exists('telegramUsername', $request->all())) {
            $cleanUser = ltrim(trim($request->input('telegramUsername') ?? ''), '@');
            $updates['telegram_username'] = $cleanUser ?: null;
        }

        $integration->update($updates);

        return response()->json([
            'success' => true,
            'telegramChatId' => $integration->telegram_chat_id,
            'telegramUsername' => $integration->telegram_username,
        ]);
    }

    /**
     * Telegram Webhook endpoint
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        $update = $request->all();
        Log::info('Telegram Webhook incoming update:', ['update_id' => $update['update_id'] ?? null]);

        $message = $update['message'] ?? $update['channel_post'] ?? null;
        if (!$message) {
            return response()->json(['ok' => true]);
        }

        $chatId = $message['chat']['id'] ?? null;
        if (!$chatId) {
            return response()->json(['ok' => true]);
        }

        $from = $message['from'] ?? [];
        $text = trim($message['text'] ?? $message['caption'] ?? '');
        $messageId = $message['message_id'] ?? null;
        $username = $from['username'] ?? null;
        $firstName = $from['first_name'] ?? ($username ?: 'Блогер');

        // Check for media
        $mediaType = null;
        if (!empty($message['photo'])) {
            $mediaType = 'photo';
        } elseif (!empty($message['document'])) {
            $mediaType = 'document';
        } elseif (!empty($message['voice'])) {
            $mediaType = 'voice';
        } elseif (!empty($message['video'])) {
            $mediaType = 'video';
        }

        // Case 1: /start with payload (deeplink connection)
        if (preg_match('/^\/start(?:\s+(.+))?$/i', $text, $matches)) {
            $payload = trim($matches[1] ?? '');

            $integration = null;
            if ($payload) {
                if (preg_match('/^deal_(\d+)$/i', $payload, $m)) {
                    $integration = Integration::find((int) $m[1]);
                } elseif (preg_match('/^token_(.+)$/i', $payload, $m)) {
                    $integration = Integration::where('blogger_cabinet_token', $m[1])->first();
                } elseif (is_numeric($payload)) {
                    $integration = Integration::find((int) $payload);
                } else {
                    $integration = Integration::where('blogger_cabinet_token', $payload)->first();
                }
            }

            // Fallback: match by username if no payload
            if (!$integration && $username) {
                $cleanUser = strtolower(ltrim($username, '@'));
                $integration = Integration::whereRaw("LOWER(REPLACE(telegram_username, '@', '')) = ?", [$cleanUser])
                    ->orderBy('id', 'desc')
                    ->first();
            }

            if ($integration) {
                $integration->telegram_chat_id = (string) $chatId;
                if ($username && empty($integration->telegram_username)) {
                    $integration->telegram_username = '@' . $username;
                }
                $integration->save();

                // Save system message
                ChatMessage::create([
                    'integration_id' => $integration->id,
                    'sender_type' => 'system',
                    'sender_name' => 'Telegram Bot',
                    'text' => "Блогер {$firstName} (@{$username}) подключился к диалогу в Telegram (Chat ID: {$chatId})",
                    'status' => 'delivered',
                ]);

                // Send confirmation to the blogger
                $welcome = "Здравствуйте, <b>" . htmlspecialchars($integration->blogger_name, ENT_QUOTES, 'UTF-8') . "</b>! 👋\n\n"
                    . "Диалог с вашей рабочей группой и менеджером открыт.\n"
                    . "Вы можете писать сюда любые вопросы, материалы, ссылки и согласования по рекламным интеграциям.";
                TelegramService::sendMessage($chatId, $welcome);

                return response()->json(['ok' => true]);
            } else {
                TelegramService::sendMessage($chatId, "Здравствуйте, {$firstName}! 👋 Для привязки диалога к рекламной интеграции, пожалуйста, перейдите по персональной ссылке от вашего менеджера.");
                return response()->json(['ok' => true]);
            }
        }

        // Case 2: Regular message from blogger
        // Find integration by chat_id
        $integration = Integration::where('telegram_chat_id', (string) $chatId)
            ->orderBy('id', 'desc')
            ->first();

        // If not found, try matching by username
        if (!$integration && $username) {
            $cleanUser = strtolower(ltrim($username, '@'));
            $integration = Integration::whereRaw("LOWER(REPLACE(telegram_username, '@', '')) = ?", [$cleanUser])
                ->orderBy('id', 'desc')
                ->first();

            if ($integration) {
                $integration->telegram_chat_id = (string) $chatId;
                $integration->save();
            }
        }

        if ($integration) {
            $msgContent = $text;
            if (empty($msgContent)) {
                $msgContent = $mediaType ? "[Вложение: {$mediaType}]" : "—";
            }

            ChatMessage::create([
                'integration_id' => $integration->id,
                'sender_type' => 'blogger',
                'sender_name' => $firstName,
                'text' => $msgContent,
                'telegram_message_id' => $messageId,
                'media_type' => $mediaType,
                'status' => 'delivered',
            ]);
        } else {
            TelegramService::sendMessage($chatId, "Здравствуйте! Чтобы связать переписку с вашей карточкой блогера, откройте персональную ссылку от менеджера.");
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Get webhook setup status
     */
    public function getWebhookStatus(): JsonResponse
    {
        $info = TelegramService::getWebhookInfo();
        $botUsername = TelegramService::getBotUsername();
        return response()->json([
            'info' => $info,
            'botUsername' => $botUsername,
            'expectedUrl' => url('/api/telegram/webhook'),
        ]);
    }

    /**
     * Setup webhook in Telegram
     */
    public function setupWebhook(Request $request): JsonResponse
    {
        $webhookUrl = $request->input('url') ?: (config('app.url') . '/api/telegram/webhook');
        // Ensure https
        if (str_starts_with($webhookUrl, 'http://') && !app()->environment('local')) {
            $webhookUrl = 'https://' . substr($webhookUrl, 7);
        }

        $res = TelegramService::setWebhook($webhookUrl);
        return response()->json([
            'result' => $res,
            'webhookUrl' => $webhookUrl,
        ]);
    }
}
