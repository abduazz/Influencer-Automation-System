<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DatabaseBackupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DatabaseBackupController extends Controller
{
    protected DatabaseBackupService $backupService;

    public function __construct(DatabaseBackupService $backupService)
    {
        $this->backupService = $backupService;
    }

    /**
     * Download the database backup directly as a .sqlite file
     */
    public function download(Request $request): BinaryFileResponse|JsonResponse
    {
        try {
            $filePath = $this->backupService->createBackup();
            $fileName = basename($filePath);

            return response()->download($filePath, $fileName, [
                'Content-Type' => 'application/x-sqlite3',
                'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Не удалось создать резервную копию: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Manually trigger sending the database backup to Telegram topic #597
     */
    public function sendToTelegram(Request $request): JsonResponse
    {
        $result = $this->backupService->sendToTelegram();

        if ($result['success']) {
            return response()->json([
                'success' => true,
                'message' => 'Резервная копия успешно отправлена в Telegram!',
                'data' => $result,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => $result['error'] ?? 'Не удалось отправить файл в Telegram',
        ], 500);
    }
}
