<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('integrations', function (Blueprint $table) {
            $table->unsignedBigInteger('subscribers_count')->nullable()->after('telegram_username');
            $table->timestamp('subscribers_updated_at')->nullable()->after('subscribers_count');
            $table->json('subscribers_history')->nullable()->after('subscribers_updated_at');
        });
    }

    public function down(): void
    {
        Schema::table('integrations', function (Blueprint $table) {
            $table->dropColumn(['subscribers_count', 'subscribers_updated_at', 'subscribers_history']);
        });
    }
};
