<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'prefix',
        'description',
        'telegram_thread_id',
        'telegram_submissions_thread_id',
        'telegram_chat_id',
        'telegram_topic_id',
        'telegram_submissions_topic_id',
        'monthly_limit',
        'subdomain',
    ];

    public function setPrefixAttribute($value): void
    {
        $this->attributes['prefix'] = $value !== null ? strtoupper(trim((string) $value)) : null;
    }

    public function integrations(): HasMany
    {
        return $this->hasMany(Integration::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }
}
