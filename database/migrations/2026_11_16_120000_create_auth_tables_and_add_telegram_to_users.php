<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'telegram_id')) {
                $table->string('telegram_id', 64)->nullable()->unique()->after('email');
            }
            if (!Schema::hasColumn('users', 'telegram_username')) {
                $table->string('telegram_username', 100)->nullable()->index()->after('telegram_id');
            }
            if (!Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable()->after('remember_token');
            }
        });

        if (!Schema::hasTable('user_sessions')) {
            Schema::create('user_sessions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('token_hash', 64)->unique();
                $table->string('auth_method', 32)->default('password');
                $table->string('ip_address', 45)->nullable();
                $table->text('user_agent')->nullable();
                $table->timestamp('last_used_at')->nullable();
                $table->timestamp('expires_at')->index();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('auth_challenges')) {
            Schema::create('auth_challenges', function (Blueprint $table) {
                $table->id();
                $table->string('token', 64)->unique();
                $table->string('type', 32)->index();
                $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
                $table->string('code_hash', 64)->nullable();
                $table->string('status', 20)->default('pending')->index();
                $table->string('telegram_id', 64)->nullable();
                $table->string('telegram_username', 100)->nullable();
                $table->unsignedTinyInteger('attempts')->default(0);
                $table->timestamp('expires_at')->index();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('auth_challenges');
        Schema::dropIfExists('user_sessions');

        Schema::table('users', function (Blueprint $table) {
            $columns = array_values(array_filter([
                Schema::hasColumn('users', 'telegram_id') ? 'telegram_id' : null,
                Schema::hasColumn('users', 'telegram_username') ? 'telegram_username' : null,
                Schema::hasColumn('users', 'last_login_at') ? 'last_login_at' : null,
            ]));

            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
