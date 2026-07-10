<?php

namespace App\Filament\Resources\BloggerSubmissions\Pages;

use App\Filament\Resources\BloggerSubmissions\BloggerSubmissionResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditBloggerSubmission extends EditRecord
{
    protected static string $resource = BloggerSubmissionResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
