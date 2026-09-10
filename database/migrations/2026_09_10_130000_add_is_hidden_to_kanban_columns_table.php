<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kanban_columns', function (Blueprint $table) {
            $table->boolean('is_hidden')->default(false)->after('position');
        });

        // Insert default Backlog column if not present
        if (!DB::table('kanban_columns')->where('column_id', 'backlog')->exists()) {
            DB::table('kanban_columns')->insert([
                'column_id' => 'backlog',
                'title' => 'Backlog',
                'color' => 'slate',
                'position' => 6,
                'is_hidden' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('kanban_columns', function (Blueprint $table) {
            $table->dropColumn('is_hidden');
        });

        DB::table('kanban_columns')->where('column_id', 'backlog')->delete();
    }
};
