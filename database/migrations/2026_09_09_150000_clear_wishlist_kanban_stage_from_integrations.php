<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Reset kanban_stage for historical deals that were incorrectly assigned to 'wishlist'
        DB::table('integrations')
            ->where('kanban_stage', 'wishlist')
            ->update(['kanban_stage' => null]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op
    }
};
