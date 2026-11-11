<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            if (!Schema::hasColumn('reports', 'telegram_duplicate_message_url')) {
                $table->string('telegram_duplicate_message_url')->nullable()->after('telegram_message_url');
            }
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            if (Schema::hasColumn('reports', 'telegram_duplicate_message_url')) {
                $table->dropColumn('telegram_duplicate_message_url');
            }
        });
    }
};

