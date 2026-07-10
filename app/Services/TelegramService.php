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

    public static function sendReportNotification($report, $receiptBase64 = null)
    {
        $chatId = env('TELEGRAM_REPORTS_CHAT_ID');
        if (!$chatId) {
            $chatId = env('TELEGRAM_CHAT_ID'); // fallback
        }

        $paymentTypeNames = [
            'prepaid' => 'Предоплата (Prepaid)',
            'full' => 'Полная оплата (Full)',
            'other' => 'Прочие расходы (Other)',
        ];

        $paymentType = $paymentTypeNames[$report->payment_type] ?? $report->payment_type;
        $projectName = $report->project->name ?? '—';

        $text = "📝 *Создан новый отчет!*\n\n";
        $text .= "📅 *Дата:* " . ($report->date ? $report->date->format('Y-m-d') : '—') . "\n";
        $text .= "📂 *Проект:* {$projectName}\n";
        $text .= "💳 *Тип оплаты:* {$paymentType}\n";
        $text .= "🎯 *Назначение:* {$report->destination}\n";

        if ($report->payment_type !== 'other') {
            $text .= "👤 *Блогер:* " . ($report->channel_blogger ?? '—') . "\n";
            $text .= "📱 *Платформа:* " . ($report->platform ?? '—') . "\n";
            $text .= "🔢 *Количество слотов:* " . ($report->slots_count ?? '0') . "\n";
            $text .= "💵 *Цена за слот:* " . number_format($report->price_per_slot ?? 0, 0, '.', ' ') . " UZS\n";
        }

        $text .= "💰 *Итоговая сумма:* " . number_format($report->total_amount ?? 0, 0, '.', ' ') . " UZS\n";

        if ($report->comments) {
            $text .= "💬 *Комментарии:* _{$report->comments}_\n";
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

    public static function sendSubmissionNotification($integration, $data)
    {
        $chatId = env('TELEGRAM_SUBMISSIONS_CHAT_ID');
        if (!$chatId) {
            $chatId = env('TELEGRAM_CHAT_ID'); // fallback
        }

        $blogger = $integration->blogger_name;
        $platform = $integration->platform;
        $totalSlots = $integration->slots_count;

        // Filter and compile filled slots
        $filledSlots = collect($data)->filter(function($val) {
            return is_string($val) && trim($val) !== '';
        });

        $filledCount = $filledSlots->count();
        $remaining = max(0, $totalSlots - $filledCount);

        $text = "📢 *Выполнение работы блогером!*\n\n";
        $text .= "👤 *Блогер:* {$blogger}\n";
        $text .= "📱 *Платформа:* {$platform}\n\n";
        $text .= "📝 *Выполненные слоты:* \n";

        foreach ($filledSlots as $key => $link) {
            $slotNumber = str_replace('slot_', '', $key);
            $text .= "  • *Слот #{$slotNumber}:* {$link}\n";
        }

        $text .= "\n📊 *Количество купленных слотов:* {$totalSlots}\n";
        $text .= "⏳ *Оставшиеся слоты:* {$remaining}\n";

        return self::sendMessage($chatId, $text);
    }
}
