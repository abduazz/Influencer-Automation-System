<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Integration;
use App\Models\BloggerRequisite;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Removes the 6 empty test integrations created without budget/reports.
     */
    public function up(): void
    {
        $exactNames = [
            'bahodirjon rajabov',
            'mansur xilvatov',
            'sherzodbek faxritdinov',
            'bekzod ruzmatov',
            'ayubxon azamovich',
        ];

        // 1. Delete matching by exact lowercase names
        foreach ($exactNames as $name) {
            Integration::whereRaw('LOWER(blogger_name) = ?', [$name])
                ->where(function ($q) {
                    $q->where('total_amount', '<=', 0)
                      ->orWhereNull('total_amount');
                })
                ->where(function ($q) {
                    $q->where('paid_amount', '<=', 0)
                      ->orWhereNull('paid_amount');
                })
                ->each(function ($integration) {
                    $integration->submissions()->delete();
                    BloggerRequisite::where('integration_id', $integration->id)->delete();
                    $integration->delete();
                });
        }

        // 2. Delete Uyg'un Umirziqov (handling various apostrophe styles like ', `, ‘, ’)
        Integration::where(function ($q) {
                $q->whereRaw("LOWER(blogger_name) LIKE '%uyg%un umirziqov%'")
                  ->orWhereRaw("LOWER(blogger_name) LIKE '%uygun umirziqov%'");
            })
            ->where(function ($q) {
                $q->where('total_amount', '<=', 0)
                  ->orWhereNull('total_amount');
            })
            ->where(function ($q) {
                $q->where('paid_amount', '<=', 0)
                  ->orWhereNull('paid_amount');
            })
            ->each(function ($integration) {
                $integration->submissions()->delete();
                BloggerRequisite::where('integration_id', $integration->id)->delete();
                $integration->delete();
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Irreversible cleanup of test/empty records
    }
};
