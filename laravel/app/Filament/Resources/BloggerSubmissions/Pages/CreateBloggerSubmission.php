<?php

namespace App\Filament\Resources\BloggerSubmissions\Pages;

use App\Filament\Resources\BloggerSubmissions\BloggerSubmissionResource;
use Filament\Resources\Pages\CreateRecord;

class CreateBloggerSubmission extends CreateRecord
{
    protected static string $resource = BloggerSubmissionResource::class;
}
