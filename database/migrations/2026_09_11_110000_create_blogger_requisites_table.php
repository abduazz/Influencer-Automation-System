<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blogger_requisites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('integration_id')->nullable()->constrained('integrations')->nullOnDelete();
            $table->string('blogger_name');
            $table->string('tax_status')->default('card_transfer');
            $table->string('full_name');
            $table->string('passport_series_number')->nullable();
            $table->string('pinfl_or_tin')->nullable();
            $table->string('passport_issue_date')->nullable();
            $table->string('passport_issued_by')->nullable();
            $table->text('registration_address')->nullable();
            $table->longText('passport_front_scan')->nullable();
            $table->longText('passport_back_scan')->nullable();
            $table->string('card_number_or_iban');
            $table->string('bank_name')->nullable();
            $table->string('bank_inn')->nullable();
            $table->string('mfo')->nullable();
            $table->string('transit_account')->nullable();
            $table->string('recipient_name')->nullable();
            $table->string('phone')->nullable();
            $table->string('telegram_handle')->nullable();
            $table->string('status')->default('submitted');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blogger_requisites');
    }
};
