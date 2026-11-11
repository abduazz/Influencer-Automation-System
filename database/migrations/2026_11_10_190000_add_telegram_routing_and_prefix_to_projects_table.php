<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (!Schema::hasColumn('projects', 'prefix')) {
                $table->string('prefix', 50)->nullable()->after('name');
            }
            if (!Schema::hasColumn('projects', 'telegram_chat_id')) {
                $table->string('telegram_chat_id', 100)->nullable()->after('telegram_thread_id');
            }
            if (!Schema::hasColumn('projects', 'telegram_topic_id')) {
                $table->string('telegram_topic_id', 100)->nullable()->after('telegram_chat_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $columns = [];
            if (Schema::hasColumn('projects', 'prefix')) {
                $columns[] = 'prefix';
            }
            if (Schema::hasColumn('projects', 'telegram_chat_id')) {
                $columns[] = 'telegram_chat_id';
            }
            if (Schema::hasColumn('projects', 'telegram_topic_id')) {
                $columns[] = 'telegram_topic_id';
            }
            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};

