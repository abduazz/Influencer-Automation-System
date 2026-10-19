<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'integration_id',
        'sender_type',
        'sender_name',
        'text',
        'telegram_message_id',
        'media_url',
        'media_type',
        'status',
        'sent_at',
        'received_at',
        'read_at',
    ];

    protected $casts = [
        'telegram_message_id' => 'integer',
        'sent_at' => 'datetime',
        'received_at' => 'datetime',
        'read_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function integration(): BelongsTo
    {
        return $this->belongsTo(Integration::class);
    }
}
