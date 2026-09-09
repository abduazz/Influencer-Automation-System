<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kanban_columns', function (Blueprint $table) {
            $table->id();
            $table->string('column_id', 100)->unique();
            $table->string('title', 255);
            $table->string('color', 50)->default('indigo');
            $table->integer('position')->default(0);
            $table->timestamps();
        });

        // Seed initial standard workflow columns so the board is immediately ready for all users
        $defaultColumns = [
            ['column_id' => 'wishlist', 'title' => 'Желаемые', 'color' => 'purple', 'position' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['column_id' => 'negotiation', 'title' => 'Обговорить', 'color' => 'amber', 'position' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['column_id' => 'requisites_pending', 'title' => 'Получить реквизиты', 'color' => 'blue', 'position' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['column_id' => 'ready_for_payment', 'title' => 'Готов к оплате', 'color' => 'indigo', 'position' => 3, 'created_at' => now(), 'updated_at' => now()],
            ['column_id' => 'paid_in_progress', 'title' => 'Оплачено / В работе', 'color' => 'emerald', 'position' => 4, 'created_at' => now(), 'updated_at' => now()],
            ['column_id' => 'completed', 'title' => 'Завершено', 'color' => 'neutral', 'position' => 5, 'created_at' => now(), 'updated_at' => now()],
        ];

        DB::table('kanban_columns')->insert($defaultColumns);
    }

    public function down(): void
    {
        Schema::dropIfExists('kanban_columns');
    }
};
