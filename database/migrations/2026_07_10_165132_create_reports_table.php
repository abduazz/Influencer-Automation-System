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
            $table->string('payment_type')->default('prepaid');
            $table->date('date');
            $table->foreignId('project_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('destination');
            $table->string('channel_blogger')->nullable();
            $table->string('platform')->nullable();
            $table->unsignedInteger('slots_count')->nullable();
            $table->unsignedInteger('paid_slots_count')->default(0)->nullable();
            $table->decimal('price_per_slot', 12, 2)->nullable();
            $table->decimal('paid_amount', 12, 2)->default(0)->nullable();
            $table->decimal('total_amount', 12, 2)->default(0)->nullable();
            $table->text('comments')->nullable();
            $table->json('slots_config')->nullable();
            $table->longText('receipt')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
