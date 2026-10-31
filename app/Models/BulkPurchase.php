<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * App\Models\BulkPurchase
 *
 * @property int $id
 * @property string $blogger_name
 * @property string|null $platform
 * @property int $total_slots
 * @property float|null $price_per_slot
 * @property float|null $paid_amount
 * @property float|null $total_amount
 * @property Carbon|null $purchase_date
 * @property string|null $referral_link
 * @property string|null $receipt
 * @property string|null $comments
 * @property array|null $slots_config
 * @property string|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class BulkPurchase extends Model
{
    use HasFactory;

    protected $fillable = [
        'blogger_name',
        'platform',
        'total_slots',
        'price_per_slot',
        'paid_amount',
        'total_amount',
        'purchase_date',
        'referral_link',
        'receipt',
        'comments',
        'slots_config',
        'created_by',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'price_per_slot' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'total_slots' => 'integer',
        'slots_config' => 'array',
    ];

    protected static function booted(): void
    {
        static::saving(function (BulkPurchase $bulkPurchase): void {
            $bulkPurchase->total_amount = $bulkPurchase->price_per_slot * $bulkPurchase->total_slots;
            if (blank($bulkPurchase->paid_amount)) {
                $bulkPurchase->paid_amount = $bulkPurchase->total_amount;
            }
        });
    }

    public function getAllocatedSlotsCountAttribute(): int
    {
        if (empty($this->slots_config) || !is_array($this->slots_config)) {
            return 0;
        }
        $count = 0;
        foreach ($this->slots_config as $slot) {
            if (!empty($slot['projectId'])) {
                $count++;
            }
        }
        return $count;
    }

    public function getRemainingSlotsCountAttribute(): int
    {
        return max(0, $this->total_slots - $this->allocated_slots_count);
    }
}
