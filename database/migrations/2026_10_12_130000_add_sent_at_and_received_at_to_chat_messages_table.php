<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->timestamp('sent_at')->nullable()->after('status');
            $table->timestamp('received_at')->nullable()->after('sent_at');
        });

        // Backfill existing rows with created_at / updated_at
        try {
            DB::table('chat_messages')->whereNull('sent_at')->update([
                'sent_at' => DB::raw('created_at'),
            ]);
            DB::table('chat_messages')->whereNull('received_at')->update([
                'received_at' => DB::raw('COALESCE(updated_at, created_at)'),
            ]);
        } catch (\Throwable $e) {
            // Ignore if tables are empty or driver differs
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropColumn(['sent_at', 'received_at']);
        });
    }
};
