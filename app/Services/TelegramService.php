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
        if (!is_array($resData) || !isset($resData['result']['message_id'])) {
            return null;
        }
        $messageId = $resData['result']['message_id'];
        $chatId = $resData['result']['chat']['id'] ?? $fallbackChatId;

        if (!$chatId) {
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

    public static function sendMessage($chatId, $text, $threadId = null)
    {
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

    public static function sendReportNotification($report, $receiptBase64 = null, $lang = 'uz', $createdByName = null)
    {
        $chatId = config('services.telegram.reports_chat_id');
        if (!$chatId) {
            $chatId = config('services.telegram.chat_id'); // fallback
        }

        $locales = [
            'ru' => [
                'new_report' => '📝 <b>Создан новый отчет!</b>',
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
        $threadId = $report->project?->telegram_thread_id ?? null;

        $text = "{$t['new_report']}\n\n";
        if ($createdByName) {
            $text .= "{$t['created_by']} " . self::escape($createdByName) . "\n";
        }
        $text .= "{$t['date']} " . ($report->date ? $report->date->format('Y-m-d') : '—') . "\n";
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
                $parsedReceipts[] = [
                    'mimeType' => $matches[1],
                    'binary' => base64_decode($matches[2]),
                    'isPdf' => str_contains($matches[1], 'pdf'),
                ];
            }
        }

        // If a single Base64 receipt is provided, send it as photo or document directly
        if (count($parsedReceipts) === 1) {
            $receiptItem = $parsedReceipts[0];
            $mimeType = $receiptItem['mimeType'];
            $binaryData = $receiptItem['binary'];
            $isPdf = $receiptItem['isPdf'];

            $token = config('services.telegram.bot_token');
            if ($token && $chatId) {
                try {
                    $endpoint = $isPdf ? 'sendDocument' : 'sendPhoto';
                    $field = $isPdf ? 'document' : 'photo';
                    $filename = $isPdf ? 'receipt.pdf' : 'receipt.jpg';
                    $safeCaption = strlen($text) > 1024 ? substr(strip_tags($text), 0, 1021) . '...' : $text;

                    $photoParams = [
                        'chat_id' => $chatId,
                        'caption' => $safeCaption,
                        'parse_mode' => 'HTML',
                    ];
                    if ($threadId) {
                        $photoParams['message_thread_id'] = $threadId;
                    }

                    $response = Http::attach($field, $binaryData, $filename)
                        ->post("https://api.telegram.org/bot{$token}/{$endpoint}", $photoParams);

                    if ($response->successful()) {
                        return true;
                    }

                    $body = $response->body();
                    $resData = json_decode($body, true);
                    if (isset($resData['parameters']['migrate_to_chat_id'])) {
                        $newChatId = $resData['parameters']['migrate_to_chat_id'];
                        Log::info("Telegram group upgraded to supergroup. Migrating chat ID from {$chatId} to {$newChatId}");
                        $chatId = $newChatId;
                        $photoParams['chat_id'] = $newChatId;
                        $response = Http::attach($field, $binaryData, $filename)
                            ->post("https://api.telegram.org/bot{$token}/{$endpoint}", $photoParams);
                        if ($response->successful()) {
                            return true;
                        }
                        $body = $response->body();
                    }

                    Log::warning("Telegram sendPhoto/Document HTML failed, retrying plain: " . $body);

                    // Fallback: send text first, then file without caption
                    self::sendMessage($chatId, $text, $threadId);

                    $fallbackPhotoParams = [
                        'chat_id' => $chatId,
                        'caption' => '📎 Чек/Скриншот оплаты',
                    ];
                    if ($threadId) {
                        $fallbackPhotoParams['message_thread_id'] = $threadId;
                    }

                    $response2 = Http::attach($field, $binaryData, $filename)
                        ->post("https://api.telegram.org/bot{$token}/{$endpoint}", $fallbackPhotoParams);

                    if (!$response2->successful()) {
                        $body2 = $response2->body();
                        $resData2 = json_decode($body2, true);
                        if (isset($resData2['parameters']['migrate_to_chat_id'])) {
                            $newChatId = $resData2['parameters']['migrate_to_chat_id'];
                            $fallbackPhotoParams['chat_id'] = $newChatId;
                            Http::attach($field, $binaryData, $filename)
                                ->post("https://api.telegram.org/bot{$token}/{$endpoint}", $fallbackPhotoParams);
                        }
                    }
                    return true;
                } catch (\Throwable $e) {
                    Log::error("Telegram sendPhoto/Document Exception: " . $e->getMessage());
                }
            }
        }

        // If multiple Base64 receipts are provided
        if (count($parsedReceipts) > 1) {
            $token = config('services.telegram.bot_token');
            if ($token && $chatId) {
                try {
                    $hasPdf = false;
                    foreach ($parsedReceipts as $item) {
                        if ($item['isPdf']) {
                            $hasPdf = true;
                            break;
                        }
                    }

                    $safeCaption = strlen($text) > 1024 ? substr(strip_tags($text), 0, 1021) . '...' : $text;

                    // If all are photos and count <= 10, send as an album (sendMediaGroup)
                    if (!$hasPdf && count($parsedReceipts) <= 10) {
                        $media = [];
                        $httpReq = Http::asMultipart();
                        foreach ($parsedReceipts as $idx => $item) {
                            $field = "photo_{$idx}";
                            $mediaItem = [
                                'type' => 'photo',
                                'media' => "attach://{$field}",
                            ];
                            if ($idx === 0) {
                                $mediaItem['caption'] = $safeCaption;
                                $mediaItem['parse_mode'] = 'HTML';
                            }
                            $media[] = $mediaItem;
                            $httpReq->attach($field, $item['binary'], "receipt_{$idx}.jpg");
                        }

                        $mediaParams = [
                            'chat_id' => $chatId,
                            'media' => json_encode($media),
                        ];
                        if ($threadId) {
                            $mediaParams['message_thread_id'] = $threadId;
                        }

                        $response = $httpReq->post("https://api.telegram.org/bot{$token}/sendMediaGroup", $mediaParams);
                        if ($response->successful()) {
                            return true;
                        }

                        $body = $response->body();
                        $resData = json_decode($body, true);
                        if (isset($resData['parameters']['migrate_to_chat_id'])) {
                            $chatId = $resData['parameters']['migrate_to_chat_id'];
                            $mediaParams['chat_id'] = $chatId;
                            $retryRes = $httpReq->post("https://api.telegram.org/bot{$token}/sendMediaGroup", $mediaParams);
                            if ($retryRes->successful()) {
                                return true;
                            }
                        }
                        Log::warning("Telegram sendMediaGroup failed: " . $body . ", falling back to individual messages");
                    }

                    // Fallback or mixed/PDF: Send text message first
                    self::sendMessage($chatId, $text, $threadId);

                    // Then send each receipt file individually
                    foreach ($parsedReceipts as $idx => $item) {
                        $field = $item['isPdf'] ? 'document' : 'photo';
                        $endpoint = $item['isPdf'] ? 'sendDocument' : 'sendPhoto';
                        $filename = $item['isPdf'] ? "receipt_" . ($idx + 1) . ".pdf" : "receipt_" . ($idx + 1) . ".jpg";
                        $params = [
                            'chat_id' => $chatId,
                            'caption' => '📎 Чек ' . ($idx + 1) . ' из ' . count($parsedReceipts),
                        ];
                        if ($threadId) {
                            $params['message_thread_id'] = $threadId;
                        }
                        Http::attach($field, $item['binary'], $filename)
                            ->post("https://api.telegram.org/bot{$token}/{$endpoint}", $params);
                    }
                    return true;
                } catch (\Throwable $e) {
                    Log::error("Telegram multi-receipt send Exception: " . $e->getMessage());
                }
            }
        }

        return self::sendMessage($chatId, $text, $threadId);
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

        $threadId = $integration->project?->telegram_thread_id ?? null;

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
                $responseJson = self::sendMessage($chatId, $text, $threadId);
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
        $chatId = config('services.telegram.submissions_chat_id') ?: config('services.telegram.chat_id');
        if (!$chatId) return false;

        $projectName = $integration->project?->name ?? '—';
        $threadId = $integration->project?->telegram_thread_id ?? null;

        $bloggerName = self::escape($integration->blogger_name ?? '—');
        $fullName = self::escape($requisites['fullName'] ?? '—');
        $card = self::escape($requisites['cardNumberOrIban'] ?? '—');
        $pinfl = self::escape($requisites['pinflOrTin'] ?? '—');
        $taxStatus = ($requisites['taxStatus'] ?? '') === 'contract' ? 'Договор (самозанятый/ИП)' : 'Прямой перевод на карту';
        $phone = self::escape($requisites['phone'] ?? '—');

        $text = "💳 <b>Получены реквизиты блогера!</b>\n\n";
        $text .= "📁 <b>Проект:</b> " . self::escape($projectName) . "\n";
        $text .= "👤 <b>Блогер:</b> {$bloggerName}\n";
        $text .= "📝 <b>Формат:</b> {$taxStatus}\n";
        $text .= "📋 <b>ФИО:</b> {$fullName}\n";
        $text .= "💳 <b>Карта:</b> <code>{$card}</code>\n";
        if (!empty($requisites['pinflOrTin'])) {
            $text .= "🆔 <b>ПИНФЛ / ИНН:</b> <code>{$pinfl}</code>\n";
        }
        if (!empty($requisites['phone'])) {
            $text .= "📞 <b>Телефон:</b> {$phone}\n";
        }
        if (!empty($requisites['bankName'])) {
            $text .= "🏦 <b>Банк:</b> " . self::escape($requisites['bankName']) . "\n";
        }

        return self::sendMessage($chatId, $text, $threadId);
    }
}

