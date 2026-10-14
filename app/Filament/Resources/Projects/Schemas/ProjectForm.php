<?php

namespace App\Filament\Resources\Projects\Schemas;

use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class ProjectForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->label('Название проекта')
                    ->required()
                    ->maxLength(255),
                TextInput::make('subdomain')
                    ->label('Субдомен (Subdomain)')
                    ->helperText('Например: 1 для 1.tezi.uz, 2 для 2.tezi.uz')
                    ->default('1')
                    ->required()
                    ->maxLength(100),
                TextInput::make('telegram_thread_id')
                    ->label('Telegram Thread ID')
                    ->maxLength(255),
                TextInput::make('monthly_limit')
                    ->label('Месячный лимит (сум)')
                    ->numeric()
                    ->minValue(0),
                Textarea::make('description')
                    ->label('Описание')
                    ->rows(3)
                    ->columnSpanFull(),
            ]);
    }
}
