<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\BloggerSubmission;
use App\Models\Integration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Clean fractional rounding noise (< 0.15) across all reports
        DB::table('reports')
            ->whereRaw('ABS(total_amount - ROUND(total_amount)) > 0 AND ABS(total_amount - ROUND(total_amount)) < 0.15')
            ->update([
                'total_amount' => DB::raw('ROUND(total_amount)'),
            ]);

        DB::table('reports')
            ->whereRaw('ABS(paid_amount - ROUND(paid_amount)) > 0 AND ABS(paid_amount - ROUND(paid_amount)) < 0.15')
            ->update([
                'paid_amount' => DB::raw('ROUND(paid_amount)'),
            ]);

        // 2. Clean fractional rounding noise (< 0.15) across all integrations
        DB::table('integrations')
            ->whereRaw('ABS(total_amount - ROUND(total_amount)) > 0 AND ABS(total_amount - ROUND(total_amount)) < 0.15')
            ->update([
                'total_amount' => DB::raw('ROUND(total_amount)'),
            ]);

        DB::table('integrations')
            ->whereRaw('ABS(paid_amount - ROUND(paid_amount)) > 0 AND ABS(paid_amount - ROUND(paid_amount)) < 0.15')
            ->update([
                'paid_amount' => DB::raw('ROUND(paid_amount)'),
            ]);

        // 3. Restore real publication dates for Avto Olam slots 1-16
        try {
            $olamIntegrations = Integration::whereRaw('LOWER(blogger_name) LIKE ?', ['%avto%olam%'])->get();
            $slotRealDates = [
                'slot_1_submitted_at'  => '2026-09-03T12:00:00.000000Z',
                'slot_2_submitted_at'  => '2026-09-04T12:00:00.000000Z',
                'slot_3_submitted_at'  => '2026-09-06T12:00:00.000000Z',
                'slot_4_submitted_at'  => '2026-09-07T12:00:00.000000Z',
                'slot_5_submitted_at'  => '2026-09-08T12:00:00.000000Z',
                'slot_6_submitted_at'  => '2026-09-09T12:00:00.000000Z',
                'slot_7_submitted_at'  => '2026-09-13T12:00:00.000000Z',
                'slot_8_submitted_at'  => '2026-09-14T12:00:00.000000Z',
                'slot_9_submitted_at'  => '2026-09-14T12:00:00.000000Z',
                'slot_10_submitted_at' => '2026-09-15T12:00:00.000000Z',
                'slot_11_submitted_at' => '2026-09-15T12:00:00.000000Z',
                'slot_12_submitted_at' => '2026-09-15T12:00:00.000000Z',
                'slot_13_submitted_at' => '2026-09-17T10:13:22.000000Z',
                'slot_14_submitted_at' => '2026-09-19T12:00:00.000000Z',
                'slot_15_submitted_at' => '2026-09-20T12:00:00.000000Z',
                'slot_16_submitted_at' => '2026-09-21T12:00:00.000000Z',
            ];

            foreach ($olamIntegrations as $integration) {
                // Mark integration as completed since obligations are fully fulfilled
                $integration->update([
                    'status' => 'completed',
                    'kanban_stage' => 'completed',
                    'paid_amount' => round($integration->paid_amount),
                    'total_amount' => round($integration->total_amount),
                ]);

                $sub = BloggerSubmission::where('integration_id', $integration->id)->first();
                if ($sub) {
                    $data = $sub->data ?? [];
                    foreach ($slotRealDates as $slotDateKey => $realIso) {
                        $data[$slotDateKey] = $realIso;
                    }
                    $sub->update(['data' => $data]);
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Migration Avto Olam fix failed: ' . $e->getMessage());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No down migration needed for data fix
    }
};
