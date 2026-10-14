<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DatabaseBackupService
{
    /**
     * Create a clean database backup snapshot in storage/backups/
     */
    public function createBackup(): string
    {
        $backupDir = storage_path('backups');
        File::ensureDirectoryExists($backupDir);

        $date = now()->format('Y-m-d_His');
        $fileName = "database_backup_{$date}.sqlite";
        $destination = $backupDir . DIRECTORY_SEPARATOR . $fileName;

        $source = config('database.connections.sqlite.database');
        if (empty($source) || !file_exists($source)) {
            $source = database_path('database.sqlite');
        }

        if (!file_exists($source)) {
            throw new \RuntimeException("Database file not found at: {$source}");
        }

        // Try SQLite native VACUUM INTO for a consistent non-blocking snapshot
        try {
            DB::connection('sqlite')->statement("VACUUM INTO ?", [$destination]);
        } catch (\Throwable $e) {
            Log::warning("VACUUM INTO failed, falling back to direct file copy: " . $e->getMessage());
            copy($source, $destination);
        }

        if (!file_exists($destination) || filesize($destination) === 0) {
            // Guarantee file existence via copy if VACUUM created empty or failed
            copy($source, $destination);
        }

        return $destination;
    }

    /**
     * Send backup file to dedicated Telegram topic (https://t.me/c/4424306910/597)
     */
    public function sendToTelegram(?string $filePath = null): array
    {
        try {
            if (!$filePath || !file_exists($filePath)) {
                $filePath = $this->createBackup();
            }

            $token = config('services.telegram.bot_token');
            if (empty($token)) {
                return [
                    'success' => false,
                    'error' => 'TELEGRAM_BOT_TOKEN is not configured in .env',
                ];
            }

            $chatId = config('services.telegram.backup_chat_id', '-1004424306910');
            $threadId = config('services.telegram.backup_thread_id', '597');

            $fileName = basename($filePath);
            $sizeKb = round(filesize($filePath) / 1024, 2);
            $dateStr = now()->format('d.m.Y H:i:s');

            $projectsCount = \App\Models\Project::count();
            $integrationsCount = \App\Models\Integration::count();
            $reportsCount = \App\Models\Report::count();
            $usersCount = \App\Models\User::count();

            $caption = "📦 <b>Резервная копия базы данных</b>\n\n"
                . "📅 <b>Дата:</b> {$dateStr}\n"
                . "💾 <b>Размер:</b> {$sizeKb} KB\n"
                . "📁 <b>Файл:</b> <code>{$fileName}</code>\n\n"
                . "📊 <b>Статистика данных:</b>\n"
                . "• Проектов: {$projectsCount}\n"
                . "• Интеграций: {$integrationsCount}\n"
                . "• Отчетов: {$reportsCount}\n"
                . "• Пользователей: {$usersCount}\n\n"
                . "✅ <i>База данных успешно сохранена в архив.</i>";

            $params = [
                'chat_id' => $chatId,
                'caption' => $caption,
                'parse_mode' => 'HTML',
            ];

            if (!empty($threadId)) {
                $params['message_thread_id'] = (int) $threadId;
            }

            $fileContents = file_get_contents($filePath);

            $response = Http::timeout(60)
                ->attach('document', $fileContents, $fileName)
                ->post("https://api.telegram.org/bot{$token}/sendDocument", $params);

            if ($response->successful()) {
                Log::info("Database backup {$fileName} successfully sent to Telegram chat {$chatId} (thread: {$threadId})");
                return [
                    'success' => true,
                    'file' => $fileName,
                    'size_kb' => $sizeKb,
                    'chat_id' => $chatId,
                    'thread_id' => $threadId,
                    'message' => 'Резервная копия успешно отправлена в Telegram!'
                ];
            }

            $errBody = $response->body();
            Log::error("Failed to send database backup to Telegram: {$errBody}");

            return [
                'success' => false,
                'error' => "Telegram API error: {$errBody}",
            ];
        } catch (\Throwable $e) {
            Log::error("DatabaseBackupService exception: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
