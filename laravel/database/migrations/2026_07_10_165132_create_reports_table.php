<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('destination');
            $table->string('channel_blogger');
            $table->string('platform');
            $table->unsignedInteger('slots_count');
            $table->unsignedInteger('paid_slots_count')->default(0);
            $table->decimal('price_per_slot', 12, 2);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->text('comments')->nullable();
            $table->json('slots_config')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
