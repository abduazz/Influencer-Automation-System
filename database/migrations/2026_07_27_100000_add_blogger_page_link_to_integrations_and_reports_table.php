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
        Schema::table('integrations', function (Blueprint $table) {
            $table->text('blogger_page_link')->nullable()->after('blogger_name');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->text('blogger_page_link')->nullable()->after('channel_blogger');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('integrations', function (Blueprint $table) {
            $table->dropColumn('blogger_page_link');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn('blogger_page_link');
        });
    }
};
