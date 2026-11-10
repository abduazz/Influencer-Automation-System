<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Integration;
use App\Models\Report;
use App\Models\BloggerSubmission;
use App\Models\BloggerRequisite;
use App\Models\ChatMessage;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            // 1. Group integrations by (project_id, normalized_blogger_name)
            $integrations = Integration::all();
            $grouped = [];

            foreach ($integrations as $int) {
                if (empty($int->blogger_name) || empty($int->project_id)) {
                    continue;
                }
                $normBlogger = preg_replace('/[@#\s_\-\.]+/', '', strtolower(trim($int->blogger_name)));
                $key = "{$int->project_id}_{$normBlogger}";
                $grouped[$key][] = $int;
            }

            // 2. Merge duplicate integrations for the same blogger in the same project
            foreach ($grouped as $key => $dealList) {
                if (count($dealList) <= 1) {
                    continue;
                }

                // Sort by: oldest start_date / lowest id first (the primary original deal)
                usort($dealList, function ($a, $b) {
                    $aDate = $a->start_date ? $a->start_date->format('Y-m-d') : '9999-99-99';
                    $bDate = $b->start_date ? $b->start_date->format('Y-m-d') : '9999-99-99';
                    $cmp = strcmp($aDate, $bDate);
                    return $cmp !== 0 ? $cmp : ($a->id - $b->id);
                });

                $primary = array_shift($dealList);

                foreach ($dealList as $dup) {
                    Log::info("Merging duplicate integration #{$dup->id} ('{$dup->blogger_name}') into primary #{$primary->id}");

                    // Merge submissions data
                    $primarySub = BloggerSubmission::where('integration_id', $primary->id)->first();
                    $dupSub = BloggerSubmission::where('integration_id', $dup->id)->first();

                    if ($dupSub) {
                        if (!$primarySub) {
                            $dupSub->update(['integration_id' => $primary->id]);
                        } else {
                            $primaryData = $primarySub->data ?? [];
                            $dupData = $dupSub->data ?? [];
                            $mergedData = array_merge($primaryData, $dupData);
                            $primarySub->update(['data' => $mergedData]);
                            $dupSub->delete();
                        }
                    }

                    // Move requisites if primary has none
                    if (!BloggerRequisite::where('integration_id', $primary->id)->exists()) {
                        BloggerRequisite::where('integration_id', $dup->id)->update(['integration_id' => $primary->id]);
                    } else {
                        BloggerRequisite::where('integration_id', $dup->id)->delete();
                    }

                    // Move chat messages
                    ChatMessage::where('integration_id', $dup->id)->update(['integration_id' => $primary->id]);

                    // Delete the duplicate integration
                    $dup->delete();
                }

                // Sync the primary integration with all reports
                $primary->refresh();
                $primary->syncWithReports();
            }

            // 3. Sync all integrations that have associated reports
            $allIntegrations = Integration::all();
            foreach ($allIntegrations as $integration) {
                $integration->syncWithReports();
            }

            Log::info("Migration merge duplicate integrations and sync reports completed successfully.");
        } catch (\Throwable $e) {
            Log::error("Migration merge duplicate integrations failed: " . $e->getMessage());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Data merge cannot be automatically rolled back
    }
};

