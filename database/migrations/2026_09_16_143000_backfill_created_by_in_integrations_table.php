<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Integration;
use App\Models\Report;
use App\Models\User;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Backfills missing created_by in integrations from existing reports or default user.
     */
    public function up(): void
    {
        $defaultUser = User::first()?->name ?? 'Super Admin';

        $integrations = Integration::whereNull('created_by')
            ->orWhere('created_by', '')
            ->get();

        if ($integrations->isEmpty()) {
            return;
        }

        $reportsWithCreator = Report::whereNotNull('created_by')
            ->where('created_by', '!=', '')
            ->get();

        foreach ($integrations as $integration) {
            $cleanName = strtolower(trim(str_replace(['@', '#'], '', $integration->blogger_name)));

            // Find matching report for this blogger
            $matchingReport = $reportsWithCreator->first(function ($rep) use ($integration, $cleanName) {
                if (empty($rep->channel_blogger)) return false;
                $repClean = strtolower(trim(str_replace(['@', '#'], '', $rep->channel_blogger)));
                return $repClean === $cleanName || str_contains($repClean, $cleanName) || str_contains($cleanName, $repClean);
            });

            if ($matchingReport && !empty($matchingReport->created_by)) {
                $integration->update(['created_by' => $matchingReport->created_by]);
            } else {
                $integration->update(['created_by' => $defaultUser]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No need to reverse backfill
    }
};
