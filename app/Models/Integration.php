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
        'blogger_page_link',
        'telegram_username',
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
        'comments',
        'kanban_stage',
        'created_by',
        'subscribers_count',
        'subscribers_updated_at',
        'subscribers_history',
        'requisites',
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
        'comments' => 'array',
        'subscribers_count' => 'integer',
        'subscribers_updated_at' => 'datetime',
        'subscribers_history' => 'array',
        'requisites' => 'array',
    ];

    public static function generateCabinetToken(string $bloggerName): string
    {
        $slug = Str::slug(str_replace(['@', '#'], '', $bloggerName));
        $suffix = Str::lower(Str::random(6));
        return $slug ? ($slug . '-' . $suffix) : $suffix;
    }

    public function syncWithReports(): bool
    {
        if (!$this->exists || !$this->project_id || empty($this->blogger_name)) {
            return false;
        }

        $cleanName = strtolower(trim(str_replace(['@', '#'], '', $this->blogger_name)));

        $reports = Report::where('project_id', $this->project_id)
            ->where('platform', $this->platform)
            ->get()
            ->filter(function ($r) use ($cleanName) {
                if (!$r->channel_blogger) return false;
                $rClean = strtolower(trim(str_replace(['@', '#'], '', $r->channel_blogger)));
                return $rClean === $cleanName;
            });

        if ($reports->isEmpty()) {
            return false;
        }

        $totalPaidAmount = 0.0;
        $totalPaidSlots = 0;
        $totalReportSlots = 0;
        $mergedSlotsConfig = [];
        $latestPricePerSlot = (float) $this->price_per_slot;
        $latestBloggerPageLink = $this->blogger_page_link;
        $latestReferralLink = $this->referral_link;
        $minDate = null;
        $maxDate = null;

        $sortedReports = $reports->sortBy(function ($r) {
            return ($r->date ? $r->date->format('Y-m-d') : '') . '_' . str_pad($r->id, 10, '0', STR_PAD_LEFT);
        });

        foreach ($sortedReports as $rep) {
            $repDate = $rep->date ? \Carbon\Carbon::parse($rep->date) : null;
            if ($repDate) {
                if ($minDate === null || $repDate->lt($minDate)) {
                    $minDate = $repDate->copy();
                }
                if ($maxDate === null || $repDate->gt($maxDate)) {
                    $maxDate = $repDate->copy();
                }
            }

            if (!empty($rep->blogger_page_link)) {
                $latestBloggerPageLink = $rep->blogger_page_link;
            }
            if (!empty($rep->destination)) {
                $latestReferralLink = $rep->destination;
            }
            if ($rep->price_per_slot !== null && (float)$rep->price_per_slot > 0) {
                $latestPricePerSlot = (float) $rep->price_per_slot;
            }

            $repPaidAmount = (float) ($rep->paid_amount ?: $rep->total_amount ?: 0);
            $totalPaidAmount += $repPaidAmount;

            $repPaidSlots = (int) ($rep->paid_slots_count ?? 0);
            $totalPaidSlots += $repPaidSlots;

            if ($rep->payment_type !== 'remaining') {
                $totalReportSlots += (int) ($rep->slots_count ?? 0);
            }

            if (!empty($rep->slots_config) && is_array($rep->slots_config)) {
                $mergedSlotsConfig = array_merge($mergedSlotsConfig, $rep->slots_config);
            }
        }

        $slotsCount = max(
            (int) ($this->slots_count ?? 0),
            $totalReportSlots,
            $totalPaidSlots,
            count($mergedSlotsConfig)
        );
        if ($slotsCount <= 0) {
            $slotsCount = max(1, $totalPaidSlots);
        }

        // Re-index slotsConfig to ensure consistent 1..N indices
        $finalSlotsConfig = [];
        for ($i = 1; $i <= $slotsCount; $i++) {
            $existingConfig = $mergedSlotsConfig[$i - 1] ?? ($this->slots_config[$i - 1] ?? null);
            $finalSlotsConfig[] = [
                'slot' => $i,
                'platform' => $existingConfig['platform'] ?? $this->platform ?? 'Instagram',
                'format' => $existingConfig['format'] ?? 'Post',
                'projectId' => $existingConfig['projectId'] ?? (string)$this->project_id,
                'allocatedAt' => $existingConfig['allocatedAt'] ?? now()->format('Y-m-d'),
            ];
        }

        $unpaidSlots = max(0, $slotsCount - $totalPaidSlots);
        $totalAmount = $totalPaidAmount + ($unpaidSlots * $latestPricePerSlot);
        $effectivePricePerSlot = $slotsCount > 0 ? ($totalAmount / $slotsCount) : $latestPricePerSlot;

        $this->slots_count = $slotsCount;
        $this->paid_slots_count = $totalPaidSlots;
        $this->paid_amount = $totalPaidAmount;
        $this->total_amount = $totalAmount;
        $this->price_per_slot = round($effectivePricePerSlot, 2);
        $this->slots_config = $finalSlotsConfig;
        if (!empty($latestBloggerPageLink)) {
            $this->blogger_page_link = $latestBloggerPageLink;
        }
        if (!empty($latestReferralLink)) {
            $this->referral_link = $latestReferralLink;
        }
        if ($minDate && (!$this->start_date || $minDate->lt($this->start_date))) {
            $this->start_date = $minDate;
        }
        if ($maxDate) {
            $targetEndDate = $maxDate->copy()->addDays(14);
            if (!$this->end_date || $targetEndDate->gt($this->end_date)) {
                $this->end_date = $targetEndDate;
            }
        }

        return $this->saveQuietly();
    }

    protected static function booted(): void
    {
        static::saving(function (Integration $integration): void {
            $cleanName = strtolower(trim(str_replace(['@', '#'], '', $integration->blogger_name ?? '')));
            $hasReports = false;
            if ($integration->exists && $integration->project_id && $cleanName !== '') {
                $hasReports = Report::where('project_id', $integration->project_id)
                    ->where('platform', $integration->platform)
                    ->whereRaw('LOWER(channel_blogger) = ?', [$cleanName])
                    ->exists();
            }

            if (!$hasReports) {
                if ($integration->total_amount === null || $integration->isDirty('price_per_slot') || $integration->isDirty('slots_count')) {
                    $integration->total_amount = $integration->price_per_slot * $integration->slots_count;
                }
                if ($integration->paid_amount === null || (!$integration->isDirty('paid_amount') && ($integration->isDirty('price_per_slot') || $integration->isDirty('paid_slots_count')))) {
                    $paidSlots = $integration->paid_slots_count ?? $integration->slots_count;
                    $integration->paid_amount = $integration->price_per_slot * $paidSlots;
                }
            }

            if (blank($integration->blogger_cabinet_token)) {
                $integration->blogger_cabinet_token = self::generateCabinetToken($integration->blogger_name);
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

    public function bloggerRequisite(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(BloggerRequisite::class);
    }
}
