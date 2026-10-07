<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('integration_id');
            $table->string('sender_type', 32); // 'manager', 'blogger', 'system'
            $table->string('sender_name', 255)->nullable();
            $table->text('text');
            $table->bigInteger('telegram_message_id')->nullable();
            $table->text('media_url')->nullable();
            $table->string('media_type', 64)->nullable(); // 'photo', 'document', 'audio', etc.
            $table->string('status', 32)->default('sent'); // 'pending', 'sent', 'delivered', 'read', 'failed'
            $table->timestamps();

            $table->index(['integration_id', 'created_at']);
            $table->index('telegram_message_id');
            $table->foreign('integration_id')->references('id')->on('integrations')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
    }
};
