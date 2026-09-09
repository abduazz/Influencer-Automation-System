<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KanbanColumn extends Model
{
    use HasFactory;

    protected $fillable = [
        'column_id',
        'title',
        'color',
        'position',
    ];

    protected $casts = [
        'position' => 'integer',
    ];
}
