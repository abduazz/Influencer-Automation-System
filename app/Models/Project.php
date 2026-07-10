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
        'description',
    ];

    public function integrations(): HasMany
    {
        return $this->hasMany(Integration::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }
}
