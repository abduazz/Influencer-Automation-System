<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    private static function escape($str)
    {
        return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
    }

    public static function buildTelegramMessageUrl($resData, $fallbackChatId = null, $threadId = null, array $allMessageIds = [])
    {
        if (!is_array($resData) || !isset($resData['result'])) {
            return null;
        }

        $messageId = null;
        $chatId = null;

        if (isset($resData['result']['message_id'])) {
            $messageId = $resData['result']['message_id'];
            $chatId = $resData['result']['chat']['id'] ?? $fallbackChatId;
        } elseif (isset($resData['result'][0]['message_id'])) {
            $messageId = $resData['result'][0]['message_id'];
            $chatId = $resData['result'][0]['chat']['id'] ?? $fallbackChatId;
        }

        if (!$messageId || !$chatId) {
            return null;
        }

        $allMessageIds = array_values(array_unique(array_filter(array_map('intval', $allMessageIds))));
        if (!empty($allMessageIds) && !in_array((int) $messageId, $allMessageIds, true)) {
            array_unshift($allMessageIds, (int) $messageId);
        }
        $idPart = !empty($allMessageIds) ? implode(',', $allMessageIds) : (string) $messageId;

        $chatIdStr = (string) $chatId;
        if (str_starts_with($chatIdStr, '-100')) {
            $cleanChatId = substr($chatIdStr, 4);
        } elseif (str_starts_with($chatIdStr, '-')) {
            $cleanChatId = substr($chatIdStr, 1);
        } else {
            $cleanChatId = $chatIdStr;
        }

        $parsedThreadId = self::parseThreadId($threadId);
        if ($parsedThreadId) {
            return "https://t.me/c/{$cleanChatId}/{$parsedThreadId}/{$idPart}";
        }

        return "https://t.me/c/{$cleanChatId}/{$idPart}";
    }

    public static function parseThreadId($rawThreadId): ?int
    {
        if (blank($rawThreadId)) {
            return null;
        }
        $val = null;
        $str = trim((string) $rawThreadId);
        if (is_numeric($str)) {
            $val = (int) $str;
        } elseif (preg_match('#(?:https?://)?t\.me/c/\d+/(\d+)#i', $str, $matches)) {
            $val = (int) $matches[1];
        } elseif (preg_match('/\/(\d+)\/?$/', $str, $matches)) {
            $val = (int) $matches[1];
        }
        // Thread/Topic IDs in Telegram supergroup forums are ALWAYS positive numbers (> 0).
        // If someone accidentally pasted a chat ID (e.g. -1004329107459), ignore it.
        if ($val !== null && $val > 0) {
            return $val;
        }
        return null;
    }

    public static function parseChatId($rawChatId): ?string
    {
        if (blank($rawChatId)) {
            return null;
        }
        $str = trim((string) $rawChatId);
        // Handle links like https://t.me/c/4300590958/327 or https://t.me/c/4300590958
        if (preg_match('#(?:https?://)?t\.me/c/(\d+)#i', $str, $matches)) {
            return '-100' . $matches[1];
        }
        // If user already entered with -100 or -
        if (str_starts_with($str, '-100') || str_starts_with($str, '-')) {
            return $str;
        }
        // If user entered 1004300590958 (omitted the minus sign)
        if (str_starts_with($str, '100') && strlen($str) >= 11) {
            return '-' . $str;
        }
        // If user entered only positive digits >= 8 characters (e.g. 4300590958 copied from t.me/c/4300590958)
        if (preg_match('/^\d{8,}$/', $str)) {
            return '-100' . $str;
        }
        return $str;
    }

    protected static function httpClient(int $timeout = 15): \Illuminate\Http\Client\PendingRequest
    {
        return Http::connectTimeout(5)->timeout($timeout);
    }

    protected static function isThreadFallbackError(string $body): bool
    {
        $lower = strtolower($body);
        return str_contains($lower, 'thread not found')
            || str_contains($lower, 'topic_closed')
            || str_contains($lower, 'topic_deleted');
    }

    /**
     * Enforce Telegram's 1024-character media caption limit safely on UTF-8 boundaries.
     *
     * @return array{0: ?string, 1: bool} [$safeCaption, $isHtml]
     */
    protected static function prepareSafeCaption(?string $caption, bool $preferHtml = true): array
    {
        if (blank($caption)) {
            return [null, false];
        }

        if ($preferHtml && mb_strlen($caption, 'UTF-8') <= 1024) {
            return [$caption, true];
        }

        $plain = strip_tags($caption);
        if (mb_strlen($plain, 'UTF-8') > 1024) {
            $plain = mb_substr($plain, 0, 1020, 'UTF-8') . '…';
        }

        return [$plain, false];
    }

    /**
     * Send a photo with automatic supergroup migration, topic fallback, and HTML->plain retry.
     *
     * @return array{response: array|false, chat_id: string, thread_id: mixed}
     */
    protected static function sendPhotoWithRetries(
        string $token,
        string $chatId,
        $threadId,
        string $binaryData,
        string $filename,
        string $mimeType,
        string $htmlCaption
    ): array {
        $threadId = self::parseThreadId($threadId);
        $currentChatId = (string) $chatId;

        $postPhoto = function (string $targetChatId, $targetThreadId, ?string $captionText, bool $htmlMode) use ($token, $binaryData, $filename, $mimeType) {
            $params = [
                'chat_id' => $targetChatId,
            ];
            if (!blank($captionText)) {
                $params['caption'] = $captionText;
            }
            if ($htmlMode) {
                $params['parse_mode'] = 'HTML';
            }
            if ($targetThreadId) {
                $params['message_thread_id'] = $targetThreadId;
            }

            return self::httpClient(20)
                ->attach('photo', $binaryData, $filename, ['Content-Type' => $mimeType])
                ->post("https://api.telegram.org/bot{$token}/sendPhoto", $params);
        };

        $attemptWithChatRetries = function (?string $captionText, bool $htmlMode) use (&$currentChatId, &$threadId, $postPhoto) {
            $response = $postPhoto($currentChatId, $threadId, $captionText, $htmlMode);
            if ($response->successful()) {
                return ['ok' => true, 'json' => $response->json(), 'body' => ''];
            }

            $body = $response->body();
            $resData = json_decode($body, true);
            if (isset($resData['parameters']['migrate_to_chat_id'])) {
                $currentChatId = (string) $resData['parameters']['migrate_to_chat_id'];
                Log::info("Telegram group upgraded to supergroup. Migrating chat ID to {$currentChatId}");
                $response = $postPhoto($currentChatId, $threadId, $captionText, $htmlMode);
                if ($response->successful()) {
                    return ['ok' => true, 'json' => $response->json(), 'body' => ''];
                }
                $body = $response->body();
            }

            if ($threadId && self::isThreadFallbackError($body)) {
                Log::warning("Telegram thread {$threadId} rejected in chat {$currentChatId}, retrying photo without thread ID");
                $threadId = null;
                $response = $postPhoto($currentChatId, null, $captionText, $htmlMode);
                if ($response->successful()) {
                    return ['ok' => true, 'json' => $response->json(), 'body' => ''];
                }
                $body = $response->body();
            }

            return ['ok' => false, 'json' => false, 'body' => $body];
        };

        [$safeCaption, $useHtml] = self::prepareSafeCaption($htmlCaption, true);
        $first = $attemptWithChatRetries($safeCaption, $useHtml);
        if ($first['ok']) {
            return ['response' => $first['json'], 'chat_id' => $currentChatId, 'thread_id' => $threadId];
        }

        if ($useHtml) {
            Log::warning("Telegram sendPhoto HTML failed, retrying plain: " . $first['body']);
            [$plainCaption] = self::prepareSafeCaption($htmlCaption, false);
            $second = $attemptWithChatRetries($plainCaption, false);
            if ($second['ok']) {
                return ['response' => $second['json'], 'chat_id' => $currentChatId, 'thread_id' => $threadId];
            }
        } else {
            Log::warning("Telegram sendPhoto failed: " . $first['body']);
        }

        return ['response' => false, 'chat_id' => $currentChatId, 'thread_id' => $threadId];
    }

    public static function resolveReportDestinations($report): array
    {
        if ($report && is_object($report) && method_exists($report, 'loadMissing')) {
            $report->loadMissing('project');
        }

        $projectsToRoute = collect();
        if ($report?->project) {
            $projectsToRoute->push($report->project);
        } elseif (!empty($report?->slots_config) && is_array($report->slots_config)) {
            $projectIds = collect($report->slots_config)
                ->pluck('projectId')
                ->filter(fn($id) => is_numeric($id) && (int) $id > 0)
                ->map(fn($id) => (int) $id)
                ->unique()
                ->values();
            if ($projectIds->isNotEmpty()) {
                $projectsToRoute = \App\Models\Project::whereIn('id', $projectIds)->get();
            }
        }

        $primaryProject = $projectsToRoute->first();
        $mainChatId = config('services.telegram.reports_chat_id') ?: config('services.telegram.chat_id');
        $mainThreadId = self::parseThreadId($primaryProject?->telegram_thread_id ?? null);

        $destinations = [];
        $seen = [];
        if ($mainChatId) {
            $mainKey = (string) $mainChatId . '|' . ($mainThreadId ?? '');
            $seen[$mainKey] = true;
            $destinations[] = [
                'chat_id' => (string) $mainChatId,
                'thread_id' => $mainThreadId,
                'is_primary' => true,
            ];
        }

        foreach ($projectsToRoute as $proj) {
            $projectChatId = self::parseChatId($proj->telegram_chat_id ?? null);
            $projectTopicId = self::parseThreadId($proj->telegram_topic_id ?? null);
            if (!$projectChatId) {
                continue;
            }
            $destKey = (string) $projectChatId . '|' . ($projectTopicId ?? '');
            if (isset($seen[$destKey])) {
                continue;
            }
            $seen[$destKey] = true;
            $destinations[] = [
                'chat_id' => (string) $projectChatId,
                'thread_id' => $projectTopicId,
                'is_primary' => false,
            ];
        }

        return $destinations;
    }

    public static function resolveSubmissionDestinations($integration): array
    {
        if ($integration && is_object($integration) && method_exists($integration, 'loadMissing')) {
            $integration->loadMissing('project');
        }

        $project = $integration->project ?? null;

        $mainChatId = config('services.telegram.submissions_chat_id')
            ?: config('services.telegram.reports_chat_id')
            ?: config('services.telegram.chat_id');
        $mainThreadId = self::parseThreadId($project?->telegram_submissions_thread_id ?? null)
            ?: self::parseThreadId($project?->telegram_thread_id ?? null);

        $destinations = [];
        if ($mainChatId) {
            $destinations[] = [
                'chat_id' => (string) $mainChatId,
                'thread_id' => $mainThreadId,
                'is_primary' => true,
            ];
        }

        $projectChatId = self::parseChatId($project?->telegram_chat_id ?? null);
        $projectTopicId = self::parseThreadId($project?->telegram_submissions_topic_id ?? null)
            ?: self::parseThreadId($project?->telegram_topic_id ?? null);

        if ($projectChatId) {
            $isDuplicateOfMain = isset($destinations[0])
                && (string) $projectChatId === (string) $destinations[0]['chat_id']
                && $projectTopicId === $destinations[0]['thread_id'];

            if (!$isDuplicateOfMain) {
                $destinations[] = [
                    'chat_id' => (string) $projectChatId,
                    'thread_id' => $projectTopicId,
                    'is_primary' => false,
                ];
            }
        }

        return $destinations;
    }

    public static function sendMessage($chatId, $text, $threadId = null, array $options = [])
    {
        $threadId = self::parseThreadId($threadId);
        $token = config('services.telegram.bot_token');
        if (!$token || !$chatId) {
            Log::info("Telegram Bot Token or Chat ID not set. Message: \n" . $text);
            return false;
        }

        $currentChatId = $chatId;

        $attemptPost = function (array $params) use ($token, &$currentChatId, &$threadId) {
            $response = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/sendMessage", $params);
            if ($response->successful()) {
                return ['ok' => true, 'json' => $response->json(), 'body' => ''];
            }

            $body = $response->body();
            $resData = json_decode($body, true);
            if (isset($resData['parameters']['migrate_to_chat_id'])) {
                $currentChatId = $resData['parameters']['migrate_to_chat_id'];
                Log::info("Telegram group upgraded to supergroup. Migrating chat ID from {$params['chat_id']} to {$currentChatId}");
                $params['chat_id'] = $currentChatId;
                $response = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/sendMessage", $params);
                if ($response->successful()) {
                    return ['ok' => true, 'json' => $response->json(), 'body' => ''];
                }
                $body = $response->body();
            }

            if ($threadId && self::isThreadFallbackError($body)) {
                Log::warning("Telegram thread {$threadId} rejected in chat {$params['chat_id']}, retrying without thread ID");
                $threadId = null;
                unset($params['message_thread_id']);
                $response = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/sendMessage", $params);
                if ($response->successful()) {
                    return ['ok' => true, 'json' => $response->json(), 'body' => ''];
                }
                $body = $response->body();
            }

            return ['ok' => false, 'json' => false, 'body' => $body];
        };

        try {
            $params = [
                'chat_id' => $currentChatId,
                'text' => $text,
                'parse_mode' => 'HTML',
            ];
            if ($threadId) {
                $params['message_thread_id'] = $threadId;
            }
            if (!empty($options['link_preview_options'])) {
                $params['link_preview_options'] = $options['link_preview_options'];
            }

            // First attempt: HTML parse mode
            $first = $attemptPost($params);
            if ($first['ok']) {
                return $first['json'];
            }

            Log::warning("Telegram HTML sendMessage failed, retrying as plain text without link_preview_options. Error: " . $first['body']);

            // Second attempt: strip HTML tags and drop link_preview_options (external URLs or preview errors can otherwise fail both attempts)
            $plainParams = [
                'chat_id' => $currentChatId,
                'text' => strip_tags($text),
            ];
            if ($threadId) {
                $plainParams['message_thread_id'] = $threadId;
            }

            $second = $attemptPost($plainParams);
            if ($second['ok']) {
                return $second['json'];
            }

            Log::error("Telegram API Error (both HTML and plain): " . $second['body']);
            return false;
        } catch (\Throwable $e) {
            Log::error("Telegram exception: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Sends an album of photos (media group) to Telegram with robust error handling,
     * UTF-8 multibyte safety, HTML parse-error retry, thread fallback, and chat migration handling.
     */
    public static function sendMediaGroup($chatId, array $items, ?string $caption = null, $threadId = null, bool $useHtml = true)
    {
        $token = config('services.telegram.bot_token');
        if (!$token || !$chatId || empty($items)) {
            Log::info("Telegram Bot Token or Chat ID not set or empty items for sendMediaGroup.");
            return false;
        }

        $threadId = self::parseThreadId($threadId);
        $currentChatId = $chatId;

        $doRequest = function ($targetChatId, $targetThreadId, $targetCaption, $targetUseHtml) use ($token, $items) {
            $media = [];
            $httpReq = self::httpClient(25)->asMultipart();

            foreach ($items as $idx => $item) {
                $field = "photo_{$idx}";
                $type = $item['type'] ?? 'photo';
                $mediaItem = [
                    'type' => $type,
                    'media' => "attach://{$field}",
                ];

                if ($idx === 0 && !blank($targetCaption)) {
                    $mediaItem['caption'] = $targetCaption;
                    if ($targetUseHtml) {
                        $mediaItem['parse_mode'] = 'HTML';
                    }
                }

                $media[] = $mediaItem;

                $ext = $item['ext'] ?? 'jpg';
                $filename = $item['filename'] ?? ("receipt_{$idx}.{$ext}");
                $headers = [];
                if (!empty($item['mimeType'])) {
                    $headers['Content-Type'] = $item['mimeType'];
                }

                $httpReq->attach($field, $item['binary'], $filename, $headers);
            }

            $mediaParams = [
                'chat_id' => $targetChatId,
                'media' => json_encode($media, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ];
            if ($targetThreadId) {
                $mediaParams['message_thread_id'] = $targetThreadId;
            }

            return $httpReq->post("https://api.telegram.org/bot{$token}/sendMediaGroup", $mediaParams);
        };

        $attemptMedia = function ($targetCaption, $targetUseHtml) use (&$currentChatId, &$threadId, $doRequest) {
            $response = $doRequest($currentChatId, $threadId, $targetCaption, $targetUseHtml);
            if ($response->successful()) {
                return ['ok' => true, 'json' => $response->json(), 'body' => ''];
            }

            $body = $response->body();
            $resData = json_decode($body, true);
            if (isset($resData['parameters']['migrate_to_chat_id'])) {
                $currentChatId = $resData['parameters']['migrate_to_chat_id'];
                Log::info("Telegram group upgraded to supergroup. Migrating chat ID to {$currentChatId}");
                $response = $doRequest($currentChatId, $threadId, $targetCaption, $targetUseHtml);
                if ($response->successful()) {
                    return ['ok' => true, 'json' => $response->json(), 'body' => ''];
                }
                $body = $response->body();
            }

            if ($threadId && self::isThreadFallbackError($body)) {
                Log::warning("Telegram thread {$threadId} rejected for mediaGroup in chat {$currentChatId}, retrying without thread ID");
                $threadId = null;
                $response = $doRequest($currentChatId, null, $targetCaption, $targetUseHtml);
                if ($response->successful()) {
                    return ['ok' => true, 'json' => $response->json(), 'body' => ''];
                }
                $body = $response->body();
            }

            return ['ok' => false, 'json' => false, 'body' => $body];
        };

        [$safeCaption, $useHtml] = self::prepareSafeCaption($caption, $useHtml);

        $first = $attemptMedia($safeCaption, $useHtml);
        if ($first['ok']) {
            return $first['json'];
        }

        if ($useHtml && !blank($caption)) {
            Log::warning("Telegram sendMediaGroup HTML failed ({$first['body']}), retrying as plain text caption");
            [$plainCaption] = self::prepareSafeCaption($caption, false);
            $second = $attemptMedia($plainCaption, false);
            if ($second['ok']) {
                return $second['json'];
            }
            Log::warning("Telegram sendMediaGroup plain retry failed: " . $second['body']);
        } else {
            Log::warning("Telegram sendMediaGroup failed: " . $first['body']);
        }

        return false;
    }

    public static function buildReportNotificationText($report, $lang = 'uz', $createdByName = null, $isUpdate = false): string
    {
        $locales = [
            'ru' => [
                'new_report' => '📝 <b>Создан новый отчет!</b>',
                'updated_report' => '✏️ <b>Отчет обновлен!</b>',
                'report_id' => '🆔 <b>ID отчета:</b>',
                'date' => '📅 <b>Дата:</b>',
                'project' => '📂 <b>Проект:</b>',
                'blogger' => '👤 <b>Блогер:</b>',
                'platform' => '📱 <b>Платформа:</b>',
                'slots_count' => '🔢 <b>Количество слотов:</b>',
                'price_per_slot' => '💵 <b>Цена за слот:</b>',
                'total_amount' => '💰 <b>Итоговая сумма:</b>',
                'created_by' => '✍️ <b>Создан кем:</b>',
                'purpose' => '🎯 <b>Назначение:</b>',
                'comments' => '💬 <b>Комментарии:</b>',
            ],
            'en' => [
                'new_report' => '📝 <b>New Report Created!</b>',
                'updated_report' => '✏️ <b>Report Updated!</b>',
                'report_id' => '🆔 <b>Report ID:</b>',
                'date' => '📅 <b>Date:</b>',
                'project' => '📂 <b>Project:</b>',
                'blogger' => '👤 <b>Blogger:</b>',
                'platform' => '📱 <b>Platform:</b>',
                'slots_count' => '🔢 <b>Slots Count:</b>',
                'price_per_slot' => '💵 <b>Price per Slot:</b>',
                'total_amount' => '💰 <b>Total Amount:</b>',
                'created_by' => '✍️ <b>Created by:</b>',
                'purpose' => '🎯 <b>Purpose:</b>',
                'comments' => '💬 <b>Comments:</b>',
            ],
            'uz' => [
                'new_report' => '📝 <b>Yangi hisobot yaratildi!</b>',
                'updated_report' => '✏️ <b>Hisobot yangilandi!</b>',
                'report_id' => '🆔 <b>Hisobot IDsi:</b>',
                'date' => '📅 <b>Sana:</b>',
                'project' => '📂 <b>Loyiha:</b>',
                'blogger' => '👤 <b>Blogger:</b>',
                'platform' => '📱 <b>Platforma:</b>',
                'slots_count' => '🔢 <b>Slotlar soni:</b>',
                'price_per_slot' => '💵 <b>Slot narxi:</b>',
                'total_amount' => '💰 <b>Jami summa:</b>',
                'created_by' => '✍️ <b>Kim tomonidan yaratildi:</b>',
                'purpose' => '🎯 <b>Maqsadi:</b>',
                'comments' => '💬 <b>Izohlar:</b>',
            ]
        ];

        // Safe fallback for language key
        $l = isset($locales[$lang]) ? $lang : 'uz';
        $t = $locales[$l];

        // Suffix attached to Total Amount describing payment type
        $paymentTypeSuffix = '';
        if ($report->payment_type === 'full') {
            $paymentTypeSuffix = '(Full)';
        } else if ($report->payment_type === 'prepaid') {
            if ($report->slots_count > 0 && $report->paid_slots_count > 0) {
                $percentage = round(($report->paid_slots_count / $report->slots_count) * 100);
                $paymentTypeSuffix = "(Prepaid {$percentage}%)";
            } else {
                $paymentTypeSuffix = '(Prepaid)';
            }
        } else if ($report->payment_type === 'remaining') {
            $paymentTypeSuffix = '(Remaining)';
        } else if ($report->payment_type === 'other') {
            $paymentTypeSuffix = '(Other)';
        }

        $projectName = $report->project?->name ?? '—';
        $title = $isUpdate ? $t['updated_report'] : $t['new_report'];

        $text = "{$title}\n\n";
        if (!empty($report->id)) {
            $formattedId = (!empty($report->formatted_id))
                ? $report->formatted_id
                : ((!empty($report->project?->prefix))
                    ? ('#' . strtoupper(trim((string) $report->project->prefix)) . '-' . $report->id)
                    : "#{$report->id}");
            $text .= "{$t['report_id']} {$formattedId}\n";
        }
        $creator = $createdByName ?: $report->created_by;
        if ($creator) {
            $text .= "{$t['created_by']} " . self::escape($creator) . "\n";
        }
        $dateStr = $report->date ? (\is_string($report->date) ? substr($report->date, 0, 10) : $report->date->format('Y-m-d')) : '—';
        $text .= "{$t['date']} {$dateStr}\n";
        $text .= "{$t['project']} " . self::escape($projectName) . "\n";

        if ($report->payment_type !== 'other') {
            $bloggerLine = self::escape($report->channel_blogger ?? '—');
            if (!empty($report->blogger_page_link)) {
                $bloggerLine .= " - " . self::escape($report->blogger_page_link);
            }
            $text .= "{$t['blogger']} {$bloggerLine}\n";
            $text .= "{$t['platform']} " . self::escape($report->platform ?? '—') . "\n";
            if ($report->payment_type === 'remaining') {
                $slotsLabel = $lang === 'ru' ? '🔢 <b>Доплачено слотов:</b>' : ($lang === 'uz' ? '🔢 <b>Qo\'shimcha to\'langan slotlar:</b>' : '🔢 <b>Remaining Paid Slots:</b>');
                $text .= "{$slotsLabel} " . ($report->paid_slots_count ?? '0') . "\n";
            } else {
                $text .= "{$t['slots_count']} " . ($report->slots_count ?? '0') . "\n";
            }
            $text .= "{$t['price_per_slot']} " . number_format($report->price_per_slot ?? 0, 0, '.', ' ') . " UZS\n";
        } else {
            if (!empty($report->destination)) {
                $text .= "{$t['purpose']} " . self::escape($report->destination) . "\n";
            }
        }

        $text .= "{$t['total_amount']} " . number_format($report->total_amount ?? 0, 0, '.', ' ') . " UZS";
        if ($paymentTypeSuffix !== '') {
            $text .= " - {$paymentTypeSuffix}";
        }
        $text .= "\n";

        if (!empty($report->comments)) {
            $text .= "{$t['comments']} " . self::escape($report->comments) . "\n";
        }

        return $text;
    }

    public static function sendReportNotification($report, $receiptBase64 = null, $lang = 'uz', $createdByName = null)
    {
        $destinations = self::resolveReportDestinations($report);
        if (empty($destinations)) {
            Log::info("No telegram report destinations resolved.");
            return false;
        }

        $token = config('services.telegram.bot_token');
        $text = self::buildReportNotificationText($report, $lang, $createdByName, false);

        $receiptList = [];
        if (is_array($receiptBase64)) {
            $receiptList = array_values(array_filter($receiptBase64));
        } elseif (is_string($receiptBase64) && !empty($receiptBase64)) {
            $trimmed = trim($receiptBase64);
            if (str_starts_with($trimmed, '[') && str_ends_with($trimmed, ']')) {
                $decoded = json_decode($trimmed, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $receiptList = array_values(array_filter($decoded));
                } else {
                    $receiptList = [$receiptBase64];
                }
            } else {
                $receiptList = [$receiptBase64];
            }
        } elseif (isset($report->receipts) && is_array($report->receipts)) {
            $receiptList = $report->receipts;
        }

        $parsedReceipts = [];
        foreach ($receiptList as $item) {
            if (is_string($item) && preg_match('/^data:(\w+\/\w+);base64,(.+)$/', $item, $matches)) {
                $mimeType = strtolower($matches[1]);
                if (!str_starts_with($mimeType, 'image/')) {
                    continue;
                }
                $ext = 'jpg';
                if (str_contains($mimeType, 'png'))
                    $ext = 'png';
                elseif (str_contains($mimeType, 'webp'))
                    $ext = 'webp';
                elseif (str_contains($mimeType, 'jpeg'))
                    $ext = 'jpg';

                $parsedReceipts[] = [
                    'mimeType' => $mimeType,
                    'binary' => base64_decode($matches[2]),
                    'ext' => $ext,
                ];
            }
        }

        $sendToDestination = function (array $dest) use ($token, $text, $parsedReceipts, $report, $lang) {
            $chatId = $dest['chat_id'];
            $threadId = $dest['thread_id'];
            $isPrimary = $dest['is_primary'] ?? false;

            if (!$token || !$chatId) {
                return false;
            }

            try {
                // If a single Base64 photo is provided, send it as photo directly
                if (count($parsedReceipts) === 1) {
                    $receiptItem = $parsedReceipts[0];
                    $binaryData = $receiptItem['binary'];
                    $ext = $receiptItem['ext'] ?? 'jpg';
                    $mimeType = $receiptItem['mimeType'] ?? 'image/jpeg';
                    $filename = "receipt.{$ext}";

                    $photoResult = self::sendPhotoWithRetries($token, (string) $chatId, $threadId, $binaryData, $filename, $mimeType, $text);
                    if ($photoResult['response']) {
                        self::recordReportTelegramUrl($report, $photoResult['response'], $photoResult['chat_id'], $photoResult['thread_id'], [], $isPrimary);
                        return true;
                    }

                    // Fallback: send text first, then photo
                    $msgRes = self::sendMessage($chatId, $text, $threadId);
                    if ($msgRes) {
                        self::recordReportTelegramUrl($report, $msgRes, $chatId, $threadId, [], $isPrimary);
                    }

                    $fallbackPhoto = self::sendPhotoWithRetries($token, (string) $chatId, $threadId, $binaryData, $filename, $mimeType, '📎 Чек/Скриншот оплаты');
                    if (!$msgRes && $fallbackPhoto['response']) {
                        self::recordReportTelegramUrl($report, $fallbackPhoto['response'], $fallbackPhoto['chat_id'], $fallbackPhoto['thread_id'], [], $isPrimary);
                    }
                    return (bool) ($msgRes || $fallbackPhoto['response']);
                }

                // If multiple Base64 photo receipts are provided, send as album
                if (count($parsedReceipts) > 1) {
                    $chunks = array_chunk($parsedReceipts, 10);
                    $firstResult = null;
                    $allMessageIds = [];

                    foreach ($chunks as $chunkIdx => $chunk) {
                        $chunkCaption = null;
                        $useHtml = false;

                        if ($chunkIdx === 0) {
                            $chunkCaption = $text;
                            $useHtml = (mb_strlen($text, 'UTF-8') <= 1024);
                        } else {
                            $chunkNum = $chunkIdx + 1;
                            $chunkCaption = $lang === 'ru'
                                ? "📎 Чеки (часть {$chunkNum})"
                                : ($lang === 'uz' ? "📎 Cheklar ({$chunkNum}-qism)" : "📎 Receipts (part {$chunkNum})");
                            $useHtml = false;
                        }

                        if (count($chunk) >= 2) {
                            $res = self::sendMediaGroup($chatId, $chunk, $chunkCaption, $threadId, $useHtml);
                            if ($res && !empty($res['result']) && is_array($res['result'])) {
                                foreach ($res['result'] as $msg) {
                                    if (!empty($msg['message_id'])) {
                                        $allMessageIds[] = (int) $msg['message_id'];
                                    }
                                }
                            }
                        } else {
                            $single = $chunk[0];
                            $singleExt = $single['ext'] ?? 'jpg';
                            $singleMime = $single['mimeType'] ?? 'image/jpeg';
                            $singleRes = self::sendPhotoWithRetries($token, (string) $chatId, $threadId, $single['binary'], "receipt_extra.{$singleExt}", $singleMime, $chunkCaption ?? '');
                            $res = $singleRes['response'];
                            if ($res && !empty($res['result']['message_id'])) {
                                $allMessageIds[] = (int) $res['result']['message_id'];
                            }
                        }

                        if ($chunkIdx === 0) {
                            $firstResult = $res;
                        }
                    }

                    if ($firstResult) {
                        self::recordReportTelegramUrl($report, $firstResult, $chatId, $threadId, $allMessageIds, $isPrimary);
                        return true;
                    }

                    Log::warning("Telegram sendMediaGroup failed for chat {$chatId}, falling back to individual messages");
                    $msgRes = self::sendMessage($chatId, $text, $threadId);
                    if ($msgRes) {
                        self::recordReportTelegramUrl($report, $msgRes, $chatId, $threadId, [], $isPrimary);
                    }

                    $anyPhotoOk = false;
                    foreach ($parsedReceipts as $idx => $item) {
                        $ext = $item['ext'] ?? 'jpg';
                        $mimeType = $item['mimeType'] ?? 'image/jpeg';
                        $filename = "receipt_" . ($idx + 1) . ".{$ext}";
                        $fallbackCap = '📎 Чек ' . ($idx + 1) . ' из ' . count($parsedReceipts);
                        $fbRes = self::sendPhotoWithRetries($token, (string) $chatId, $threadId, $item['binary'], $filename, $mimeType, $fallbackCap);
                        if ($fbRes['response']) {
                            $anyPhotoOk = true;
                        }
                    }
                    return (bool) ($msgRes || $anyPhotoOk);
                }

                // If text only (0 receipts)
                $msgRes = self::sendMessage($chatId, $text, $threadId);
                if ($msgRes) {
                    self::recordReportTelegramUrl($report, $msgRes, $chatId, $threadId, [], $isPrimary);
                    return true;
                }
                return false;
            } catch (\Throwable $e) {
                Log::error("Error sending report notification to chat {$chatId}: " . $e->getMessage());
                return false;
            }
        };

        $anySuccess = false;
        foreach ($destinations as $dest) {
            if ($dest['is_primary']) {
                if ($sendToDestination($dest)) {
                    $anySuccess = true;
                }
            } else {
                try {
                    $dupSuccess = $sendToDestination($dest);
                    if ($dupSuccess) {
                        $anySuccess = true;
                        Log::info("Sent duplicate report notification to project chat {$dest['chat_id']} for report #{$report->id}");
                    } else {
                        Log::warning("Failed to duplicate report notification to project chat {$dest['chat_id']} for report #{$report->id}. Make sure the bot is added to that group with permission to send messages.");
                    }
                } catch (\Throwable $e) {
                    Log::error("Failed to duplicate report notification to project chat {$dest['chat_id']}: " . $e->getMessage());
                }
            }
        }

        return $anySuccess;
    }

    protected static function recordReportTelegramUrl($report, $resData, $chatId, $threadId = null, array $allMessageIds = [], bool $isPrimary = true): void
    {
        if (!$report || !is_object($report) || !($report instanceof \App\Models\Report)) {
            return;
        }
        $tgUrl = self::buildTelegramMessageUrl($resData, $chatId, $threadId, $allMessageIds);
        if ($tgUrl) {
            try {
                $field = $isPrimary ? 'telegram_message_url' : 'telegram_duplicate_message_url';
                $report->update([$field => $tgUrl]);
                Log::info("Saved {$field} for report #{$report->id}: {$tgUrl}");
            } catch (\Throwable $e) {
                Log::error("Failed to save {$field} for report #{$report->id}: " . $e->getMessage());
            }
        }
    }

    public static function extractMessageIdentifiers($report): ?array
    {
        if (!$report) {
            return null;
        }

        $url = is_string($report) ? $report : ($report->telegram_message_url ?? null);
        if (empty($url)) {
            return null;
        }

        $url = trim($url);

        // Pattern 1: https://t.me/c/<chat_id>/... (with optional topic and message id/ids)
        if (preg_match('#(?:https?://)?t\.me/c/(\d+)/+(.+)$#i', $url, $matches)) {
            $cleanChatId = $matches[1];
            $rest = explode('?', $matches[2])[0];
            $rest = explode('#', $rest)[0];
            $segments = array_values(array_filter(explode('/', $rest), fn($s) => $s !== ''));
            if (empty($segments)) {
                return null;
            }
            $lastSegment = end($segments);

            $ids = [];
            foreach (explode(',', $lastSegment) as $part) {
                $part = trim($part);
                if (is_numeric($part)) {
                    $ids[] = (int) $part;
                }
            }
            if (empty($ids)) {
                return null;
            }

            $chatId = '-100' . $cleanChatId;

            $defaultChatId = (string) (config('services.telegram.reports_chat_id') ?: config('services.telegram.chat_id'));
            if ($defaultChatId) {
                $cleanDefault = ltrim($defaultChatId, '-');
                if (str_starts_with($cleanDefault, '100')) {
                    $cleanDefault = substr($cleanDefault, 3);
                }
                if ($cleanDefault === $cleanChatId) {
                    $chatId = $defaultChatId;
                }
            }

            return [
                'chat_id' => $chatId,
                'message_id' => $ids[0],
                'message_ids' => $ids,
            ];
        }

        // Pattern 2: https://t.me/<channel_name>/... (public channels or supergroup usernames)
        if (preg_match('#(?:https?://)?t\.me/([a-zA-Z0-9_]+)/+(.+)$#i', $url, $matches) && strtolower($matches[1]) !== 'c') {
            $channel = '@' . $matches[1];
            $rest = explode('?', $matches[2])[0];
            $rest = explode('#', $rest)[0];
            $segments = array_values(array_filter(explode('/', $rest), fn($s) => $s !== ''));
            if (empty($segments)) {
                return null;
            }
            $lastSegment = end($segments);

            $ids = [];
            foreach (explode(',', $lastSegment) as $part) {
                $part = trim($part);
                if (is_numeric($part)) {
                    $ids[] = (int) $part;
                }
            }
            if (empty($ids)) {
                return null;
            }

            return [
                'chat_id' => $channel,
                'message_id' => $ids[0],
                'message_ids' => $ids,
            ];
        }

        return null;
    }

    public static function deleteTelegramMessageByUrl(?string $url, $reportId = 'unknown'): bool
    {
        if (empty($url)) {
            return false;
        }

        $identifiers = self::extractMessageIdentifiers($url);
        if (!$identifiers) {
            Log::info("deleteTelegramMessageByUrl: No telegram message identifiers found for URL: {$url}");
            return false;
        }

        $token = config('services.telegram.bot_token');
        if (!$token) {
            Log::warning("deleteTelegramMessageByUrl: Telegram Bot Token not set.");
            return false;
        }

        try {
            $chatId = $identifiers['chat_id'];
            $messageIds = !empty($identifiers['message_ids']) ? $identifiers['message_ids'] : [$identifiers['message_id']];
            $messageIds = array_values(array_unique(array_filter(array_map('intval', $messageIds))));

            if (empty($messageIds)) {
                return false;
            }

            // 1. Bulk delete if multiple message IDs exist (via deleteMessages Telegram Bot API)
            if (count($messageIds) > 1) {
                try {
                    $bulkRes = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/deleteMessages", [
                        'chat_id' => $chatId,
                        'message_ids' => $messageIds,
                    ]);

                    if ($bulkRes->successful()) {
                        Log::info("Bulk deleted telegram messages [" . implode(',', $messageIds) . "] in chat {$chatId} for report #{$reportId}");
                        return true;
                    }

                    $bulkBody = $bulkRes->body();
                    $bData = json_decode($bulkBody, true);
                    if (isset($bData['parameters']['migrate_to_chat_id'])) {
                        $newChatId = $bData['parameters']['migrate_to_chat_id'];
                        $bulkRes2 = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/deleteMessages", [
                            'chat_id' => $newChatId,
                            'message_ids' => $messageIds,
                        ]);
                        if ($bulkRes2->successful()) {
                            Log::info("Bulk deleted telegram messages [" . implode(',', $messageIds) . "] in migrated chat {$newChatId} for report #{$reportId}");
                            return true;
                        }
                    }
                } catch (\Throwable $e) {
                    Log::debug("Bulk deleteMessages failed, falling back to individual deleteMessage: " . $e->getMessage());
                }
            }

            // 2. Individual deleteMessage fallback
            $allSuccess = true;
            foreach ($messageIds as $messageId) {
                $response = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/deleteMessage", [
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                ]);

                if ($response->successful()) {
                    Log::info("Deleted telegram message {$messageId} in chat {$chatId} for report #{$reportId}");
                    continue;
                }

                $body = $response->body();
                $resData = json_decode($body, true);
                if (isset($resData['parameters']['migrate_to_chat_id'])) {
                    $newChatId = $resData['parameters']['migrate_to_chat_id'];
                    $response2 = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/deleteMessage", [
                        'chat_id' => $newChatId,
                        'message_id' => $messageId,
                    ]);
                    if ($response2->successful() || str_contains($response2->body(), 'message to delete not found')) {
                        continue;
                    }
                    $body = $response2->body();
                }

                if (str_contains($body, 'message to delete not found')) {
                    Log::info("Telegram message {$messageId} in chat {$chatId} was already deleted.");
                    continue;
                }

                Log::warning("Failed to delete telegram message {$messageId} in chat {$chatId}: {$body}");
                $allSuccess = false;
            }

            return $allSuccess;
        } catch (\Throwable $e) {
            Log::error("Telegram deleteTelegramMessageByUrl exception for report #{$reportId}: " . $e->getMessage());
            return false;
        }
    }

    public static function deleteReportNotification($report): bool
    {
        $primaryUrl = is_string($report) ? $report : ($report->telegram_message_url ?? null);
        $duplicateUrl = is_object($report) ? ($report->telegram_duplicate_message_url ?? null) : null;
        $reportId = is_object($report) ? ($report->id ?? 'unknown') : 'unknown';

        $hasAnyUrl = !empty($primaryUrl) || !empty($duplicateUrl);
        if (!$hasAnyUrl) {
            Log::info("deleteReportNotification: No telegram message identifiers found for report #{$reportId}");
            return false;
        }

        $allSuccess = true;
        if (!empty($primaryUrl)) {
            $ok = self::deleteTelegramMessageByUrl($primaryUrl, $reportId);
            if (!$ok) {
                $allSuccess = false;
            }
        }

        if (!empty($duplicateUrl)) {
            $ok = self::deleteTelegramMessageByUrl($duplicateUrl, $reportId);
            if (!$ok) {
                $allSuccess = false;
            }
        }

        return $allSuccess;
    }

    public static function updateTelegramMessageByUrl(?string $url, string $text, $reportId = 'unknown'): bool
    {
        if (empty($url)) {
            return false;
        }

        $identifiers = self::extractMessageIdentifiers($url);
        if (!$identifiers) {
            Log::info("updateTelegramMessageByUrl: No telegram message identifiers found for URL: {$url}");
            return false;
        }

        $token = config('services.telegram.bot_token');
        if (!$token) {
            Log::warning("updateTelegramMessageByUrl: Telegram Bot Token not set.");
            return false;
        }

        $chatId = $identifiers['chat_id'];
        $messageId = $identifiers['message_id'];
        $safeCaption = mb_strlen($text, 'UTF-8') > 1024 ? mb_substr(strip_tags($text), 0, 1020, 'UTF-8') . '...' : $text;

        try {
            // First attempt: editMessageCaption (for photo/document media messages)
            $response = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/editMessageCaption", [
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'caption' => $safeCaption,
                'parse_mode' => 'HTML',
            ]);

            if ($response->successful()) {
                Log::info("Updated Telegram message caption for report #{$reportId} in chat {$chatId}");
                return true;
            }

            $body = $response->body();
            if (str_contains($body, 'message is not modified')) {
                return true;
            }

            $resData = json_decode($body, true);
            if (isset($resData['parameters']['migrate_to_chat_id'])) {
                $chatId = $resData['parameters']['migrate_to_chat_id'];
                $response = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/editMessageCaption", [
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                    'caption' => $safeCaption,
                    'parse_mode' => 'HTML',
                ]);
                if ($response->successful() || str_contains($response->body(), 'message is not modified')) {
                    return true;
                }
                $body = $response->body();
            }

            if (str_contains($body, 'can\'t parse entities') || str_contains($body, 'failed to find end tag')) {
                $retryCaption = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/editMessageCaption", [
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                    'caption' => strip_tags($safeCaption),
                ]);
                if ($retryCaption->successful() || str_contains($retryCaption->body(), 'message is not modified')) {
                    return true;
                }
            }

            // Second attempt: editMessageText (for plain text messages)
            $textResponse = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/editMessageText", [
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => $text,
                'parse_mode' => 'HTML',
            ]);

            if ($textResponse->successful() || str_contains($textResponse->body(), 'message is not modified')) {
                Log::info("Updated Telegram message text for report #{$reportId} in chat {$chatId}");
                return true;
            }

            $textBody = $textResponse->body();
            if (str_contains($textBody, 'can\'t parse entities') || str_contains($textBody, 'failed to find end tag')) {
                $retryText = self::httpClient(15)->post("https://api.telegram.org/bot{$token}/editMessageText", [
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                    'text' => strip_tags($text),
                ]);
                if ($retryText->successful() || str_contains($retryText->body(), 'message is not modified')) {
                    return true;
                }
            }

            Log::warning("Failed to update telegram message for report #{$reportId} in chat {$chatId}: Caption error: {$body} | Text error: {$textBody}");
            return false;
        } catch (\Throwable $e) {
            Log::error("Telegram updateTelegramMessageByUrl Exception for report #{$reportId} in chat {$chatId}: " . $e->getMessage());
            return false;
        }
    }

    public static function updateReportNotification($report, $lang = 'uz', $createdByName = null): bool
    {
        $primaryUrl = is_string($report) ? $report : ($report->telegram_message_url ?? null);
        $duplicateUrl = is_object($report) ? ($report->telegram_duplicate_message_url ?? null) : null;
        $reportId = is_object($report) ? ($report->id ?? 'unknown') : 'unknown';

        $hasAnyUrl = !empty($primaryUrl) || !empty($duplicateUrl);
        if (!$hasAnyUrl) {
            Log::info("updateReportNotification: No telegram message identifiers found for report #{$reportId}");
            return false;
        }

        if (is_object($report) && !$report->relationLoaded('project')) {
            $report->load('project');
        }

        $text = self::buildReportNotificationText($report, $lang, $createdByName, true);

        $allSuccess = true;
        if (!empty($primaryUrl)) {
            $ok = self::updateTelegramMessageByUrl($primaryUrl, $text, $reportId);
            if (!$ok) {
                $allSuccess = false;
            }
        }

        if (!empty($duplicateUrl)) {
            $ok = self::updateTelegramMessageByUrl($duplicateUrl, $text, $reportId);
            if (!$ok) {
                $allSuccess = false;
            }
        }

        return $allSuccess;
    }

    public static function sendSubmissionNotification($integration, $data, $lang = 'uz', $newlyFilledKeys = null)
    {
        $destinations = self::resolveSubmissionDestinations($integration);
        $token = config('services.telegram.bot_token');

        if (!$token || empty($destinations)) {
            Log::info("Telegram Bot Token or Chat ID not set for submissions.");
            return false;
        }

        if (is_array($newlyFilledKeys) && count($newlyFilledKeys) === 0) {
            Log::info("Telegram sendSubmissionNotification: no new/updated slots to send for integration #{$integration->id}.");
            return false;
        }

        $locales = [
            'ru' => [
                'submission_title' => '📢 <b>Выполнение работы блогером!</b>',
                'project' => '📁 <b>Проект:</b>',
                'blogger' => '👤 <b>Блогер:</b>',
                'slot_number' => 'Слот',
                'total_purchased' => '📊 <b>Количество купленных слотов:</b>',
                'remaining_slots' => '⏳ <b>Оставшиеся слоты:</b>',
            ],
            'en' => [
                'submission_title' => '📢 <b>Work Performed by Blogger!</b>',
                'project' => '📁 <b>Project:</b>',
                'blogger' => '👤 <b>Blogger:</b>',
                'slot_number' => 'Slot',
                'total_purchased' => '📊 <b>Total Purchased Slots:</b>',
                'remaining_slots' => '⏳ <b>Remaining Slots:</b>',
            ],
            'uz' => [
                'submission_title' => '📢 <b>Blogger ishni bajardi!</b>',
                'project' => '📁 <b>Loyiha:</b>',
                'blogger' => '👤 <b>Blogger:</b>',
                'slot_number' => 'Slot',
                'total_purchased' => '📊 <b>Sotib olingan slotlar soni:</b>',
                'remaining_slots' => '⏳ <b>Qolgan slotlar:</b>',
            ]
        ];

        $l = isset($locales[$lang]) ? $lang : 'uz';
        $t = $locales[$l];

        $blogger = $integration->blogger_name;
        $platform = $integration->platform;
        $totalSlots = max(1, (int) ($integration->slots_count ?? 1));

        // Filter strictly to real slot_X keys so metadata keys never inflate filled count
        $filledSlots = collect($data)->filter(function ($val, $key) {
            return preg_match('/^slot_\d+$/', (string) $key) && is_string($val) && trim($val) !== '';
        });

        $filledCount = $filledSlots->count();
        $remaining = max(0, $totalSlots - $filledCount);
        $slotsConfigArr = is_array($integration->slots_config) ? $integration->slots_config : [];
        $anySent = false;

        // Loop over each newly filled/updated slot and send it as a separate message
        foreach ($filledSlots as $key => $link) {
            if ($newlyFilledKeys !== null && !in_array($key, $newlyFilledKeys, true)) {
                continue;
            }
            $slotNumber = str_replace('slot_', '', (string) $key);
            $slotNumInt = (int) $slotNumber;

            // Resolve slot config for platform name safely by explicit 'slot' key first, then index
            $slotConfig = collect($slotsConfigArr)->firstWhere('slot', $slotNumInt)
                ?? ($slotsConfigArr[$slotNumInt - 1] ?? null);
            $slotPlatform = $slotConfig['platform'] ?? $platform;

            $isScreenshot = preg_match('/^data:(\w+\/[\w.+-]+);base64,(.+)$/', $link, $matches);

            $projectName = $integration->project?->name;

            $text = "{$t['submission_title']}\n\n";
            if ($projectName) {
                $text .= "{$t['project']} " . self::escape($projectName) . "\n";
            }
            $bloggerLine = self::escape($blogger);
            if (!empty($integration->blogger_page_link)) {
                $bloggerLine .= " - " . self::escape($integration->blogger_page_link);
            }
            $text .= "{$t['blogger']} {$bloggerLine}\n";

            if ($isScreenshot) {
                $text .= "  • <b>{$t['slot_number']} #{$slotNumber} (" . self::escape($slotPlatform) . "):</b> [Screenshot Proof] 🖼️\n\n";
            } else {
                $text .= "  • <b>{$t['slot_number']} #{$slotNumber} (" . self::escape($slotPlatform) . "):</b> " . self::escape($link) . "\n\n";
            }

            $text .= "{$t['total_purchased']} {$totalSlots}\n";
            $text .= "{$t['remaining_slots']} {$remaining}\n";

            foreach ($destinations as $dest) {
                $chatId = (string) $dest['chat_id'];
                $threadId = $dest['thread_id'];
                $isPrimary = $dest['is_primary'] ?? false;

                try {
                    $responseJson = null;
                    $effectiveChatId = $chatId;
                    $effectiveThreadId = $threadId;

                    if ($isScreenshot) {
                        $mimeType = strtolower($matches[1] ?? 'image/jpeg');
                        $ext = str_contains($mimeType, 'png') ? 'png' : (str_contains($mimeType, 'webp') ? 'webp' : 'jpg');
                        $binaryData = base64_decode($matches[2]);
                        $photoResult = self::sendPhotoWithRetries(
                            $token,
                            $chatId,
                            $threadId,
                            $binaryData ?: '',
                            "screenshot_{$slotNumber}.{$ext}",
                            $mimeType,
                            $text
                        );
                        $responseJson = $photoResult['response'];
                        $effectiveChatId = $photoResult['chat_id'];
                        $effectiveThreadId = $photoResult['thread_id'];

                        if (!$responseJson) {
                            Log::error("Telegram sendPhoto failed for submission {$key}, falling back to sendMessage");
                            $responseJson = self::sendMessage($effectiveChatId, $text, $effectiveThreadId);
                        }
                    } else {
                        $options = [];
                        $cleanLink = trim($link);
                        $targetUrl = $cleanLink;
                        if (!preg_match('~^https?://~i', $targetUrl)) {
                            $targetUrl = 'https://' . $targetUrl;
                        }
                        if (filter_var($targetUrl, FILTER_VALIDATE_URL)) {
                            $options['link_preview_options'] = [
                                'url' => $targetUrl,
                                'prefer_large_media' => true,
                            ];
                        }

                        $responseJson = self::sendMessage($chatId, $text, $threadId, $options);
                    }

                    if ($responseJson) {
                        $anySent = true;
                        $tgMessageUrl = self::buildTelegramMessageUrl($responseJson, $effectiveChatId, $effectiveThreadId);
                        if ($tgMessageUrl) {
                            $urlField = $isPrimary ? "{$key}_tg_url" : "{$key}_duplicate_tg_url";
                            try {
                                $sub = \App\Models\BloggerSubmission::where('integration_id', $integration->id)->first();
                                if ($sub) {
                                    $subData = $sub->data ?? [];
                                    $subData[$urlField] = $tgMessageUrl;
                                    $sub->updateQuietly(['data' => $subData]);
                                    Log::info("Saved {$urlField} for {$key}: {$tgMessageUrl}");
                                }
                            } catch (\Throwable $ex) {
                                Log::error("Failed to save {$urlField} to submission: " . $ex->getMessage());
                            }
                        }
                        if (!$isPrimary) {
                            Log::info("Sent duplicate submission notification for {$key} to project chat {$effectiveChatId}");
                        }
                    } else {
                        Log::warning("Failed to deliver submission notification for {$key} to chat {$chatId}");
                    }
                } catch (\Throwable $exDest) {
                    Log::error("Error sending submission notification for {$key} to chat {$chatId}: " . $exDest->getMessage());
                }
            }
        }

        return $anySent;
    }

    public static function sendRequisitesNotification($integration, $requisites, $lang = 'uz')
    {
        $chatId = config('services.telegram.requisites_chat_id')
            ?: config('services.telegram.submissions_chat_id')
            ?: config('services.telegram.chat_id');
        if (!$chatId)
            return false;

        $threadId = self::parseThreadId(
            config('services.telegram.requisites_thread_id')
            ?: ($integration->project?->telegram_thread_id ?? null)
        );

        $projectName = $integration->project?->name ?? ($requisites['projectName'] ?? '—');
        $bloggerName = self::escape($integration->blogger_name ?? $requisites['bloggerName'] ?? '—');
        $fullName = self::escape($requisites['fullName'] ?? '—');
        $card = self::escape($requisites['cardNumberOrIban'] ?? '—');
        $taxStatus = ($requisites['taxStatus'] ?? '') === 'contract' ? 'Договор (самозанятый/ИП)' : 'Прямой перевод на карту';
        $phone = self::escape($requisites['phone'] ?? '—');

        $text = "💳 <b>Получены реквизиты блогера!</b>\n\n";
        if (!empty($projectName) && $projectName !== '—') {
            $text .= "📁 <b>Проект:</b> " . self::escape($projectName) . "\n";
        }
        $text .= "👤 <b>Блогер:</b> {$bloggerName}\n";
        $text .= "📝 <b>Формат:</b> {$taxStatus}\n";
        $text .= "📋 <b>ФИО:</b> {$fullName}\n";
        $text .= "💳 <b>Карта / Счёт:</b> <code>{$card}</code>\n";
        if (!empty($requisites['pinflOrTin'])) {
            $text .= "🆔 <b>ПИНФЛ / ИНН:</b> <code>" . self::escape($requisites['pinflOrTin']) . "</code>\n";
        }
        if (!empty($requisites['passportSeriesNumber'])) {
            $text .= "📄 <b>Паспорт:</b> <code>" . self::escape($requisites['passportSeriesNumber']) . "</code>\n";
        }
        if (!empty($requisites['phone'])) {
            $text .= "📞 <b>Телефон:</b> {$phone}\n";
        }
        if (!empty($requisites['telegramHandle'])) {
            $handle = ltrim($requisites['telegramHandle'], '@');
            $text .= "✈️ <b>Telegram:</b> @{$handle}\n";
        }
        if (!empty($requisites['bankName'])) {
            $text .= "🏦 <b>Банк:</b> " . self::escape($requisites['bankName']) . "\n";
        }
        if (!empty($requisites['mfo'])) {
            $text .= "🏛 <b>МФО:</b> <code>" . self::escape($requisites['mfo']) . "</code>\n";
        }
        if (!empty($requisites['bankInn'])) {
            $text .= "🏢 <b>ИНН банка:</b> <code>" . self::escape($requisites['bankInn']) . "</code>\n";
        }
        if (!empty($requisites['transitAccount'])) {
            $text .= "🔢 <b>Транзитный счёт:</b> <code>" . self::escape($requisites['transitAccount']) . "</code>\n";
        }
        if (!empty($requisites['recipientName']) && $requisites['recipientName'] !== ($requisites['fullName'] ?? '')) {
            $text .= "👤 <b>Получатель:</b> " . self::escape($requisites['recipientName']) . "\n";
        }
        if (!empty($requisites['registrationAddress'])) {
            $text .= "📍 <b>Адрес:</b> " . self::escape($requisites['registrationAddress']) . "\n";
        }

        // Parse passport front and back scans
        $scans = [];
        $rawScans = [
            ['data' => $requisites['passportFrontScan'] ?? null, 'filename' => 'passport_front', 'label' => 'Лицевая сторона'],
            ['data' => $requisites['passportBackScan'] ?? null, 'filename' => 'passport_back', 'label' => 'Обратная сторона'],
        ];

        foreach ($rawScans as $idx => $scanItem) {
            $raw = $scanItem['data'];
            if (!empty($raw) && is_string($raw)) {
                if (preg_match('/^data:(\w+\/[\w\.\-]+);base64,(.+)$/', $raw, $matches)) {
                    $mime = strtolower($matches[1]);
                    $binary = base64_decode($matches[2]);
                    $ext = str_contains($mime, 'pdf') ? 'pdf' : (str_contains($mime, 'png') ? 'png' : 'jpg');
                    $scans[] = [
                        'mime' => $mime,
                        'binary' => $binary,
                        'isPdf' => str_contains($mime, 'pdf'),
                        'filename' => $scanItem['filename'] . '.' . $ext,
                        'label' => $scanItem['label'],
                    ];
                } elseif (strlen($raw) > 50 && !str_starts_with($raw, 'http')) {
                    // Raw base64 string
                    $binary = base64_decode($raw);
                    if ($binary !== false) {
                        $scans[] = [
                            'mime' => 'image/jpeg',
                            'binary' => $binary,
                            'isPdf' => false,
                            'filename' => $scanItem['filename'] . '.jpg',
                            'label' => $scanItem['label'],
                        ];
                    }
                }
            }
        }

        $token = config('services.telegram.bot_token');

        // If we have photos and token is configured, send them
        if (!empty($scans) && $token) {
            try {
                $hasPdf = false;
                foreach ($scans as $s) {
                    if ($s['isPdf']) {
                        $hasPdf = true;
                        break;
                    }
                }

                // If all scans are photos (not PDF)
                if (!$hasPdf) {
                    $mediaGroupItems = [];
                    foreach ($scans as $idx => $s) {
                        $mediaGroupItems[] = [
                            'binary' => $s['binary'],
                            'filename' => $s['filename'],
                            'ext' => pathinfo($s['filename'], PATHINFO_EXTENSION) ?: 'jpg',
                            'mimeType' => 'image/jpeg',
                        ];
                    }

                    if (count($mediaGroupItems) >= 2) {
                        $res = self::sendMediaGroup($chatId, $mediaGroupItems, $text, $threadId, true);
                        if ($res) {
                            return true;
                        }
                    } elseif (count($mediaGroupItems) === 1) {
                        $s = $scans[0];
                        $useHtml = (mb_strlen($text, 'UTF-8') <= 1024);
                        $safeCaption = $useHtml ? $text : (mb_substr(strip_tags($text), 0, 1020, 'UTF-8') . '…');
                        $pParams = [
                            'chat_id' => $chatId,
                            'caption' => $safeCaption,
                        ];
                        if ($useHtml) {
                            $pParams['parse_mode'] = 'HTML';
                        }
                        if ($threadId) {
                            $pParams['message_thread_id'] = $threadId;
                        }
                        $res = self::httpClient(20)->attach('photo', $s['binary'], $s['filename'], ['Content-Type' => 'image/jpeg'])
                            ->post("https://api.telegram.org/bot{$token}/sendPhoto", $pParams);
                        if ($res->successful()) {
                            return true;
                        }
                    }

                    Log::warning('Telegram sendMediaGroup for requisites failed, falling back to text + photos');
                }

                // Fallback or PDF: send text message first
                self::sendMessage($chatId, $text, $threadId);

                // Then send each document/scan
                foreach ($scans as $s) {
                    $endpoint = $s['isPdf'] ? 'sendDocument' : 'sendPhoto';
                    $field = $s['isPdf'] ? 'document' : 'photo';
                    $fileParams = [
                        'chat_id' => $chatId,
                        'caption' => '📄 ' . $s['label'],
                    ];
                    if ($threadId) {
                        $fileParams['message_thread_id'] = $threadId;
                    }

                    self::httpClient(20)->attach($field, $s['binary'], $s['filename'])
                        ->post("https://api.telegram.org/bot{$token}/{$endpoint}", $fileParams);
                }

                return true;
            } catch (\Throwable $e) {
                Log::error('Telegram sendRequisitesNotification photos exception: ' . $e->getMessage());
            }
        }

        // Default: send text message if no photos or photo sending failed
        return self::sendMessage($chatId, $text, $threadId);
    }

    public static function getBotInfo(): ?array
    {
        $token = config('services.telegram.bot_token');
        if (!$token)
            return null;

        return \Illuminate\Support\Facades\Cache::remember('telegram_bot_info', 86400, function () use ($token) {
            try {
                $res = Http::timeout(5)->get("https://api.telegram.org/bot{$token}/getMe");
                if ($res->successful() && isset($res['result'])) {
                    return $res['result'];
                }
            } catch (\Throwable $e) {
                Log::warning('Telegram getMe error: ' . $e->getMessage());
            }
            return null;
        });
    }

    public static function getBotUsername(): ?string
    {
        $info = self::getBotInfo();
        return $info['username'] ?? null;
    }

    public static function getBloggerChatUrl($integrationId, $token = null): string
    {
        $botUsername = self::getBotUsername() ?? 'bot';
        $payload = $integrationId ? "deal_{$integrationId}" : ($token ? "token_{$token}" : '');
        return "https://t.me/{$botUsername}" . ($payload ? "?start={$payload}" : '');
    }

    public static function setWebhook($webhookUrl): array
    {
        $token = config('services.telegram.bot_token');
        if (!$token) {
            return ['ok' => false, 'description' => 'Bot token not set'];
        }
        try {
            $res = Http::post("https://api.telegram.org/bot{$token}/setWebhook", [
                'url' => $webhookUrl,
                'allowed_updates' => ['message', 'edited_message', 'callback_query'],
            ]);
            return $res->json() ?? ['ok' => false, 'description' => 'Invalid JSON'];
        } catch (\Throwable $e) {
            return ['ok' => false, 'description' => $e->getMessage()];
        }
    }

    public static function getWebhookInfo(): array
    {
        $token = config('services.telegram.bot_token');
        if (!$token) {
            return ['ok' => false, 'description' => 'Bot token not set'];
        }
        try {
            $res = Http::get("https://api.telegram.org/bot{$token}/getWebhookInfo");
            return $res->json() ?? ['ok' => false, 'description' => 'Invalid JSON'];
        } catch (\Throwable $e) {
            return ['ok' => false, 'description' => $e->getMessage()];
        }
    }
}

