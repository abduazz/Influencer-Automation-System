<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Integration extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'blogger_name',
        'start_date',
        'platform',
        'referral_link',
        'price_per_slot',
        'slots_count',
        'paid_slots_count',
        'paid_amount',
        'total_amount',
        'end_date',
        'status',
        'blogger_cabinet_token',
        'slots_config',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'price_per_slot' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'slots_count' => 'integer',
        'paid_slots_count' => 'integer',
        'slots_config' => 'array',
    ];

    protected static function booted(): void
    {
        static::saving(function (Integration $integration): void {
            $integration->total_amount = $integration->price_per_slot * $integration->slots_count;
            $paidSlots = $integration->paid_slots_count ?? $integration->slots_count;
            $integration->paid_amount = $integration->price_per_slot * $paidSlots;

            if (blank($integration->blogger_cabinet_token)) {
                $cleanName = Str::slug(str_replace(['@', '#'], '', $integration->blogger_name), '_');
                $integration->blogger_cabinet_token = 'tok_' . time() . '_' . Str::random(6) . '_' . $cleanName;
            }
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(BloggerSubmission::class);
    }
}
