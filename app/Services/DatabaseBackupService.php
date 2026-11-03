<?php

namespace App\Services;

use App\Models\Integration;
use App\Models\Project;
use App\Models\Report;
use App\Models\User;
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

        // Clean up target file if it already exists to avoid VACUUM INTO error
        if (file_exists($destination)) {
            @unlink($destination);
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

        // Clean up backups older than 14 days to preserve disk space
        $this->cleanupOldBackups($backupDir, 14);

        return $destination;
    }

    /**
     * Send backup file to dedicated Telegram topic (default: https://t.me/c/4424306910/597)
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

            $projectsCount = Project::count();
            $integrationsCount = Integration::count();
            $reportsCount = Report::count();
            $usersCount = User::count();

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

            // Handle migration if group upgraded to supergroup
            $body = $response->body();
            $resData = json_decode($body, true);
            if (isset($resData['parameters']['migrate_to_chat_id'])) {
                $newChatId = $resData['parameters']['migrate_to_chat_id'];
                Log::info("Telegram backup group upgraded to supergroup. Migrating chat ID from {$chatId} to {$newChatId}");
                $params['chat_id'] = $newChatId;
                $response = Http::timeout(60)
                    ->attach('document', $fileContents, $fileName)
                    ->post("https://api.telegram.org/bot{$token}/sendDocument", $params);
                $body = $response->body();
                $resData = json_decode($body, true);
            }

            // Fallback 1: If topic/thread failed, retry sending directly to main group without thread_id
            if (!$response->successful() && !empty($params['message_thread_id'])) {
                Log::warning("Telegram backup to thread {$threadId} failed ({$body}), retrying without message_thread_id...");
                unset($params['message_thread_id']);
                $response = Http::timeout(60)
                    ->attach('document', $fileContents, $fileName)
                    ->post("https://api.telegram.org/bot{$token}/sendDocument", $params);
                $body = $response->body();
            }

            // Fallback 2: If HTML parse error, strip tags and send plain caption
            if (!$response->successful() && str_contains(strtolower($body), 'can\'t parse entities')) {
                Log::warning("Telegram backup caption HTML failed, retrying plain text...");
                $params['caption'] = strip_tags($caption);
                unset($params['parse_mode']);
                $response = Http::timeout(60)
                    ->attach('document', $fileContents, $fileName)
                    ->post("https://api.telegram.org/bot{$token}/sendDocument", $params);
                $body = $response->body();
            }

            if ($response->successful()) {
                Log::info("Database backup {$fileName} successfully sent to Telegram chat {$params['chat_id']}");
                return [
                    'success' => true,
                    'file' => $fileName,
                    'size_kb' => $sizeKb,
                    'chat_id' => $params['chat_id'],
                    'thread_id' => $params['message_thread_id'] ?? null,
                    'message' => 'Резервная копия успешно отправлена в Telegram!'
                ];
            }

            Log::error("Failed to send database backup to Telegram: {$body}");

            return [
                'success' => false,
                'error' => "Telegram API error: {$body}",
            ];
        } catch (\Throwable $e) {
            Log::error("DatabaseBackupService exception: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Clean up older backup snapshots to preserve disk space
     */
    protected function cleanupOldBackups(string $backupDir, int $keepDays = 14): void
    {
        try {
            $files = File::files($backupDir);
            $cutoff = now()->subDays($keepDays)->getTimestamp();

            foreach ($files as $file) {
                // Only clean up database_backup_*.sqlite or pre_deploy_*.sqlite
                $name = $file->getFilename();
                if ((str_starts_with($name, 'database_backup_') || str_starts_with($name, 'pre_deploy_')) && $file->getMTime() < $cutoff) {
                    @unlink($file->getRealPath());
                }
            }
        } catch (\Throwable $e) {
            Log::warning("Failed to clean up old backups: " . $e->getMessage());
        }
    }
}

