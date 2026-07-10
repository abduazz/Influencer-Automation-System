<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    use HasFactory;

    protected $fillable = [
        'date',
        'project_id',
        'destination',
        'channel_blogger',
        'platform',
        'slots_count',
        'paid_slots_count',
        'price_per_slot',
        'paid_amount',
        'total_amount',
        'comments',
        'slots_config',
    ];

    protected $casts = [
        'date' => 'date',
        'price_per_slot' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'slots_count' => 'integer',
        'paid_slots_count' => 'integer',
        'slots_config' => 'array',
    ];

    protected static function booted(): void
    {
        static::saving(function (Report $report): void {
            $report->total_amount = $report->price_per_slot * $report->slots_count;
            $report->paid_amount = $report->price_per_slot * $report->paid_slots_count;
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
