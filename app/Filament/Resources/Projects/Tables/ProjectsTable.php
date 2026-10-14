<?php

namespace App\Filament\Resources\Projects\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class ProjectsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')
                    ->label('Название')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('subdomain')
                    ->label('Субдомен')
                    ->badge()
                    ->color(fn (?string $state): string => match ($state) {
                        '1' => 'primary',
                        '2' => 'success',
                        default => 'gray',
                    })
                    ->searchable()
                    ->sortable(),
                TextColumn::make('monthly_limit')
                    ->label('Лимит')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('telegram_thread_id')
                    ->label('Thread ID')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')
                    ->label('Создан')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('subdomain')
                    ->label('Субдомен')
                    ->options([
                        '1' => '1.tezi.uz (1)',
                        '2' => '2.tezi.uz (2)',
                    ]),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
