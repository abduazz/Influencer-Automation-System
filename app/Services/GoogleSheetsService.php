<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleSheetsService
{
    public static function appendReport($report)
    {
        $webhookUrl = env('GOOGLE_SHEETS_WEBHOOK_URL');
        if (!$webhookUrl) {
            Log::info("Google Sheets Webhook URL not set. Logging report data: " . json_encode($report->toArray()));
            return false;
        }

        $paymentTypeNames = [
            'prepaid' => 'Предоплата',
            'full' => 'Полная оплата',
            'other' => 'Прочие расходы',
        ];

        $payload = [
            'id' => (string) $report->id,
            'date' => $report->date ? $report->date->format('Y-m-d') : '',
            'project' => $report->project->name ?? '—',
            'payment_type' => $paymentTypeNames[$report->payment_type] ?? $report->payment_type,
            'destination' => $report->destination,
            'blogger' => $report->channel_blogger ?? '—',
            'platform' => $report->platform ?? '—',
            'slots_count' => (int) ($report->slots_count ?? 0),
            'paid_slots_count' => (int) ($report->paid_slots_count ?? 0),
            'price_per_slot' => (float) ($report->price_per_slot ?? 0),
            'total_amount' => (float) ($report->total_amount ?? 0),
            'comments' => $report->comments ?? '',
        ];

        try {
            $response = Http::post($webhookUrl, $payload);
            if (!$response->successful()) {
                Log::error("Google Sheets webhook error: " . $response->body());
                return false;
            }
            return true;
        } catch (\Exception $e) {
            Log::error("Google Sheets webhook exception: " . $e->getMessage());
            return false;
        }
    }
}
