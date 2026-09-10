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

Artisan::command('integrations:recalculate-dates', function () {
    $integrations = \App\Models\Integration::all();
    $count = 0;

    foreach ($integrations as $integration) {
        $cleanName = strtolower(trim(str_replace(['@', '#'], '', $integration->blogger_name)));

        // Get matching reports
        $reports = \App\Models\Report::all()->filter(function ($rep) use ($integration, $cleanName) {
            if (!$rep->channel_blogger) return false;
            $repBlogger = strtolower(trim(str_replace(['@', '#'], '', $rep->channel_blogger)));
            if ($repBlogger !== $cleanName) return false;
            if ($rep->platform && strtolower($rep->platform) !== strtolower($integration->platform)) return false;

            // Check project match (direct or in slotsConfig)
            if ((string)$rep->project_id === (string)$integration->project_id) return true;
            if (!empty($rep->slots_config) && is_array($rep->slots_config)) {
                foreach ($rep->slots_config as $slot) {
                    if (isset($slot['projectId']) && (string)$slot['projectId'] === (string)$integration->project_id) {
                        return true;
                    }
                }
            }
            return false;
        });

        // Get matching bulk purchases
        $bulkPurchases = \App\Models\BulkPurchase::all()->filter(function ($bp) use ($integration, $cleanName) {
            $bpBlogger = strtolower(trim(str_replace(['@', '#'], '', $bp->blogger_name)));
            if ($bpBlogger !== $cleanName) return false;
            if (strtolower($bp->platform) !== strtolower($integration->platform)) return false;
            return true;
        });

        $dates = [];

        foreach ($reports as $r) {
            if ($r->date) {
                $dates[] = \Carbon\Carbon::parse($r->date);
            }
        }

        foreach ($bulkPurchases as $bp) {
            if ($bp->purchase_date) {
                $dates[] = \Carbon\Carbon::parse($bp->purchase_date);
            }
        }

        if ($integration->start_date) {
            $dates[] = \Carbon\Carbon::parse($integration->start_date);
        }

        if (empty($dates)) continue;

        $minDate = $dates[0]->copy();
        $maxDate = $dates[0]->copy();

        foreach ($dates as $d) {
            if ($d->lt($minDate)) $minDate = $d->copy();
            if ($d->gt($maxDate)) $maxDate = $d->copy();
        }

        $newStart = $minDate->format('Y-m-d');
        $newEnd = $maxDate->copy()->addDays(14)->format('Y-m-d');

        $currentStart = $integration->start_date ? $integration->start_date->format('Y-m-d') : null;
        $currentEnd = $integration->end_date ? $integration->end_date->format('Y-m-d') : null;

        if ($newStart !== $currentStart || $newEnd !== $currentEnd) {
            $integration->update([
                'start_date' => $newStart,
                'end_date' => $newEnd,
            ]);
            $this->info("Updated Integration ID {$integration->id} ({$integration->blogger_name}): start={$newStart}, end={$newEnd}");
            $count++;
        }
    }

    $this->info("Recalculation complete. Updated {$count} integration(s).");
})->purpose('Recalculate and sync integration start and end dates based on all associated reports and bulk purchases');

Artisan::command('bloggers:sync-subscribers {--dry-run : Only preview updates without saving}', function () {
    $dryRun = $this->option('dry-run');
    $apiService = app(\App\Services\InstagramApiService::class);

    $integrations = \App\Models\Integration::whereNotNull('blogger_name')->get();
    $uniqueBloggers = [];

    foreach ($integrations as $item) {
        $clean = strtolower(trim(ltrim($item->blogger_name, '@#')));
        if ($clean && !isset($uniqueBloggers[$clean])) {
            $uniqueBloggers[$clean] = $item;
        }
    }

    $this->info("Found " . count($uniqueBloggers) . " unique blogger(s) to sync.");

    $synced = 0;
    $today = now()->format('Y-m-d');

    foreach ($uniqueBloggers as $cleanName => $sample) {
        $platform = $sample->platform ?? 'Instagram';
        if (strtolower($platform) === 'telegram') {
            $target = $sample->telegram_username ?: $sample->blogger_page_link ?: $sample->blogger_name;
        } else {
            $target = $sample->blogger_page_link ?: $sample->blogger_name ?: $sample->telegram_username;
        }

        $result = $apiService->fetchSubscriberCount($platform, $target ?? '', $sample->subscribers_count);

        if (!$result['success']) {
            $this->warn("Skipped @{$cleanName} ({$platform}): " . ($result['error'] ?? 'API error'));
            continue;
        }

        $count = (int) $result['count'];
        $this->info("✓ @{$cleanName} ({$platform}): {$count} subscribers (source: {$result['source']})");

        if (!$dryRun) {
            $deals = $integrations->filter(fn($i) => strtolower(trim(ltrim($i->blogger_name, '@#'))) === $cleanName);
            foreach ($deals as $deal) {
                $history = $deal->subscribers_history ?? [];
                if (empty($history)) {
                    $history = \App\Services\InstagramApiService::generateInitialHistory($count, $result['source']);
                } else {
                    $found = false;
                    foreach ($history as &$entry) {
                        if (isset($entry['date']) && $entry['date'] === $today) {
                            $entry['count'] = $count;
                            $entry['source'] = $result['source'];
                            $found = true;
                            break;
                        }
                    }
                    unset($entry);
                    if (!$found) {
                        $history[] = [
                            'date' => $today,
                            'count' => $count,
                            'source' => $result['source']
                        ];
                    }
                }
                usort($history, fn($a, $b) => strcmp($a['date'] ?? '', $b['date'] ?? ''));

                $deal->update([
                    'subscribers_count' => $count,
                    'subscribers_updated_at' => now(),
                    'subscribers_history' => $history,
                ]);
            }
        }
        $synced++;
    }

    $this->info("Finished syncing subscribers for {$synced} blogger(s)." . ($dryRun ? ' (DRY RUN)' : ''));
})->purpose('Sync blogger follower counts from Instagram/Telegram API twice monthly')
  ->twiceMonthly(1, 15, '03:00');




