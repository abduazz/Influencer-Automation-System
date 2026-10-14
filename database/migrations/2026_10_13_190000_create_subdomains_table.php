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
        if (!Schema::hasTable('subdomains')) {
            Schema::create('subdomains', function (Blueprint $table) {
                $table->id();
                $table->string('slug')->unique();
                $table->string('name');
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        // Seed default subdomain '1' if not already present
        $exists = DB::table('subdomains')->where('slug', '1')->exists();
        if (!$exists) {
            DB::table('subdomains')->insert([
                'slug' => '1',
                'name' => 'Основное пространство (1)',
                'description' => 'Главный субдомен по умолчанию (1.tezi.uz)',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // If there are any projects with distinct subdomains other than '1', seed them as well
        if (Schema::hasColumn('projects', 'subdomain')) {
            $otherSubs = DB::table('projects')
                ->whereNotNull('subdomain')
                ->where('subdomain', '!=', '')
                ->where('subdomain', '!=', '1')
                ->distinct()
                ->pluck('subdomain');

            foreach ($otherSubs as $sub) {
                if (!DB::table('subdomains')->where('slug', $sub)->exists()) {
                    DB::table('subdomains')->insert([
                        'slug' => $sub,
                        'name' => 'Пространство ' . $sub,
                        'description' => "Субдомен {$sub}.tezi.uz",
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subdomains');
    }
};
