<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('test:sheets', function () {
    $report = \App\Models\Report::with('project')->latest()->first();
    if (!$report) {
        $this->error("No reports found in the database. Please create a report first.");
        return;
    }
    $this->info("Appending report ID: {$report->id} to Google Sheets...");
    $result = \App\Services\GoogleSheetsService::appendReport($report);
    if ($result) {
        $this->info("Success!");
    } else {
        $this->error("Failed! Check logs.");
    }
});

Artisan::command('reports:sync {--start-id= : Start from this report ID} {--end-id= : End at this report ID} {--id= : Sync a specific report ID} {--to=all : Destination: all, telegram, sheets} {--chat-id= : Override target Telegram Chat ID} {--lang=uz : Language for the Telegram notification (ru/uz/en)}', function () {
    $startId = $this->option('start-id');
    $endId = $this->option('end-id');
    $id = $this->option('id');
    $to = $this->option('to') ?: 'all';
    $chatIdOverride = $this->option('chat-id');
    $lang = $this->option('lang') ?: 'uz';

    if (!in_array($to, ['all', 'telegram', 'sheets'])) {
        $this->error("Invalid destination: {$to}. Allowed values: all, telegram, sheets.");
        return;
    }

    // 1. Temporarily override the telegram report chat ID in config if provided
    if ($chatIdOverride) {
        config(['services.telegram.reports_chat_id' => $chatIdOverride]);
        $this->info("Overriding TELEGRAM_REPORTS_CHAT_ID config to: " . $chatIdOverride);
    } else {
        $this->info("Using configured TELEGRAM_REPORTS_CHAT_ID: " . config('services.telegram.reports_chat_id'));
    }

    // 2. Query reports
    $query = \App\Models\Report::with('project');

    if ($id) {
        $query->where('id', $id);
    } else {
        if ($startId) {
            $query->where('id', '>=', $startId);
        }
        if ($endId) {
            $query->where('id', '<=', $endId);
        }
        
        // If neither startId, endId, nor id is specified, sync only UN-sent reports
        if (!$startId && !$endId) {
            if ($to === 'telegram') {
                $query->where('telegram_sent', false);
            } elseif ($to === 'sheets') {
                $query->where('sheets_sent', false);
            } else {
                $query->where(function ($q) {
                    $q->where('telegram_sent', false)
                      ->orWhere('sheets_sent', false);
                });
            }
        }
    }

    $reports = $query->orderBy('id', 'asc')->get();

    if ($reports->isEmpty()) {
        $this->info("No reports found matching the criteria.");
        return;
    }

    $this->info("Found " . $reports->count() . " report(s) to sync to {$to}. Starting...");

    foreach ($reports as $report) {
        $this->comment("----------------------------------------");
        $this->comment("Syncing Report ID: {$report->id} (Date: {$report->date?->format('Y-m-d')}, Amount: {$report->total_amount})...");

        // A. Telegram
        if (($to === 'all' || $to === 'telegram') && (!$report->telegram_sent || $id || $startId)) {
            $this->comment("  -> Sending to Telegram...");
            $tgSuccess = \App\Services\TelegramService::sendReportNotification(
                $report,
                $report->receipt,
                $lang,
                null
            );
            if ($tgSuccess) {
                $report->update(['telegram_sent' => true]);
                $this->info("  [Telegram] Success!");
            } else {
                $this->error("  [Telegram] Failed! Check logs.");
            }
            // Avoid Telegram rate limits
            usleep(500000); // 0.5s pause
        }

        // B. Google Sheets
        if (($to === 'all' || $to === 'sheets') && (!$report->sheets_sent || $id || $startId)) {
            $this->comment("  -> Appending to Google Sheets...");
            $sheetsSuccess = \App\Services\GoogleSheetsService::appendReport($report);
            if ($sheetsSuccess) {
                $report->update(['sheets_sent' => true]);
                $this->info("  [Google Sheets] Success!");
            } else {
                $this->error("  [Google Sheets] Failed! Check logs.");
            }
        }
    }

    $this->info("----------------------------------------");
    $this->info("Done! Sync completed.");
})->purpose('Sync/resend reports to Telegram group and/or Google Sheets');


