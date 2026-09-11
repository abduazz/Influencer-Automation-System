<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BloggerRequisite extends Model
{
    use HasFactory;

    protected $fillable = [
        'integration_id',
        'blogger_name',
        'tax_status',
        'full_name',
        'passport_series_number',
        'pinfl_or_tin',
        'passport_issue_date',
        'passport_issued_by',
        'registration_address',
        'passport_front_scan',
        'passport_back_scan',
        'card_number_or_iban',
        'bank_name',
        'bank_inn',
        'mfo',
        'transit_account',
        'recipient_name',
        'phone',
        'telegram_handle',
        'status',
        'submitted_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
    ];

    public function integration(): BelongsTo
    {
        return $this->belongsTo(Integration::class);
    }
}
