<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('integrations', function (Blueprint $table) {
            if (!Schema::hasColumn('integrations', 'currency')) {
                $table->string('currency', 10)->default('UZS')->nullable()->after('total_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('integrations', function (Blueprint $table) {
            if (Schema::hasColumn('integrations', 'currency')) {
                $table->dropColumn('currency');
            }
        });
    }
};
