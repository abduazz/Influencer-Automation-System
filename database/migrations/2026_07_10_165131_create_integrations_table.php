<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('blogger_name');
            $table->date('start_date');
            $table->string('platform');
            $table->text('referral_link')->nullable();
            $table->decimal('price_per_slot', 12, 2)->default(0);
            $table->unsignedInteger('slots_count')->default(1);
            $table->unsignedInteger('paid_slots_count')->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->date('end_date');
            $table->string('status')->default('active');
            $table->string('blogger_cabinet_token')->nullable()->unique();
            $table->json('slots_config')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integrations');
    }
};
