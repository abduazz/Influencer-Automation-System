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

