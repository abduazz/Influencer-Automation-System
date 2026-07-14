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

    public static function sendMessage($chatId, $text)
    {
        $token = config('services.telegram.bot_token');
        if (!$token || !$chatId) {
            Log::info("Telegram Bot Token or Chat ID not set. Message: \n" . $text);
            return false;
        }

        try {
            $response = Http::post("https://api.telegram.org/bot{$token}/sendMessage", [
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'HTML',
            ]);

            if (!$response->successful()) {
                Log::error("Telegram API Error: " . $response->body());
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::error("Telegram exception: " . $e->getMessage());
            return false;
        }
    }

    public static function sendReportNotification($report, $receiptBase64 = null, $lang = 'ru')
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
                'destination' => '🎯 <b>Назначение:</b>',
                'blogger' => '👤 <b>Блогер:</b>',
                'platform' => '📱 <b>Платформа:</b>',
                'slots_count' => '🔢 <b>Количество слотов:</b>',
                'price_per_slot' => '💵 <b>Цена за слот:</b>',
                'total_amount' => '💰 <b>Итоговая сумма:</b>',
                'prepaid_amount' => '💳 <b>Сумма предоплаты:</b>',
                'comments' => '💬 <b>Комментарии:</b>',
                'receipt_attached' => '📎 <b>Чек/Скриншот прикреплен к отчету.</b>',
                'referral_link' => '🔗 <b>Реферальная ссылка:</b>',
                'prepaid' => 'Предоплата (Prepaid)',
                'full' => 'Полная оплата (Full)',
                'other' => 'Прочие расходы (Other)',
            ],
            'en' => [
                'new_report' => '📝 <b>New Report Created!</b>',
                'date' => '📅 <b>Date:</b>',
                'project' => '📂 <b>Project:</b>',
                'payment_type' => '💳 <b>Payment Type:</b>',
                'destination' => '🎯 <b>Purpose:</b>',
                'blogger' => '👤 <b>Blogger:</b>',
                'platform' => '📱 <b>Platform:</b>',
                'slots_count' => '🔢 <b>Slots Count:</b>',
                'price_per_slot' => '💵 <b>Price per Slot:</b>',
                'total_amount' => '💰 <b>Total Amount:</b>',
                'prepaid_amount' => '💳 <b>Prepayment Amount:</b>',
                'comments' => '💬 <b>Comments:</b>',
                'receipt_attached' => '📎 <b>Receipt/Screenshot is attached to the report.</b>',
                'referral_link' => '🔗 <b>Referral Link:</b>',
                'prepaid' => 'Prepayment (Prepaid)',
                'full' => 'Full Payment (Full)',
                'other' => 'Other Expenses (Other)',
            ],
            'uz' => [
                'new_report' => '📝 <b>Yangi hisobot yaratildi!</b>',
                'date' => '📅 <b>Sana:</b>',
                'project' => '📂 <b>Loyiha:</b>',
                'payment_type' => '💳 <b>To\'lov turi:</b>',
                'destination' => '🎯 <b>Maqsad:</b>',
                'blogger' => '👤 <b>Blogger:</b>',
                'platform' => '📱 <b>Platforma:</b>',
                'slots_count' => '🔢 <b>Slotlar soni:</b>',
                'price_per_slot' => '💵 <b>Slot narxi:</b>',
                'total_amount' => '💰 <b>Jami summa:</b>',
                'prepaid_amount' => '💳 <b>Oldindan to\'lov summasi:</b>',
                'comments' => '💬 <b>Izohlar:</b>',
                'receipt_attached' => '📎 <b>Chek/Skrinshot hisobotga biriktirilgan.</b>',
                'referral_link' => '🔗 <b>Referral havolasi:</b>',
                'prepaid' => 'Oldindan to\'lov (Prepaid)',
                'full' => 'To\'liq to\'lov (Full)',
                'other' => 'Boshqa xarajatlar (Other)',
            ]
        ];

        // Safe fallback for language key
        $l = isset($locales[$lang]) ? $lang : 'ru';
        $t = $locales[$l];

        $paymentType = $t[$report->payment_type] ?? $report->payment_type;
        if ($report->payment_type === 'prepaid' && $report->slots_count > 0) {
            $percentage = round(($report->paid_slots_count / $report->slots_count) * 100);
            $paymentType .= " - {$percentage}%";
        }
        $projectName = $report->project?->name ?? '—';

        // Calculate dynamic purpose description matching Google Sheets format
        $destinationValue = $report->destination;
        if ($report->payment_type !== 'other') {
            $destinationValue = trim(($report->platform ?? '') . ' блогер интеграция');
        }

        $text = "{$t['new_report']}\n\n";
        $text .= "{$t['date']} " . ($report->date ? $report->date->format('Y-m-d') : '—') . "\n";
        $text .= "{$t['project']} " . self::escape($projectName) . "\n";
        $text .= "{$t['payment_type']} " . self::escape($paymentType) . "\n";
        $text .= "{$t['destination']} " . self::escape($destinationValue) . "\n";

        if ($report->payment_type !== 'other') {
            $text .= "{$t['blogger']} " . self::escape($report->channel_blogger ?? '—') . "\n";
            $text .= "{$t['platform']} " . self::escape($report->platform ?? '—') . "\n";
            if ($report->destination) {
                $text .= "{$t['referral_link']} " . self::escape($report->destination) . "\n";
            }
            $text .= "{$t['slots_count']} " . ($report->slots_count ?? '0') . "\n";
            $text .= "{$t['price_per_slot']} " . number_format($report->price_per_slot ?? 0, 0, '.', ' ') . " UZS\n";
        }

        if ($report->payment_type === 'prepaid') {
            $text .= "{$t['prepaid_amount']} " . number_format($report->paid_amount ?? 0, 0, '.', ' ') . " UZS\n";
        }

        $text .= "{$t['total_amount']} " . number_format($report->total_amount ?? 0, 0, '.', ' ') . " UZS\n";

        if ($report->comments) {
            $text .= "{$t['comments']} <i>" . self::escape($report->comments) . "</i>\n";
        }

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

                    $response = Http::attach($field, $binaryData, $filename)
                        ->post("https://api.telegram.org/bot{$token}/{$endpoint}", [
                            'chat_id' => $chatId,
                            'caption' => $text,
                            'parse_mode' => 'HTML',
                        ]);

                    if ($response->successful()) {
                        return true;
                    }
                    Log::error("Telegram sendPhoto/Document API Error: " . $response->body());
                } catch (\Throwable $e) {
                    Log::error("Telegram sendPhoto/Document Exception: " . $e->getMessage());
                }
            }
        }

        return self::sendMessage($chatId, $text);
    }

    public static function sendSubmissionNotification($integration, $data, $lang = 'ru')
    {
        $chatId = config('services.telegram.submissions_chat_id');
        if (!$chatId) {
            $chatId = config('services.telegram.chat_id'); // fallback
        }

        $locales = [
            'ru' => [
                'submission_title' => '📢 <b>Выполнение работы блогером!</b>',
                'blogger' => '👤 <b>Блогер:</b>',
                'platform' => '📱 <b>Платформа:</b>',
                'completed_slots' => '📝 <b>Выполненные слоты:</b>',
                'slot_number' => 'Слот',
                'total_purchased' => '📊 <b>Количество купленных слотов:</b>',
                'remaining_slots' => '⏳ <b>Оставшиеся слоты:</b>',
            ],
            'en' => [
                'submission_title' => '📢 <b>Work Performed by Blogger!</b>',
                'blogger' => '👤 <b>Blogger:</b>',
                'platform' => '📱 <b>Platform:</b>',
                'completed_slots' => '📝 <b>Completed Slots:</b>',
                'slot_number' => 'Slot',
                'total_purchased' => '📊 <b>Total Purchased Slots:</b>',
                'remaining_slots' => '⏳ <b>Remaining Slots:</b>',
            ],
            'uz' => [
                'submission_title' => '📢 <b>Blogger ishni bajardi!</b>',
                'blogger' => '👤 <b>Blogger:</b>',
                'platform' => '📱 <b>Platforma:</b>',
                'completed_slots' => '📝 <b>Bajarilgan slotlar:</b>',
                'slot_number' => 'Slot',
                'total_purchased' => '📊 <b>Sotib olingan slotlar soni:</b>',
                'remaining_slots' => '⏳ <b>Qolgan slotlar:</b>',
            ]
        ];

        $l = isset($locales[$lang]) ? $lang : 'ru';
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

        $text = "{$t['submission_title']}\n\n";
        $text .= "{$t['blogger']} " . self::escape($blogger) . "\n";
        $text .= "{$t['platform']} " . self::escape($platform) . "\n\n";
        $text .= "{$t['completed_slots']} \n";

        $screenshots = [];

        foreach ($filledSlots as $key => $link) {
            $slotNumber = str_replace('slot_', '', $key);
            if (preg_match('/^data:(\w+\/\w+);base64,(.+)$/', $link, $matches)) {
                $screenshots[$slotNumber] = [
                    'mime' => $matches[1],
                    'data' => base64_decode($matches[2])
                ];
                $text .= "  • <b>{$t['slot_number']} #{$slotNumber}:</b> [Screenshot Proof] 🖼️\n";
            } else {
                $text .= "  • <b>{$t['slot_number']} #{$slotNumber}:</b> " . self::escape($link) . "\n";
            }
        }

        $text .= "\n{$t['total_purchased']} " . self::escape($totalSlots) . "\n";
        $text .= "{$t['remaining_slots']} " . self::escape($remaining) . "\n";

        // Handle sending photos if screenshots exist
        $token = config('services.telegram.bot_token');
        if ($token && $chatId && !empty($screenshots)) {
            try {
                // If exactly 1 screenshot, send it with the full text as caption
                if (count($screenshots) === 1) {
                    $slotNum = array_key_first($screenshots);
                    $screen = $screenshots[$slotNum];
                    $response = Http::attach('photo', $screen['data'], "screenshot_{$slotNum}.jpg")
                        ->post("https://api.telegram.org/bot{$token}/sendPhoto", [
                            'chat_id' => $chatId,
                            'caption' => $text,
                            'parse_mode' => 'HTML',
                        ]);
                    if ($response->successful()) {
                        return true;
                    }
                    Log::error("Telegram sendPhoto API Error (Single Submission): " . $response->body());
                } else {
                    // Send text message first
                    self::sendMessage($chatId, $text);
                    
                    // Send each screenshot as a separate photo
                    foreach ($screenshots as $slotNum => $screen) {
                        Http::attach('photo', $screen['data'], "screenshot_{$slotNum}.jpg")
                            ->post("https://api.telegram.org/bot{$token}/sendPhoto", [
                                'chat_id' => $chatId,
                                'caption' => "🖼️ Screenshot Proof for Slot #{$slotNum} (Blogger: " . self::escape($blogger) . ")",
                            ]);
                    }
                    return true;
                }
            } catch (\Throwable $e) {
                Log::error("Telegram sendSubmissionNotification screenshots exception: " . $e->getMessage());
            }
        }

        return self::sendMessage($chatId, $text);
    }
}
