<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subdomain extends Model
{
    use HasFactory;

    protected $fillable = [
        'slug',
        'name',
        'description',
    ];

    /**
     * Get all projects associated with this subdomain.
     */
    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'subdomain', 'slug');
    }
}
