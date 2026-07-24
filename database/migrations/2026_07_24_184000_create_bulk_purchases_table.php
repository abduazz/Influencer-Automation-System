<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bulk_purchases', function (Blueprint $table) {
            $table->id();
            $table->string('blogger_name');
            $table->string('platform')->nullable();
            $table->unsignedInteger('total_slots')->default(1);
            $table->decimal('price_per_slot', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->date('purchase_date');
            $table->text('referral_link')->nullable();
            $table->longText('receipt')->nullable();
            $table->text('comments')->nullable();
            $table->json('slots_config')->nullable();
            $table->string('created_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bulk_purchases');
    }
};
