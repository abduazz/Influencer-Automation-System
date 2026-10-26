<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\BloggerSubmission;
use App\Models\Integration;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $slotsToFill = [
            // Missing slot from September batch (published Oct 2, 2026 with Tezda link)
            'slot_30'              => 'https://youtu.be/1-W8nxObZHA',
            'slot_30_submitted_at' => '2026-10-02T12:00:00.000000Z',

            // Slots 31-60: Real YouTube releases from July 20 to August 24, 2026 with https://bulink.io/tezda_avtoolam
            'slot_31'              => 'https://youtu.be/VcdWp-DtYBE',
            'slot_31_submitted_at' => '2026-07-20T12:00:00.000000Z',

            'slot_32'              => 'https://youtu.be/7H1GADjJ45I',
            'slot_32_submitted_at' => '2026-07-21T12:00:00.000000Z',

            'slot_33'              => 'https://youtu.be/MMuSRf8Dyyc',
            'slot_33_submitted_at' => '2026-07-22T12:00:00.000000Z',

            'slot_34'              => 'https://youtu.be/JLUUm1pymR4',
            'slot_34_submitted_at' => '2026-07-23T12:00:00.000000Z',

            'slot_35'              => 'https://youtu.be/-XWuIriVOi8',
            'slot_35_submitted_at' => '2026-07-25T12:00:00.000000Z',

            'slot_36'              => 'https://youtu.be/86-wOiHkV60',
            'slot_36_submitted_at' => '2026-07-26T12:00:00.000000Z',

            'slot_37'              => 'https://youtu.be/41UpVEJwL7E',
            'slot_37_submitted_at' => '2026-07-27T12:00:00.000000Z',

            'slot_38'              => 'https://youtu.be/6lFWA87QIhs',
            'slot_38_submitted_at' => '2026-07-28T12:00:00.000000Z',

            'slot_39'              => 'https://youtu.be/DkQMcL-jB00',
            'slot_39_submitted_at' => '2026-07-29T12:00:00.000000Z',

            'slot_40'              => 'https://youtu.be/jcmbVM0ICf0',
            'slot_40_submitted_at' => '2026-07-30T12:00:00.000000Z',

            'slot_41'              => 'https://youtu.be/RIcuroodxzg',
            'slot_41_submitted_at' => '2026-08-01T12:00:00.000000Z',

            'slot_42'              => 'https://youtu.be/rhXgUmb50bQ',
            'slot_42_submitted_at' => '2026-08-02T12:00:00.000000Z',

            'slot_43'              => 'https://youtu.be/LbULFky1irM',
            'slot_43_submitted_at' => '2026-08-03T12:00:00.000000Z',

            'slot_44'              => 'https://youtu.be/sK_44k0IQrc',
            'slot_44_submitted_at' => '2026-08-05T12:00:00.000000Z',

            'slot_45'              => 'https://youtu.be/y6vuutCY1Ww',
            'slot_45_submitted_at' => '2026-08-09T12:00:00.000000Z',

            'slot_46'              => 'https://youtu.be/m44pBsrij3E',
            'slot_46_submitted_at' => '2026-08-10T12:00:00.000000Z',

            'slot_47'              => 'https://youtu.be/XARHzFH_oSc',
            'slot_47_submitted_at' => '2026-08-11T12:00:00.000000Z',

            'slot_48'              => 'https://youtu.be/5Iv5rK8DJ8w',
            'slot_48_submitted_at' => '2026-08-12T12:00:00.000000Z',

            'slot_49'              => 'https://youtu.be/OT7MKzwJZBE',
            'slot_49_submitted_at' => '2026-08-13T12:00:00.000000Z',

            'slot_50'              => 'https://youtu.be/uTYG8bSKeVg',
            'slot_50_submitted_at' => '2026-08-14T12:00:00.000000Z',

            'slot_51'              => 'https://youtu.be/U4poP-uAHdQ',
            'slot_51_submitted_at' => '2026-08-16T12:00:00.000000Z',

            'slot_52'              => 'https://youtu.be/Vqesi-Xlb6Y',
            'slot_52_submitted_at' => '2026-08-17T12:00:00.000000Z',

            'slot_53'              => 'https://youtu.be/7Xq1N7a752A',
            'slot_53_submitted_at' => '2026-08-18T12:00:00.000000Z',

            'slot_54'              => 'https://youtu.be/XXKCiAEydpI',
            'slot_54_submitted_at' => '2026-08-19T12:00:00.000000Z',

            'slot_55'              => 'https://youtu.be/knfqyeqXxfU',
            'slot_55_submitted_at' => '2026-08-20T12:00:00.000000Z',

            'slot_56'              => 'https://youtu.be/QGLtp90xIMw',
            'slot_56_submitted_at' => '2026-08-21T12:00:00.000000Z',

            'slot_57'              => 'https://youtu.be/iMq_RlA_Jg4',
            'slot_57_submitted_at' => '2026-08-23T12:00:00.000000Z',

            'slot_58'              => 'https://youtu.be/Kg9hkUVz8qI',
            'slot_58_submitted_at' => '2026-08-24T12:00:00.000000Z',

            'slot_59'              => 'https://youtu.be/z0ZbshG8efk',
            'slot_59_submitted_at' => '2026-08-24T12:00:00.000000Z',

            'slot_60'              => 'https://youtu.be/r78AsOZPZ_E',
            'slot_60_submitted_at' => '2026-08-24T12:00:00.000000Z',
        ];

        try {
            $olamIntegrations = Integration::whereRaw('LOWER(blogger_name) LIKE ?', ['%avto%olam%'])->get();

            foreach ($olamIntegrations as $integration) {
                // Update integration status to completed
                $integration->update([
                    'status' => 'completed',
                    'kanban_stage' => 'completed',
                ]);

                $sub = BloggerSubmission::where('integration_id', $integration->id)->first();
                if ($sub) {
                    $data = $sub->data ?? [];
                    foreach ($slotsToFill as $k => $val) {
                        $data[$k] = $val;
                    }
                    $sub->update([
                        'status' => 'approved',
                        'data' => $data,
                    ]);
                    Log::info("Migration filled remaining slots 30-60 for Avto Olam (integration #{$integration->id})");
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Migration fill Avto Olam slots 30-60 failed: ' . $e->getMessage());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No down migration needed for data backfill
    }
};
