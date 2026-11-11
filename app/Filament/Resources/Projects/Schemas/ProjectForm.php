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
                TextInput::make('prefix')
                    ->label('Префикс проекта (Prefix)')
                    ->placeholder('например: TZPY, YBR')
                    ->helperText('Используется для нумерации отчетов, например #TZPY-294')
                    ->maxLength(50),
                TextInput::make('subdomain')
                    ->label('Субдомен (Subdomain)')
                    ->helperText('Например: 1 для 1.tezi.uz, 2 для 2.tezi.uz')
                    ->default('1')
                    ->required()
                    ->maxLength(100),
                TextInput::make('telegram_thread_id')
                    ->label('Telegram Thread ID (для финотчетов в общей группе)')
                    ->helperText('ID темы для финансовых отчетов в основной группе')
                    ->maxLength(255),
                TextInput::make('telegram_submissions_thread_id')
                    ->label('Telegram Thread ID (для отчетов блогеров в общей группе)')
                    ->helperText('Опционально. ID темы для выполнения слотов блогеров в общей группе')
                    ->maxLength(255),
                TextInput::make('telegram_chat_id')
                    ->label('Telegram Chat ID отдельной группы проекта')
                    ->placeholder('например: -1001234567890')
                    ->helperText('Если указан, отчеты проекта будут дублироваться в эту группу.')
                    ->maxLength(100),
                TextInput::make('telegram_topic_id')
                    ->label('Telegram Topic ID для финотчетов в группе проекта')
                    ->placeholder('например: 326 (опционально)')
                    ->helperText('ID темы для финансовых отчетов в отдельной группе проекта.')
                    ->maxLength(100),
                TextInput::make('telegram_submissions_topic_id')
                    ->label('Telegram Topic ID для отчетов блогеров в группе проекта')
                    ->placeholder('например: 327 (опционально)')
                    ->helperText('ID темы для отчетов о выполнении блогеров (слотов) в группе проекта.')
                    ->maxLength(100),
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
