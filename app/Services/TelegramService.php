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

    public static function buildTelegramMessageUrl($resData, $fallbackChatId = null)
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

        $chatIdStr = (string)$chatId;
        if (str_starts_with($chatIdStr, '-100')) {
            $cleanChatId = substr($chatIdStr, 4);
            return "https://t.me/c/{$cleanChatId}/{$messageId}";
        } elseif (str_starts_with($chatIdStr, '-')) {
            $cleanChatId = substr($chatIdStr, 1);
            return "https://t.me/c/{$cleanChatId}/{$messageId}";
        } else {
            return "https://t.me/c/{$chatIdStr}/{$messageId}";
        }
    }

    public static function parseThreadId($rawThreadId): ?int
    {
        if (blank($rawThreadId)) {
            return null;
        }
        if (is_numeric($rawThreadId)) {
            return (int) $rawThreadId;
        }
        if (is_string($rawThreadId) && preg_match('/\/(\d+)\/?$/', trim($rawThreadId), $matches)) {
            return (int) $matches[1];
        }
        return null;
    }

    public static function sendMessage($chatId, $text, $threadId = null, array $options = [])
    {
        $threadId = self::parseThreadId($threadId);
        $token = config('services.telegram.bot_token');
        if (!$token || !$chatId) {
            Log::info("Telegram Bot Token or Chat ID not set. Message: \n" . $text);
            return false;
        }

        try {
            $params = [
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'HTML',
            ];
            if ($threadId) {
                $params['message_thread_id'] = $threadId;
            }
            if (!empty($options['link_preview_options'])) {
                $params['link_preview_options'] = $options['link_preview_options'];
            }

            // First attempt: try with HTML parse mode
            $response = Http::post("https://api.telegram.org/bot{$token}/sendMessage", $params);

            if ($response->successful()) {
                return $response->json();
            }

            $body = $response->body();
            $resData = json_decode($body, true);
            if (isset($resData['parameters']['migrate_to_chat_id'])) {
                $newChatId = $resData['parameters']['migrate_to_chat_id'];
                Log::info("Telegram group upgraded to supergroup. Migrating chat ID from {$chatId} to {$newChatId}");
                $params['chat_id'] = $newChatId;
                $response = Http::post("https://api.telegram.org/bot{$token}/sendMessage", $params);
                if ($response->successful()) {
                    return $response->json();
                }
                $body = $response->body();
            }

            Log::warning("Telegram HTML sendMessage failed, retrying as plain text. Error: " . $body);

            // Second attempt: strip HTML tags and send as plain text (no parse_mode)
            $plainText = strip_tags($text);
            $plainParams = [
                'chat_id' => $params['chat_id'],
                'text' => $plainText,
            ];
            if ($threadId) {
                $plainParams['message_thread_id'] = $threadId;
            }
            if (!empty($options['link_preview_options'])) {
                $plainParams['link_preview_options'] = $options['link_preview_options'];
            }

            $response2 = Http::post("https://api.telegram.org/bot{$token}/sendMessage", $plainParams);

            if ($response2->successful()) {
                return $response2->json();
            }

            $body2 = $response2->body();
            $resData2 = json_decode($body2, true);
            if (isset($resData2['parameters']['migrate_to_chat_id'])) {
                $newChatId = $resData2['parameters']['migrate_to_chat_id'];
                Log::info("Telegram group upgraded to supergroup. Migrating chat ID from {$plainParams['chat_id']} to {$newChatId}");
                $plainParams['chat_id'] = $newChatId;
                $response2 = Http::post("https://api.telegram.org/bot{$token}/sendMessage", $plainParams);
                if ($response2->successful()) {
                    return $response2->json();
                }
                $body2 = $response2->body();
            }

            Log::error("Telegram API Error (both HTML and plain): " . $body2);
            return false;
        } catch (\Throwable $e) {
            Log::error("Telegram exception: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Sends an album of photos (media group) to Telegram with robust error handling,
     * UTF-8 multibyte safety, HTML parse-error retry, and chat migration handling.
     */
    public static function sendMediaGroup($chatId, array $items, ?string $caption = null, $threadId = null, bool $useHtml = true)
    {
        $token = config('services.telegram.bot_token');
        if (!$token || !$chatId || empty($items)) {
            Log::info("Telegram Bot Token or Chat ID not set or empty items for sendMediaGroup.");
            return false;
        }

        $threadId = self::parseThreadId($threadId);

        $doRequest = function ($targetChatId, $targetCaption, $targetUseHtml) use ($token, $items, $threadId) {
            $media = [];
            $httpReq = Http::asMultipart();

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
            if ($threadId) {
                $mediaParams['message_thread_id'] = $threadId;
            }

            return $httpReq->post("https://api.telegram.org/bot{$token}/sendMediaGroup", $mediaParams);
        };

        // Caption safety check (Telegram media caption limit is 1024 UTF-8 characters)
        $safeCaption = null;
        if (!blank($caption)) {
            if (mb_strlen($caption, 'UTF-8') > 1024) {
                $safeCaption = mb_substr(strip_tags($caption), 0, 1020, 'UTF-8') . '…';
                $useHtml = false; // Truncation breaks HTML tags, so use plain text
            } else {
                $safeCaption = $caption;
            }
        }

        // 1st attempt: requested mode (usually HTML)
        $response = $doRequest($chatId, $safeCaption, $useHtml);
        if ($response->successful()) {
            return $response->json();
        }

        $body = $response->body();
        $resData = json_decode($body, true);

        // Handle supergroup migration
        if (isset($resData['parameters']['migrate_to_chat_id'])) {
            $chatId = $resData['parameters']['migrate_to_chat_id'];
            Log::info("Telegram group upgraded to supergroup. Migrating chat ID to {$chatId}");
            $response = $doRequest($chatId, $safeCaption, $useHtml);
            if ($response->successful()) {
                return $response->json();
            }
            $body = $response->body();
            $resData = json_decode($body, true);
        }

        // 2nd attempt: If HTML failed (e.g. invalid entities, unclosed tags), retry with plain text (strip_tags)
        if ($useHtml && !blank($caption)) {
            Log::warning("Telegram sendMediaGroup HTML failed ({$body}), retrying as plain text caption");
            $plainCaption = strip_tags($caption);
            if (mb_strlen($plainCaption, 'UTF-8') > 1024) {
                $plainCaption = mb_substr($plainCaption, 0, 1020, 'UTF-8') . '…';
            }

            $retryRes = $doRequest($chatId, $plainCaption, false);
            if ($retryRes->successful()) {
                return $retryRes->json();
            }

            $retryBody = $retryRes->body();
            $retryData = json_decode($retryBody, true);
            if (isset($retryData['parameters']['migrate_to_chat_id'])) {
                $chatId = $retryData['parameters']['migrate_to_chat_id'];
                $retryRes2 = $doRequest($chatId, $plainCaption, false);
                if ($retryRes2->successful()) {
                    return $retryRes2->json();
                }
                $retryBody = $retryRes2->body();
            }
            Log::warning("Telegram sendMediaGroup plain retry failed: " . $retryBody);
        } else {
            Log::warning("Telegram sendMediaGroup failed: " . $body);
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
            $text .= "{$t['report_id']} #{$report->id}\n";
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
        $chatId = config('services.telegram.reports_chat_id');
        if (!$chatId) {
            $chatId = config('services.telegram.chat_id'); // fallback
        }

        $text = self::buildReportNotificationText($report, $lang, $createdByName, false);
        $threadId = self::parseThreadId($report->project?->telegram_thread_id ?? null);

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
                // Strictly exclude PDFs and non-image files: only photo/image formats are sent to Telegram
                if (!str_starts_with($mimeType, 'image/')) {
                    continue;
                }
                $ext = 'jpg';
                if (str_contains($mimeType, 'png')) $ext = 'png';
                elseif (str_contains($mimeType, 'webp')) $ext = 'webp';
                elseif (str_contains($mimeType, 'jpeg')) $ext = 'jpg';

                $parsedReceipts[] = [
                    'mimeType' => $mimeType,
                    'binary' => base64_decode($matches[2]),
                    'ext' => $ext,
                ];
            }
        }

        // If a single Base64 photo is provided, send it as photo directly
        if (count($parsedReceipts) === 1) {
            $receiptItem = $parsedReceipts[0];
            $binaryData = $receiptItem['binary'];
            $ext = $receiptItem['ext'] ?? 'jpg';
            $mimeType = $receiptItem['mimeType'] ?? 'image/jpeg';
            $filename = "receipt.{$ext}";

            $token = config('services.telegram.bot_token');
            if ($token && $chatId) {
                try {
                    $useHtml = (mb_strlen($text, 'UTF-8') <= 1024);
                    $safeCaption = $useHtml
                        ? $text
                        : (mb_substr(strip_tags($text), 0, 1020, 'UTF-8') . '…');

                    $sendSingle = function ($targetChatId, $captionText, $htmlMode) use ($token, $binaryData, $filename, $mimeType, $threadId) {
                        $pParams = [
                            'chat_id' => $targetChatId,
                            'caption' => $captionText,
                        ];
                        if ($htmlMode) {
                            $pParams['parse_mode'] = 'HTML';
                        }
                        if ($threadId) {
                            $pParams['message_thread_id'] = $threadId;
                        }
                        return Http::attach('photo', $binaryData, $filename, ['Content-Type' => $mimeType])
                            ->post("https://api.telegram.org/bot{$token}/sendPhoto", $pParams);
                    };

                    $response = $sendSingle($chatId, $safeCaption, $useHtml);
                    if ($response->successful()) {
                        self::recordReportTelegramUrl($report, $response->json(), $chatId);
                        return true;
                    }

                    $body = $response->body();
                    $resData = json_decode($body, true);
                    if (isset($resData['parameters']['migrate_to_chat_id'])) {
                        $chatId = $resData['parameters']['migrate_to_chat_id'];
                        Log::info("Telegram group upgraded to supergroup. Migrating chat ID from {$chatId} to {$chatId}");
                        $response = $sendSingle($chatId, $safeCaption, $useHtml);
                        if ($response->successful()) {
                            self::recordReportTelegramUrl($report, $response->json(), $chatId);
                            return true;
                        }
                        $body = $response->body();
                        $resData = json_decode($body, true);
                    }

                    // Retry with plain text caption if HTML mode failed
                    if ($useHtml) {
                        Log::warning("Telegram sendPhoto HTML failed, retrying plain: " . $body);
                        $plainCaption = mb_strlen(strip_tags($text), 'UTF-8') > 1024
                            ? mb_substr(strip_tags($text), 0, 1020, 'UTF-8') . '…'
                            : strip_tags($text);

                        $retryResponse = $sendSingle($chatId, $plainCaption, false);
                        if ($retryResponse->successful()) {
                            self::recordReportTelegramUrl($report, $retryResponse->json(), $chatId);
                            return true;
                        }

                        $retryBody = $retryResponse->body();
                        $retryData = json_decode($retryBody, true);
                        if (isset($retryData['parameters']['migrate_to_chat_id'])) {
                            $chatId = $retryData['parameters']['migrate_to_chat_id'];
                            $retryResponse2 = $sendSingle($chatId, $plainCaption, false);
                            if ($retryResponse2->successful()) {
                                self::recordReportTelegramUrl($report, $retryResponse2->json(), $chatId);
                                return true;
                            }
                        }
                    }

                    // Fallback only if photo sending failed completely: send text first, then photo
                    $msgRes = self::sendMessage($chatId, $text, $threadId);
                    self::recordReportTelegramUrl($report, $msgRes, $chatId);

                    $fallbackParams = [
                        'chat_id' => $chatId,
                        'caption' => '📎 Чек/Скриншот оплаты',
                    ];
                    if ($threadId) {
                        $fallbackParams['message_thread_id'] = $threadId;
                    }

                    Http::attach('photo', $binaryData, $filename, ['Content-Type' => $mimeType])
                        ->post("https://api.telegram.org/bot{$token}/sendPhoto", $fallbackParams);
                    return true;
                } catch (\Throwable $e) {
                    Log::error("Telegram sendPhoto Exception: " . $e->getMessage());
                }
            }
        }

        // If multiple Base64 photo receipts are provided, send as a combined album (sendMediaGroup)
        if (count($parsedReceipts) > 1) {
            $token = config('services.telegram.bot_token');
            if ($token && $chatId) {
                try {
                    // Chunk photos into albums of up to 10 photos (Telegram allows 2-10 items per album)
                    $chunks = array_chunk($parsedReceipts, 10);
                    $firstResult = null;

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
                        } else {
                            // If exactly 1 photo in this chunk (e.g. 11th photo)
                            $single = $chunk[0];
                            $singleExt = $single['ext'] ?? 'jpg';
                            $singleMime = $single['mimeType'] ?? 'image/jpeg';
                            $pParams = [
                                'chat_id' => $chatId,
                                'caption' => $chunkCaption,
                            ];
                            if ($threadId) {
                                $pParams['message_thread_id'] = $threadId;
                            }
                            $singleRes = Http::attach('photo', $single['binary'], "receipt_extra.{$singleExt}", ['Content-Type' => $singleMime])
                                ->post("https://api.telegram.org/bot{$token}/sendPhoto", $pParams);
                            $res = $singleRes->successful() ? $singleRes->json() : false;
                        }

                        if ($chunkIdx === 0) {
                            $firstResult = $res;
                        }
                    }

                    if ($firstResult) {
                        self::recordReportTelegramUrl($report, $firstResult, $chatId);
                        return true;
                    }

                    Log::warning("Telegram sendMediaGroup failed, falling back to individual messages");

                    // Fallback only if media group failed completely
                    $msgRes = self::sendMessage($chatId, $text, $threadId);
                    self::recordReportTelegramUrl($report, $msgRes, $chatId);

                    foreach ($parsedReceipts as $idx => $item) {
                        $ext = $item['ext'] ?? 'jpg';
                        $mimeType = $item['mimeType'] ?? 'image/jpeg';
                        $filename = "receipt_" . ($idx + 1) . ".{$ext}";
                        $params = [
                            'chat_id' => $chatId,
                            'caption' => '📎 Чек ' . ($idx + 1) . ' из ' . count($parsedReceipts),
                        ];
                        if ($threadId) {
                            $params['message_thread_id'] = $threadId;
                        }
                        Http::attach('photo', $item['binary'], $filename, ['Content-Type' => $mimeType])
                            ->post("https://api.telegram.org/bot{$token}/sendPhoto", $params);
                    }
                    return true;
                } catch (\Throwable $e) {
                    Log::error("Telegram multi-photo send Exception: " . $e->getMessage());
                }
            }
        }

        $msgRes = self::sendMessage($chatId, $text, $threadId);
        if ($msgRes) {
            self::recordReportTelegramUrl($report, $msgRes, $chatId);
            return true;
        }
        return false;
    }

    protected static function recordReportTelegramUrl($report, $resData, $chatId): void
    {
        if (!$report || !is_object($report) || !($report instanceof \App\Models\Report)) {
            return;
        }
        $tgUrl = self::buildTelegramMessageUrl($resData, $chatId);
        if ($tgUrl) {
            try {
                $report->update(['telegram_message_url' => $tgUrl]);
                Log::info("Saved telegram_message_url for report #{$report->id}: {$tgUrl}");
            } catch (\Throwable $e) {
                Log::error("Failed to save telegram_message_url for report #{$report->id}: " . $e->getMessage());
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

        // Pattern 1: https://t.me/c/4329107459/123
        if (preg_match('#(?:https?://)?t\.me/c/(\d+)/(\d+)#', $url, $matches)) {
            $cleanChatId = $matches[1];
            $messageId = (int)$matches[2];

            $chatId = '-100' . $cleanChatId;

            $defaultChatId = (string)(config('services.telegram.reports_chat_id') ?: config('services.telegram.chat_id'));
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
                'message_id' => $messageId,
            ];
        }

        // Pattern 2: https://t.me/channel_name/123
        if (preg_match('#(?:https?://)?t\.me/([a-zA-Z0-9_]+)/(\d+)#', $url, $matches)) {
            return [
                'chat_id' => '@' . $matches[1],
                'message_id' => (int)$matches[2],
            ];
        }

        return null;
    }

    public static function deleteReportNotification($report): bool
    {
        $identifiers = self::extractMessageIdentifiers($report);
        if (!$identifiers) {
            Log::info("deleteReportNotification: No telegram message identifiers found for report #" . ($report->id ?? 'unknown'));
            return false;
        }

        $token = config('services.telegram.bot_token');
        if (!$token) {
            Log::warning("deleteReportNotification: Telegram Bot Token not set.");
            return false;
        }

        try {
            $chatId = $identifiers['chat_id'];
            $messageId = $identifiers['message_id'];

            $response = Http::post("https://api.telegram.org/bot{$token}/deleteMessage", [
                'chat_id' => $chatId,
                'message_id' => $messageId,
            ]);

            if ($response->successful()) {
                Log::info("Deleted telegram message {$messageId} in chat {$chatId} for report #" . ($report->id ?? 'unknown'));
                return true;
            }

            $body = $response->body();
            $resData = json_decode($body, true);
            if (isset($resData['parameters']['migrate_to_chat_id'])) {
                $newChatId = $resData['parameters']['migrate_to_chat_id'];
                $response2 = Http::post("https://api.telegram.org/bot{$token}/deleteMessage", [
                    'chat_id' => $newChatId,
                    'message_id' => $messageId,
                ]);
                if ($response2->successful() || str_contains($response2->body(), 'message to delete not found')) {
                    return true;
                }
            }

            if (str_contains($body, 'message to delete not found')) {
                Log::info("Telegram message {$messageId} in chat {$chatId} was already deleted.");
                return true;
            }

            Log::warning("Failed to delete telegram message {$messageId} in chat {$chatId}: {$body}");
            return false;
        } catch (\Throwable $e) {
            Log::error("Telegram deleteReportNotification exception: " . $e->getMessage());
            return false;
        }
    }

    public static function updateReportNotification($report, $lang = 'uz', $createdByName = null): bool
    {
        $identifiers = self::extractMessageIdentifiers($report);
        if (!$identifiers) {
            Log::info("updateReportNotification: No telegram message identifiers found for report #" . ($report->id ?? 'unknown'));
            return false;
        }

        $token = config('services.telegram.bot_token');
        if (!$token) {
            Log::warning("updateReportNotification: Telegram Bot Token not set.");
            return false;
        }

        if (!$report->relationLoaded('project')) {
            $report->load('project');
        }

        $text = self::buildReportNotificationText($report, $lang, $createdByName, true);
        $chatId = $identifiers['chat_id'];
        $messageId = $identifiers['message_id'];

        $safeCaption = mb_strlen($text) > 1024 ? mb_substr(strip_tags($text), 0, 1020) . '...' : $text;

        try {
            // First attempt: editMessageCaption (for photo/document media messages)
            $response = Http::post("https://api.telegram.org/bot{$token}/editMessageCaption", [
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'caption' => $safeCaption,
                'parse_mode' => 'HTML',
            ]);

            if ($response->successful()) {
                Log::info("Updated Telegram message caption for report #{$report->id}");
                return true;
            }

            $body = $response->body();
            if (str_contains($body, 'message is not modified')) {
                return true;
            }

            $resData = json_decode($body, true);
            if (isset($resData['parameters']['migrate_to_chat_id'])) {
                $chatId = $resData['parameters']['migrate_to_chat_id'];
                $response = Http::post("https://api.telegram.org/bot{$token}/editMessageCaption", [
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
                $retryCaption = Http::post("https://api.telegram.org/bot{$token}/editMessageCaption", [
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                    'caption' => strip_tags($safeCaption),
                ]);
                if ($retryCaption->successful() || str_contains($retryCaption->body(), 'message is not modified')) {
                    return true;
                }
            }

            // Second attempt: editMessageText (for plain text messages)
            $textResponse = Http::post("https://api.telegram.org/bot{$token}/editMessageText", [
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => $text,
                'parse_mode' => 'HTML',
            ]);

            if ($textResponse->successful() || str_contains($textResponse->body(), 'message is not modified')) {
                Log::info("Updated Telegram message text for report #{$report->id}");
                return true;
            }

            $textBody = $textResponse->body();
            if (str_contains($textBody, 'can\'t parse entities') || str_contains($textBody, 'failed to find end tag')) {
                $retryText = Http::post("https://api.telegram.org/bot{$token}/editMessageText", [
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                    'text' => strip_tags($text),
                ]);
                if ($retryText->successful() || str_contains($retryText->body(), 'message is not modified')) {
                    return true;
                }
            }

            Log::warning("Failed to update telegram message for report #{$report->id}: Caption error: {$body} | Text error: {$textBody}");
            return false;
        } catch (\Throwable $e) {
            Log::error("Telegram updateReportNotification Exception for report #{$report->id}: " . $e->getMessage());
            return false;
        }
    }

    public static function sendSubmissionNotification($integration, $data, $lang = 'uz', $newlyFilledKeys = null)
    {
        $chatId = config('services.telegram.submissions_chat_id');
        if (!$chatId) {
            $chatId = config('services.telegram.chat_id'); // fallback
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
        $totalSlots = $integration->slots_count;

        // Filter and compile filled slots
        $filledSlots = collect($data)->filter(function($val) {
            return is_string($val) && trim($val) !== '';
        });

        $filledCount = $filledSlots->count();
        $remaining = max(0, $totalSlots - $filledCount);
        $token = config('services.telegram.bot_token');

        if (!$token || !$chatId) {
            Log::info("Telegram Bot Token or Chat ID not set for submissions.");
            return false;
        }

        $threadId = self::parseThreadId($integration->project?->telegram_thread_id ?? null);

        // Loop over each slot and send it as a separate message
        foreach ($filledSlots as $key => $link) {
            if ($newlyFilledKeys !== null && !in_array($key, $newlyFilledKeys)) {
                continue;
            }
            $slotNumber = str_replace('slot_', '', $key);

            // Resolve slot config for platform name
            $slotConfig = $integration->slots_config[$slotNumber - 1] ?? null;
            $slotPlatform = $slotConfig['platform'] ?? $platform;

            $isScreenshot = preg_match('/^data:(\w+\/\w+);base64,(.+)$/', $link, $matches);

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
                $text .= "  • <b>{$t['slot_number']} #{$slotNumber} ({$slotPlatform}):</b> [Screenshot Proof] 🖼️\n\n";
            } else {
                $text .= "  • <b>{$t['slot_number']} #{$slotNumber} ({$slotPlatform}):</b> " . self::escape($link) . "\n\n";
            }

            $text .= "{$t['total_purchased']} {$totalSlots}\n";
            $text .= "{$t['remaining_slots']} {$remaining}\n";

            $responseJson = null;

            if ($isScreenshot) {
                try {
                    $base64Data = $matches[2];
                    $binaryData = base64_decode($base64Data);
                    $safeCaption = strlen($text) > 1024 ? substr(strip_tags($text), 0, 1021) . '...' : $text;

                    $photoParams = [
                        'chat_id' => $chatId,
                        'caption' => $safeCaption,
                        'parse_mode' => 'HTML',
                    ];
                    if ($threadId) {
                        $photoParams['message_thread_id'] = $threadId;
                    }

                    $response = Http::attach('photo', $binaryData, "screenshot_{$slotNumber}.jpg")
                        ->post("https://api.telegram.org/bot{$token}/sendPhoto", $photoParams);

                    if ($response->successful()) {
                        $responseJson = $response->json();
                    } else {
                        $body = $response->body();
                        $resData = json_decode($body, true);
                        if (isset($resData['parameters']['migrate_to_chat_id'])) {
                            $newChatId = $resData['parameters']['migrate_to_chat_id'];
                            Log::info("Telegram group upgraded to supergroup. Migrating chat ID from {$chatId} to {$newChatId}");
                            $chatId = $newChatId;
                            $photoParams['chat_id'] = $newChatId;
                            $response = Http::attach('photo', $binaryData, "screenshot_{$slotNumber}.jpg")
                                ->post("https://api.telegram.org/bot{$token}/sendPhoto", $photoParams);
                            if ($response->successful()) {
                                $responseJson = $response->json();
                            } else {
                                $body = $response->body();
                            }
                        }

                        if (!$responseJson) {
                            Log::error("Telegram sendPhoto failed, retrying plain text: " . $body);
                            $responseJson = self::sendMessage($chatId, $text, $threadId);
                        }
                    }
                } catch (\Throwable $e) {
                    Log::error("Telegram sendPhoto exception: " . $e->getMessage());
                    $responseJson = self::sendMessage($chatId, $text, $threadId);
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
                $tgMessageUrl = self::buildTelegramMessageUrl($responseJson, $chatId);
                if ($tgMessageUrl) {
                    try {
                        $sub = \App\Models\BloggerSubmission::where('integration_id', $integration->id)->first();
                        if ($sub) {
                            $subData = $sub->data ?? [];
                            $subData["{$key}_tg_url"] = $tgMessageUrl;
                            $sub->update(['data' => $subData]);
                            Log::info("Saved telegram message url for {$key}: {$tgMessageUrl}");
                        }
                    } catch (\Throwable $ex) {
                        Log::error("Failed to save tg_url to submission: " . $ex->getMessage());
                    }
                }
            }
        }

        return true;
    }

    public static function sendRequisitesNotification($integration, $requisites, $lang = 'uz')
    {
        $chatId = config('services.telegram.requisites_chat_id')
            ?: config('services.telegram.submissions_chat_id')
            ?: config('services.telegram.chat_id');
        if (!$chatId) return false;

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
                        $res = Http::attach('photo', $s['binary'], $s['filename'], ['Content-Type' => 'image/jpeg'])
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

                    Http::attach($field, $s['binary'], $s['filename'])
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
        if (!$token) return null;

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

