<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('subdomain')->nullable()->default('1')->after('monthly_limit')->index();
        });

        DB::table('projects')->whereNull('subdomain')->update(['subdomain' => '1']);
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('subdomain');
        });
    }
};
