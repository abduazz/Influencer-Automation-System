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
                return true;
            }

            $body = $response->body();
            $resData = json_decode($body, true);
            if (isset($resData['parameters']['migrate_to_chat_id'])) {
                $newChatId = $resData['parameters']['migrate_to_chat_id'];
                Log::info("Telegram group upgraded to supergroup. Migrating chat ID from {$chatId} to {$newChatId}");
                $params['chat_id'] = $newChatId;
                $response = Http::post("https://api.telegram.org/bot{$token}/sendMessage", $params);
                if ($response->successful()) {
                    return true;
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
                return true;
            }

            $body2 = $response2->body();
            $resData2 = json_decode($body2, true);
            if (isset($resData2['parameters']['migrate_to_chat_id'])) {
                $newChatId = $resData2['parameters']['migrate_to_chat_id'];
                Log::info("Telegram group upgraded to supergroup. Migrating chat ID from {$plainParams['chat_id']} to {$newChatId}");
                $plainParams['chat_id'] = $newChatId;
                $response2 = Http::post("https://api.telegram.org/bot{$token}/sendMessage", $plainParams);
                if ($response2->successful()) {
                    return true;
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
                'payment_type' => '💳 <b>Тип оплаты:</b>',
                'blogger' => '👤 <b>Блогер:</b>',
                'platform' => '📱 <b>Платформа:</b>',
                'slots_count' => '🔢 <b>Количество слотов:</b>',
                'price_per_slot' => '💵 <b>Цена за слот:</b>',
                'total_amount' => '💰 <b>Итоговая сумма:</b>',
                'prepaid_amount' => '💳 <b>Сумма предоплаты:</b>',
                'created_by' => '✍️ <b>Создан кем:</b>',
                'prepaid' => 'Предоплата (Prepaid)',
                'full' => 'Полная оплата (Full)',
                'other' => 'Прочие расходы (Other)',
            ],
            'en' => [
                'new_report' => '📝 <b>New Report Created!</b>',
                'date' => '📅 <b>Date:</b>',
                'project' => '📂 <b>Project:</b>',
                'payment_type' => '💳 <b>Payment Type:</b>',
                'blogger' => '👤 <b>Blogger:</b>',
                'platform' => '📱 <b>Platform:</b>',
                'slots_count' => '🔢 <b>Slots Count:</b>',
                'price_per_slot' => '💵 <b>Price per Slot:</b>',
                'total_amount' => '💰 <b>Total Amount:</b>',
                'prepaid_amount' => '💳 <b>Prepayment Amount:</b>',
                'created_by' => '✍️ <b>Created by:</b>',
                'prepaid' => 'Prepayment (Prepaid)',
                'full' => 'Full Payment (Full)',
                'other' => 'Other Expenses (Other)',
            ],
            'uz' => [
                'new_report' => '📝 <b>Yangi hisobot yaratildi!</b>',
                'date' => '📅 <b>Sana:</b>',
                'project' => '📂 <b>Loyiha:</b>',
                'payment_type' => '💳 <b>To\'lov turi:</b>',
                'blogger' => '👤 <b>Blogger:</b>',
                'platform' => '📱 <b>Platforma:</b>',
                'slots_count' => '🔢 <b>Slotlar soni:</b>',
                'price_per_slot' => '💵 <b>Slot narxi:</b>',
                'total_amount' => '💰 <b>Jami summa:</b>',
                'prepaid_amount' => '💳 <b>Oldindan to\'lov summasi:</b>',
                'created_by' => '✍️ <b>Kim tomonidan yaratildi:</b>',
                'prepaid' => 'Oldindan to\'lov (Prepaid)',
                'full' => 'To\'liq to\'lov (Full)',
                'other' => 'Boshqa xarajatlar (Other)',
            ]
        ];

        // Safe fallback for language key
        $l = isset($locales[$lang]) ? $lang : 'uz';
        $t = $locales[$l];

        $paymentType = $t[$report->payment_type] ?? $report->payment_type;
        if ($report->payment_type === 'prepaid' && $report->slots_count > 0) {
            $percentage = round(($report->paid_slots_count / $report->slots_count) * 100);
            $paymentType .= " - {$percentage}%";
        }
        $projectName = $report->project?->name ?? '—';
        $threadId = $report->project?->telegram_thread_id ?? null;

        $text = "{$t['new_report']}\n\n";
        if ($createdByName) {
            $text .= "{$t['created_by']} " . self::escape($createdByName) . "\n";
        }
        $text .= "{$t['date']} " . ($report->date ? $report->date->format('Y-m-d') : '—') . "\n";
        $text .= "{$t['project']} " . self::escape($projectName) . "\n";
        $text .= "{$t['payment_type']} " . self::escape($paymentType) . "\n";

        if ($report->payment_type !== 'other') {
            $text .= "{$t['blogger']} " . self::escape($report->channel_blogger ?? '—') . "\n";
            $text .= "{$t['platform']} " . self::escape($report->platform ?? '—') . "\n";
            $text .= "{$t['slots_count']} " . ($report->slots_count ?? '0') . "\n";
            $text .= "{$t['price_per_slot']} " . number_format($report->price_per_slot ?? 0, 0, '.', ' ') . " UZS\n";
        }

        if ($report->payment_type === 'prepaid') {
            $text .= "{$t['prepaid_amount']} " . number_format($report->paid_amount ?? 0, 0, '.', ' ') . " UZS\n";
        }

        $text .= "{$t['total_amount']} " . number_format($report->total_amount ?? 0, 0, '.', ' ') . " UZS\n";

        // If a Base64 receipt is provided, send it as photo or document directly
        if ($receiptBase64 && preg_match('/^data:(\w+\/\w+);base64,(.+)$/', $receiptBase64, $matches)) {
            $mimeType = $matches[1];
            $base64Data = $matches[2];
            $binaryData = base64_decode($base64Data);

            $token = config('services.telegram.bot_token');
            if ($token && $chatId) {
                try {
                    $isPdf = str_contains($mimeType, 'pdf');
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
            $text .= "{$t['blogger']} " . self::escape($blogger) . "\n";

            if ($isScreenshot) {
                $text .= "  • <b>{$t['slot_number']} #{$slotNumber} ({$slotPlatform}):</b> [Screenshot Proof] 🖼️\n\n";
            } else {
                $text .= "  • <b>{$t['slot_number']} #{$slotNumber} ({$slotPlatform}):</b> " . self::escape($link) . "\n\n";
            }

            $text .= "{$t['total_purchased']} {$totalSlots}\n";
            $text .= "{$t['remaining_slots']} {$remaining}\n";

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

                    if (!$response->successful()) {
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
                                continue;
                            }
                            $body = $response->body();
                        }

                        Log::error("Telegram sendPhoto failed, retrying plain text: " . $body);
                        // Fallback: send text message first, then photo separately
                        self::sendMessage($chatId, $text, $threadId);

                        $fallbackPhotoParams = [
                            'chat_id' => $chatId,
                            'caption' => "🖼️ Screenshot Proof for Slot #{$slotNumber}",
                        ];
                        if ($threadId) {
                            $fallbackPhotoParams['message_thread_id'] = $threadId;
                        }

                        $response2 = Http::attach('photo', $binaryData, "screenshot_{$slotNumber}.jpg")
                            ->post("https://api.telegram.org/bot{$token}/sendPhoto", $fallbackPhotoParams);

                        if (!$response2->successful()) {
                            $body2 = $response2->body();
                            $resData2 = json_decode($body2, true);
                            if (isset($resData2['parameters']['migrate_to_chat_id'])) {
                                $newChatId = $resData2['parameters']['migrate_to_chat_id'];
                                $fallbackPhotoParams['chat_id'] = $newChatId;
                                Http::attach('photo', $binaryData, "screenshot_{$slotNumber}.jpg")
                                    ->post("https://api.telegram.org/bot{$token}/sendPhoto", $fallbackPhotoParams);
                            }
                        }
                    }
                } catch (\Throwable $e) {
                    Log::error("Telegram sendPhoto exception: " . $e->getMessage());
                    self::sendMessage($chatId, $text, $threadId);
                }
            } else {
                self::sendMessage($chatId, $text, $threadId);
            }
        }

        return true;
    }
}
