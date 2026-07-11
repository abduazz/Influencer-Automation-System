<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    public static function sendMessage($chatId, $text)
    {
        $token = env('TELEGRAM_BOT_TOKEN');
        if (!$token || !$chatId) {
            Log::info("Telegram Bot Token or Chat ID not set. Message: \n" . $text);
            return false;
        }

        try {
            $response = Http::post("https://api.telegram.org/bot{$token}/sendMessage", [
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'Markdown',
            ]);

            if (!$response->successful()) {
                Log::error("Telegram API Error: " . $response->body());
                return false;
            }

            return true;
        } catch (\Exception $e) {
            Log::error("Telegram exception: " . $e->getMessage());
            return false;
        }
    }

    public static function sendReportNotification($report, $receiptBase64 = null, $lang = 'ru')
    {
        $chatId = env('TELEGRAM_REPORTS_CHAT_ID');
        if (!$chatId) {
            $chatId = env('TELEGRAM_CHAT_ID'); // fallback
        }

        $locales = [
            'ru' => [
                'new_report' => '📝 *Создан новый отчет!*',
                'date' => '📅 *Дата:*',
                'project' => '📂 *Проект:*',
                'payment_type' => '💳 *Тип оплаты:*',
                'destination' => '🎯 *Назначение:*',
                'blogger' => '👤 *Блогер:*',
                'platform' => '📱 *Платформа:*',
                'slots_count' => '🔢 *Количество слотов:*',
                'price_per_slot' => '💵 *Цена за слот:*',
                'total_amount' => '💰 *Итоговая сумма:*',
                'prepaid_amount' => '💳 *Сумма предоплаты:*',
                'comments' => '💬 *Комментарии:*',
                'receipt_attached' => '📎 *Чек/Скриншот прикреплен к отчету.*',
                'prepaid' => 'Предоплата (Prepaid)',
                'full' => 'Полная оплата (Full)',
                'other' => 'Прочие расходы (Other)',
            ],
            'en' => [
                'new_report' => '📝 *New Report Created!*',
                'date' => '📅 *Date:*',
                'project' => '📂 *Project:*',
                'payment_type' => '💳 *Payment Type:*',
                'destination' => '🎯 *Purpose:*',
                'blogger' => '👤 *Blogger:*',
                'platform' => '📱 *Platform:*',
                'slots_count' => '🔢 *Slots Count:*',
                'price_per_slot' => '💵 *Price per Slot:*',
                'total_amount' => '💰 *Total Amount:*',
                'prepaid_amount' => '💳 *Prepayment Amount:*',
                'comments' => '💬 *Comments:*',
                'receipt_attached' => '📎 *Receipt/Screenshot is attached to the report.*',
                'prepaid' => 'Prepayment (Prepaid)',
                'full' => 'Full Payment (Full)',
                'other' => 'Other Expenses (Other)',
            ],
            'uz' => [
                'new_report' => '📝 *Yangi hisobot yaratildi!*',
                'date' => '📅 *Sana:*',
                'project' => '📂 *Loyiha:*',
                'payment_type' => '💳 *To\'lov turi:*',
                'destination' => '🎯 *Maqsad:*',
                'blogger' => '👤 *Blogger:*',
                'platform' => '📱 *Platforma:*',
                'slots_count' => '🔢 *Slotlar soni:*',
                'price_per_slot' => '💵 *Slot narxi:*',
                'total_amount' => '💰 *Jami summa:*',
                'prepaid_amount' => '💳 *Oldindan to\'lov summasi:*',
                'comments' => '💬 *Izohlar:*',
                'receipt_attached' => '📎 *Chek/Skrinshot hisobotga biriktirilgan.*',
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
        $projectName = $report->project->name ?? '—';

        $text = "{$t['new_report']}\n\n";
        $text .= "{$t['date']} " . ($report->date ? $report->date->format('Y-m-d') : '—') . "\n";
        $text .= "{$t['project']} {$projectName}\n";
        $text .= "{$t['payment_type']} {$paymentType}\n";
        $text .= "{$t['destination']} {$report->destination}\n";

        if ($report->payment_type !== 'other') {
            $text .= "{$t['blogger']} " . ($report->channel_blogger ?? '—') . "\n";
            $text .= "{$t['platform']} " . ($report->platform ?? '—') . "\n";
            $text .= "{$t['slots_count']} " . ($report->slots_count ?? '0') . "\n";
            $text .= "{$t['price_per_slot']} " . number_format($report->price_per_slot ?? 0, 0, '.', ' ') . " UZS\n";
        }

        if ($report->payment_type === 'prepaid') {
            $text .= "{$t['prepaid_amount']} " . number_format($report->paid_amount ?? 0, 0, '.', ' ') . " UZS\n";
        }

        $text .= "{$t['total_amount']} " . number_format($report->total_amount ?? 0, 0, '.', ' ') . " UZS\n";

        if ($report->comments) {
            $text .= "{$t['comments']} _{$report->comments}_\n";
        }

        // If a Base64 receipt is provided, send it as photo or document directly
        if ($receiptBase64 && preg_match('/^data:(\w+\/\w+);base64,(.+)$/', $receiptBase64, $matches)) {
            $mimeType = $matches[1];
            $base64Data = $matches[2];
            $binaryData = base64_decode($base64Data);

            $token = env('TELEGRAM_BOT_TOKEN');
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
                            'parse_mode' => 'Markdown',
                        ]);

                    if ($response->successful()) {
                        return true;
                    }
                    Log::error("Telegram sendPhoto/Document API Error: " . $response->body());
                } catch (\Exception $e) {
                    Log::error("Telegram sendPhoto/Document Exception: " . $e->getMessage());
                }
            }
        }

        return self::sendMessage($chatId, $text);
    }

    public static function sendSubmissionNotification($integration, $data, $lang = 'ru')
    {
        $chatId = env('TELEGRAM_SUBMISSIONS_CHAT_ID');
        if (!$chatId) {
            $chatId = env('TELEGRAM_CHAT_ID'); // fallback
        }

        $locales = [
            'ru' => [
                'submission_title' => '📢 *Выполнение работы блогером!*',
                'blogger' => '👤 *Блогер:*',
                'platform' => '📱 *Платформа:*',
                'completed_slots' => '📝 *Выполненные слоты:*',
                'slot_number' => 'Слот',
                'total_purchased' => '📊 *Количество купленных слотов:*',
                'remaining_slots' => '⏳ *Оставшиеся слоты:*',
            ],
            'en' => [
                'submission_title' => '📢 *Work Performed by Blogger!*',
                'blogger' => '👤 *Blogger:*',
                'platform' => '📱 *Platform:*',
                'completed_slots' => '📝 *Completed Slots:*',
                'slot_number' => 'Slot',
                'total_purchased' => '📊 *Total Purchased Slots:*',
                'remaining_slots' => '⏳ *Remaining Slots:*',
            ],
            'uz' => [
                'submission_title' => '📢 *Blogger ishni bajardi!*',
                'blogger' => '👤 *Blogger:*',
                'platform' => '📱 *Platforma:*',
                'completed_slots' => '📝 *Bajarilgan slotlar:*',
                'slot_number' => 'Slot',
                'total_purchased' => '📊 *Sotib olingan slotlar soni:*',
                'remaining_slots' => '⏳ *Qolgan slotlar:*',
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
        $text .= "{$t['blogger']} {$blogger}\n";
        $text .= "{$t['platform']} {$platform}\n\n";
        $text .= "{$t['completed_slots']} \n";

        foreach ($filledSlots as $key => $link) {
            $slotNumber = str_replace('slot_', '', $key);
            $text .= "  • *{$t['slot_number']} #{$slotNumber}:* {$link}\n";
        }

        $text .= "\n{$t['total_purchased']} {$totalSlots}\n";
        $text .= "{$t['remaining_slots']} {$remaining}\n";

        return self::sendMessage($chatId, $text);
    }
}
