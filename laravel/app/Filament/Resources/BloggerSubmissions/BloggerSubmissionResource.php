<?php

namespace App\Filament\Resources\BloggerSubmissions;

use App\Filament\Resources\BloggerSubmissions\Pages\CreateBloggerSubmission;
use App\Filament\Resources\BloggerSubmissions\Pages\EditBloggerSubmission;
use App\Filament\Resources\BloggerSubmissions\Pages\ListBloggerSubmissions;
use App\Filament\Resources\BloggerSubmissions\Schemas\BloggerSubmissionForm;
use App\Filament\Resources\BloggerSubmissions\Tables\BloggerSubmissionsTable;
use App\Models\BloggerSubmission;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class BloggerSubmissionResource extends Resource
{
    protected static ?string $model = BloggerSubmission::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return BloggerSubmissionForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return BloggerSubmissionsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListBloggerSubmissions::route('/'),
            'create' => CreateBloggerSubmission::route('/create'),
            'edit' => EditBloggerSubmission::route('/{record}/edit'),
        ];
    }
}
