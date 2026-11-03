<?php

namespace App\Services;

use App\Models\Integration;
use App\Models\Project;
use App\Models\Report;
use App\Models\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DatabaseBackupService
{
    /**
     * Create a clean database backup snapshot in storage/backups/
     * Supports SQLite, MySQL, MariaDB, and PostgreSQL.
     */
    public function createBackup(): string
    {
        $backupDir = storage_path('backups');
        File::ensureDirectoryExists($backupDir);

        $date = now()->format('Y-m-d_His');
        $connection = DB::connection();
        $driver = strtolower($connection->getDriverName());

        if ($driver === 'sqlite') {
            $destination = $this->backupSqliteDatabase($connection, $backupDir, $date);
        } elseif (in_array($driver, ['mysql', 'mariadb'])) {
            $destination = $this->backupMysqlDatabase($connection, $backupDir, $date);
        } elseif ($driver === 'pgsql') {
            $destination = $this->backupPgsqlDatabase($connection, $backupDir, $date);
        } else {
            $fileName = "database_backup_{$date}_{$driver}.sql";
            $destination = $backupDir . DIRECTORY_SEPARATOR . $fileName;
            $this->dumpPdoDatabase($connection, $destination);
        }

        if (!file_exists($destination) || filesize($destination) === 0) {
            throw new \RuntimeException("Не удалось создать файл резервной копии базы данных ({$destination})");
        }

        // Clean up backups older than 14 days to preserve disk space
        $this->cleanupOldBackups($backupDir, 14);

        return $destination;
    }

    /**
     * Backup SQLite database
     */
    protected function backupSqliteDatabase(ConnectionInterface $connection, string $backupDir, string $date): string
    {
        $fileName = "database_backup_{$date}.sqlite";
        $destination = $backupDir . DIRECTORY_SEPARATOR . $fileName;

        if (file_exists($destination)) {
            @unlink($destination);
        }

        // Candidate paths for SQLite database file
        $candidates = array_filter([
            $connection->getDatabaseName(),
            config('database.connections.sqlite.database'),
            database_path('database.sqlite'),
            storage_path('database.sqlite'),
            storage_path('database/database.sqlite'),
            base_path('database.sqlite'),
        ]);

        $resolvedSource = null;
        foreach ($candidates as $cand) {
            if (!empty($cand) && $cand !== ':memory:' && file_exists($cand)) {
                $resolvedSource = $cand;
                break;
            }
        }

        if ($resolvedSource) {
            // Try SQLite native VACUUM INTO for a consistent non-blocking snapshot
            try {
                $connection->statement("VACUUM INTO ?", [$destination]);
            } catch (\Throwable $e) {
                Log::warning("VACUUM INTO failed, falling back to copy: " . $e->getMessage());
                copy($resolvedSource, $destination);
            }

            if (!file_exists($destination) || filesize($destination) === 0) {
                copy($resolvedSource, $destination);
            }

            return $destination;
        }

        // If no physical sqlite file exists (e.g. in-memory or custom wrapper), export SQL dump
        Log::info("No physical SQLite file found, generating SQL dump snapshot...");
        $sqlFile = $backupDir . DIRECTORY_SEPARATOR . "database_backup_{$date}.sql";
        return $this->dumpPdoDatabase($connection, $sqlFile);
    }

    /**
     * Backup MySQL / MariaDB database
     */
    protected function backupMysqlDatabase(ConnectionInterface $connection, string $backupDir, string $date): string
    {
        $fileName = "database_backup_{$date}.sql";
        $destination = $backupDir . DIRECTORY_SEPARATOR . $fileName;

        if (file_exists($destination)) {
            @unlink($destination);
        }

        $config = $connection->getConfig();
        $host = $config['host'] ?? '127.0.0.1';
        $port = $config['port'] ?? '3306';
        $database = $config['database'] ?? '';
        $username = $config['username'] ?? '';
        $password = $config['password'] ?? '';

        // Check if mysqldump is available and executable
        $mysqldumpPath = $this->findBinary('mysqldump');
        if ($mysqldumpPath && !empty($database)) {
            try {
                $passArg = $password !== '' ? "-p" . escapeshellarg($password) : '';
                $cmd = sprintf(
                    "%s --host=%s --port=%s --user=%s %s %s > %s 2>/dev/null",
                    escapeshellcmd($mysqldumpPath),
                    escapeshellarg($host),
                    escapeshellarg((string) $port),
                    escapeshellarg($username),
                    $passArg,
                    escapeshellarg($database),
                    escapeshellarg($destination)
                );

                @exec($cmd, $output, $returnVar);
                if ($returnVar === 0 && file_exists($destination) && filesize($destination) > 0) {
                    return $destination;
                }
            } catch (\Throwable $e) {
                Log::warning("mysqldump execution failed, falling back to pure PHP PDO dumper: " . $e->getMessage());
            }
        }

        // Pure PHP PDO fallback (guaranteed on any environment without external tools)
        return $this->dumpPdoDatabase($connection, $destination);
    }

    /**
     * Backup PostgreSQL database
     */
    protected function backupPgsqlDatabase(ConnectionInterface $connection, string $backupDir, string $date): string
    {
        $fileName = "database_backup_{$date}.sql";
        $destination = $backupDir . DIRECTORY_SEPARATOR . $fileName;

        if (file_exists($destination)) {
            @unlink($destination);
        }

        $config = $connection->getConfig();
        $pgDumpPath = $this->findBinary('pg_dump');
        if ($pgDumpPath && !empty($config['database'])) {
            try {
                $host = $config['host'] ?? '127.0.0.1';
                $port = $config['port'] ?? '5432';
                $db = $config['database'];
                $user = $config['username'] ?? 'postgres';
                $pass = $config['password'] ?? '';

                $envPrefix = $pass !== '' ? "PGPASSWORD=" . escapeshellarg($pass) . " " : '';
                $cmd = sprintf(
                    "%s%s -h %s -p %s -U %s %s > %s 2>/dev/null",
                    $envPrefix,
                    escapeshellcmd($pgDumpPath),
                    escapeshellarg($host),
                    escapeshellarg((string) $port),
                    escapeshellarg($user),
                    escapeshellarg($db),
                    escapeshellarg($destination)
                );

                @exec($cmd, $output, $returnVar);
                if ($returnVar === 0 && file_exists($destination) && filesize($destination) > 0) {
                    return $destination;
                }
            } catch (\Throwable $e) {
                Log::warning("pg_dump execution failed, falling back to pure PHP PDO dumper: " . $e->getMessage());
            }
        }

        return $this->dumpPdoDatabase($connection, $destination);
    }

    /**
     * Find binary in system path
     */
    protected function findBinary(string $binary): ?string
    {
        if (!function_exists('exec')) {
            return null;
        }
        $out = @exec("command -v " . escapeshellarg($binary) . " 2>/dev/null");
        return (!empty($out) && file_exists(trim($out))) ? trim($out) : null;
    }

    /**
     * Universal database dumper written in pure PHP PDO.
     * Generates a clean .sql dump on any environment without requiring external binaries.
     */
    protected function dumpPdoDatabase(ConnectionInterface $connection, string $destination): string
    {
        /** @var \PDO $pdo */
        $pdo = $connection->getPdo();
        $driver = strtolower($connection->getDriverName());
        $dbName = (string) $connection->getDatabaseName();

        $handle = fopen($destination, 'w');
        if (!$handle) {
            throw new \RuntimeException("Cannot open file for writing: {$destination}");
        }

        $date = now()->format('Y-m-d H:i:s');
        fwrite($handle, "-- Influencer Automation System Database Backup\n");
        fwrite($handle, "-- DBMS: " . strtoupper($driver) . "\n");
        fwrite($handle, "-- Database: {$dbName}\n");
        fwrite($handle, "-- Generated: {$date}\n\n");

        if (in_array($driver, ['mysql', 'mariadb'])) {
            fwrite($handle, "SET FOREIGN_KEY_CHECKS=0;\n");
            fwrite($handle, "SET SQL_MODE=\"NO_AUTO_VALUE_ON_ZERO\";\n\n");
        }

        // Get list of tables
        $tables = [];
        if (in_array($driver, ['mysql', 'mariadb'])) {
            $stmt = $pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
            if ($stmt) {
                while ($row = $stmt->fetch(\PDO::FETCH_NUM)) {
                    $tables[] = $row[0];
                }
            }
        } elseif ($driver === 'sqlite') {
            $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            if ($stmt) {
                while ($row = $stmt->fetch(\PDO::FETCH_NUM)) {
                    $tables[] = $row[0];
                }
            }
        } elseif ($driver === 'pgsql') {
            $stmt = $pdo->query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
            if ($stmt) {
                while ($row = $stmt->fetch(\PDO::FETCH_NUM)) {
                    $tables[] = $row[0];
                }
            }
        }

        foreach ($tables as $table) {
            fwrite($handle, "-- --------------------------------------------------------\n");
            fwrite($handle, "-- Structure for table `{$table}`\n");
            fwrite($handle, "-- --------------------------------------------------------\n");
            fwrite($handle, "DROP TABLE IF EXISTS `{$table}`;\n");

            if (in_array($driver, ['mysql', 'mariadb'])) {
                $createStmt = $pdo->query("SHOW CREATE TABLE `{$table}`");
                if ($createStmt) {
                    $createRow = $createStmt->fetch(\PDO::FETCH_ASSOC);
                    $createSql = $createRow['Create Table'] ?? null;
                    if ($createSql) {
                        fwrite($handle, $createSql . ";\n\n");
                    }
                }
            } elseif ($driver === 'sqlite') {
                $createStmt = $pdo->query("SELECT sql FROM sqlite_master WHERE type='table' AND name=" . $pdo->quote($table));
                if ($createStmt) {
                    $createRow = $createStmt->fetch(\PDO::FETCH_ASSOC);
                    if (!empty($createRow['sql'])) {
                        fwrite($handle, $createRow['sql'] . ";\n\n");
                    }
                }
            }

            // Dump data
            $countStmt = $pdo->query("SELECT COUNT(*) FROM `{$table}`");
            $count = $countStmt ? (int) $countStmt->fetchColumn() : 0;
            if ($count === 0) {
                fwrite($handle, "-- (Table is empty)\n\n");
                continue;
            }

            fwrite($handle, "-- Data for table `{$table}` ({$count} rows)\n");
            $selectStmt = $pdo->query("SELECT * FROM `{$table}`");
            if ($selectStmt) {
                $batch = [];
                $batchSize = 100;
                $columns = null;

                while ($row = $selectStmt->fetch(\PDO::FETCH_ASSOC)) {
                    if ($columns === null) {
                        $columns = array_map(fn($col) => "`{$col}`", array_keys($row));
                    }

                    $escaped = array_map(function ($val) use ($pdo) {
                        if ($val === null) {
                            return 'NULL';
                        }
                        return $pdo->quote((string) $val);
                    }, $row);

                    $batch[] = "(" . implode(", ", $escaped) . ")";

                    if (count($batch) >= $batchSize) {
                        $insertSql = "INSERT INTO `{$table}` (" . implode(", ", $columns) . ") VALUES\n" . implode(",\n", $batch) . ";\n";
                        fwrite($handle, $insertSql);
                        $batch = [];
                    }
                }

                if (!empty($batch)) {
                    $insertSql = "INSERT INTO `{$table}` (" . implode(", ", $columns) . ") VALUES\n" . implode(",\n", $batch) . ";\n";
                    fwrite($handle, $insertSql);
                }
            }
            fwrite($handle, "\n");
        }

        if (in_array($driver, ['mysql', 'mariadb'])) {
            fwrite($handle, "SET FOREIGN_KEY_CHECKS=1;\n");
        }

        fclose($handle);
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
                    'error' => 'TELEGRAM_BOT_TOKEN не настроен в .env',
                ];
            }

            $chatId = config('services.telegram.backup_chat_id', '-1004424306910');
            $threadId = config('services.telegram.backup_thread_id', '597');

            $fileName = basename($filePath);
            $sizeKb = round(filesize($filePath) / 1024, 2);
            $dateStr = now()->format('d.m.Y H:i:s');
            $driverName = strtoupper(DB::connection()->getDriverName());

            $projectsCount = Project::count();
            $integrationsCount = Integration::count();
            $reportsCount = Report::count();
            $usersCount = User::count();

            $caption = "📦 <b>Резервная копия базы данных</b>\n\n"
                . "📅 <b>Дата:</b> {$dateStr}\n"
                . "🗄️ <b>СУБД:</b> {$driverName}\n"
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
