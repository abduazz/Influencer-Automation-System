<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\BloggerRequisite;
use App\Models\Integration;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Cleans up test/demo blogger requisites (Arzoni.vodiyda / Юсупов Сардор, Sanjar_Turdialiyevi / Абдуллаева Мадина, Ispanchik / Каримов Жасур, and test entries),
     * while strictly preserving real blogger submissions (AGA / Jumanazar Komilov).
     */
    public function up(): void
    {
        // 1. Delete all fake/test records from blogger_requisites table
        // Strictly protect and keep real blogger AGA (JUMANAZAR KOMILOV NIZOMIDDIN O'G'LI)
        BloggerRequisite::query()
            ->where(function ($query) {
                $query->whereRaw('LOWER(blogger_name) NOT LIKE ?', ['%aga%'])
                      ->orWhereNull('blogger_name');
            })
            ->where(function ($query) {
                $query->whereRaw('LOWER(full_name) NOT LIKE ?', ['%jumanazar%'])
                      ->whereRaw('LOWER(full_name) NOT LIKE ?', ['%komilov%']);
            })
            ->delete();

        // 2. Clear fake requisites attached to integrations
        // Keep ONLY AGA integrations intact
        $integrationsWithReqs = Integration::whereNotNull('requisites')->get();
        foreach ($integrationsWithReqs as $integration) {
            $isAga = false;
            if (stripos($integration->blogger_name, 'aga') !== false) {
                $isAga = true;
            }

            $req = is_array($integration->requisites) ? $integration->requisites : json_decode($integration->requisites, true);
            if (is_array($req)) {
                $fullName = strtolower($req['fullName'] ?? '');
                $bloggerName = strtolower($req['bloggerName'] ?? '');
                if (str_contains($fullName, 'jumanazar') || str_contains($fullName, 'komilov') || str_contains($bloggerName, 'aga')) {
                    $isAga = true;
                }
            }

            if (!$isAga) {
                $updateData = ['requisites' => null];
                // If it was moved to ready_for_payment by the test seed, revert to requisites_pending
                if ($integration->kanban_stage === 'ready_for_payment') {
                    $updateData['kanban_stage'] = 'requisites_pending';
                }
                $integration->update($updateData);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Test records cleanup is permanent
    }
};
