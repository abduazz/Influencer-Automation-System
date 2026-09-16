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

    protected static function booted(): void
    {
        static::saved(function (BloggerSubmission $submission): void {
            $integration = $submission->integration;
            if (!$integration) {
                return;
            }

            $totalSlots = (int) ($integration->slots_count ?? 0);
            if ($totalSlots <= 0 && !empty($integration->slots_config) && is_array($integration->slots_config)) {
                $totalSlots = count($integration->slots_config);
            }

            if ($totalSlots <= 0) {
                return;
            }

            $data = $submission->data ?? [];
            $allFilled = true;
            for ($i = 1; $i <= $totalSlots; $i++) {
                $val = $data["slot_{$i}"] ?? null;
                if (!is_string($val) || trim($val) === '') {
                    $allFilled = false;
                    break;
                }
            }

            if ($allFilled && $integration->kanban_stage !== 'completed') {
                $integration->update([
                    'kanban_stage' => 'completed',
                    'status' => 'completed',
                ]);
                \Illuminate\Support\Facades\Log::info("Integration ID {$integration->id} ({$integration->blogger_name}) auto-completed: all {$totalSlots} slots submitted.");
            }
        });
    }

    public function integration(): BelongsTo
    {
        return $this->belongsTo(Integration::class);
    }
}
