<?php

namespace App\Filament\Resources\Integrations;

use App\Filament\Resources\Integrations\Pages\CreateIntegration;
use App\Filament\Resources\Integrations\Pages\EditIntegration;
use App\Filament\Resources\Integrations\Pages\ListIntegrations;
use App\Filament\Resources\Integrations\Schemas\IntegrationForm;
use App\Filament\Resources\Integrations\Tables\IntegrationsTable;
use App\Models\Integration;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class IntegrationResource extends Resource
{
    protected static ?string $model = Integration::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return IntegrationForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return IntegrationsTable::configure($table);
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
            'index' => ListIntegrations::route('/'),
            'create' => CreateIntegration::route('/create'),
            'edit' => EditIntegration::route('/{record}/edit'),
        ];
    }
}
