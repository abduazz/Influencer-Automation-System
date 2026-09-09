<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('integrations', function (Blueprint $table) {
            $table->string('kanban_stage', 100)->nullable()->default('wishlist')->after('status');
            $table->string('created_by', 255)->nullable()->after('kanban_stage');
        });

        // Set default stage and creator for any existing integrations
        DB::table('integrations')
            ->whereNull('kanban_stage')
            ->update(['kanban_stage' => 'wishlist']);

        DB::table('integrations')
            ->whereNull('created_by')
            ->update(['created_by' => 'Super Admin']);
    }

    public function down(): void
    {
        Schema::table('integrations', function (Blueprint $table) {
            $table->dropColumn(['kanban_stage', 'created_by']);
        });
    }
};
