<?php

namespace App\Filament\Resources\BloggerSubmissions\Pages;

use App\Filament\Resources\BloggerSubmissions\BloggerSubmissionResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListBloggerSubmissions extends ListRecords
{
    protected static string $resource = BloggerSubmissionResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
