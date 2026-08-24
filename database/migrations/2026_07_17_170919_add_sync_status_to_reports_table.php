<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->boolean('telegram_sent')->default(false);
            $table->boolean('sheets_sent')->default(false);
        });

        try {
            \Illuminate\Support\Facades\DB::table('reports')
                ->where('created_at', '<', '2026-07-16 22:00:00')
                ->update([
                    'telegram_sent' => true,
                    'sheets_sent' => true,
                ]);
        } catch (\Throwable $e) {
            // Safe fallback
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['telegram_sent', 'sheets_sent']);
        });
    }
};
