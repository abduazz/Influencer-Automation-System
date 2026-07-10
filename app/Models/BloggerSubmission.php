<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BloggerSubmission extends Model
{
    use HasFactory;

    protected $fillable = [
        'integration_id',
        'submitted_at',
        'status',
        'data',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'data' => 'array',
    ];

    public function integration(): BelongsTo
    {
        return $this->belongsTo(Integration::class);
    }
}
