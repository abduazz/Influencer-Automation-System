<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Google\Auth\Credentials\ServiceAccountCredentials;

class GoogleSheetsService
{
    private static function getAccessToken()
    {
        $jsonKey = env('GOOGLE_SERVICE_ACCOUNT_JSON');
        if (!$jsonKey) {
            $filePath = storage_path('app/google-service-account.json');
            if (file_exists($filePath)) {
                $jsonKey = file_get_contents($filePath);
            } else {
                throw new \Exception("Google service account credentials not found in env(GOOGLE_SERVICE_ACCOUNT_JSON) or at $filePath");
            }
        }
        
        $jsonKeyCleaned = trim($jsonKey, "'\"");
        $config = json_decode($jsonKeyCleaned, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception("GOOGLE_SERVICE_ACCOUNT_JSON is not a valid JSON string: " . json_last_error_msg());
        }
        
        $credentials = new ServiceAccountCredentials(
            'https://www.googleapis.com/auth/spreadsheets',
            $config
        );
        
        $tokenInfo = $credentials->fetchAuthToken();
        if (!isset($tokenInfo['access_token'])) {
            throw new \Exception("Failed to retrieve access token from Google Auth library.");
        }
        
        return $tokenInfo['access_token'];
    }

    public static function appendReport($report)
    {
        $spreadsheetId = env('GOOGLE_SPREADSHEET_ID', '1_TBYmmaWZPIG5_Kz2Sr706w6Km_VS-l7Q2UtKADrrus');
        if (!$spreadsheetId) {
            Log::warning("GOOGLE_SPREADSHEET_ID not set in environment.");
            return false;
        }

        if (!$report->project_id) {
            Log::info("Skipping Google Sheets append: Report ID {$report->id} has no project.");
            return true;
        }

        try {
            $accessToken = self::getAccessToken();

            // Determine sheet (tab) name by project name or fallback
            $sheetName = $report->project?->name ?? 'Без проекта';

            // Ensure the sheet/tab exists
            self::ensureSheetExists($accessToken, $spreadsheetId, $sheetName);

            // Find the exact row number and index by checking column A values
            $targetInfo = self::getTargetRowAndIndex($accessToken, $spreadsheetId, $sheetName);
            $targetRow = $targetInfo['row'];
            $index = $targetInfo['index'];
 
            // Row columns: №, Назначение, Канал, Платформа, Сумма, Дата, Комментарии
            $destinationValue = $report->destination;
            if ($report->payment_type !== 'other') {
                $destinationValue = trim(($report->platform ?? '') . ' блогер интеграция');
            }

            $values = [
                [
                    $index,
                    $destinationValue,
                    $report->channel_blogger ?? '—',
                    $report->platform ?? '—',
                    (float) ($report->total_amount ?? 0),
                    $report->date ? $report->date->format('Y-m-d') : '',
                    $report->comments ?? '',
                ]
            ];
 
            // Write directly to the target row (this fills pre-formatted empty rows)
            $range = urlencode("'{$sheetName}'!A{$targetRow}:G{$targetRow}");
            $url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}/values/{$range}?valueInputOption=USER_ENTERED";
 
            $response = Http::withToken($accessToken)->put($url, [
                'values' => $values
            ]);
 
            if (!$response->successful()) {
                throw new \Exception("Google Sheets update API failed: " . $response->body());
            }
 
            Log::info("Successfully duplicated report ID {$report->id} to Google Sheet tab '{$sheetName}' at row {$targetRow}.");
            return true;
        } catch (\Throwable $e) {
            Log::error("Failed to append report to Google Sheets: " . $e->getMessage());
            return false;
        }
    }

    private static function ensureSheetExists($accessToken, $spreadsheetId, $sheetName)
    {
        // 1. Get spreadsheet info
        $url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}";
        $response = Http::withToken($accessToken)->get($url);

        if (!$response->successful()) {
            throw new \Exception("Failed to fetch spreadsheet metadata: " . $response->body());
        }

        $data = $response->json();
        $sheets = $data['sheets'] ?? [];

        foreach ($sheets as $s) {
            if (($s['properties']['title'] ?? '') === $sheetName) {
                return; // already exists
            }
        }

        // 2. Create new tab/sheet
        $batchUrl = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}:batchUpdate";
        $batchResponse = Http::withToken($accessToken)->post($batchUrl, [
            'requests' => [
                [
                    'addSheet' => [
                        'properties' => [
                            'title' => $sheetName
                        ]
                    ]
                ]
            ]
        ]);

        if (!$batchResponse->successful()) {
            throw new \Exception("Failed to create sheet '{$sheetName}': " . $batchResponse->body());
        }

        // 3. Populate layout:
        // Row 1: №, Назначение , Канал, Платформа, Сумма, Дата, Комментарии
        // Row 2: (empty), Итого, (empty), (empty), =SUM(E3:E1000), (empty), (empty)
        $layoutValues = [
            ['№', 'Назначение ', 'Канал', 'Платформа', 'Сумма', 'Дата', 'Комментарии'],
            ['', 'Итого', '', '', '=SUM(E3:E1000)', '', '']
        ];

        $range = urlencode("'{$sheetName}'!A1:G2");
        $updateUrl = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}/values/{$range}?valueInputOption=USER_ENTERED";

        $updateResponse = Http::withToken($accessToken)->put($updateUrl, [
            'values' => $layoutValues
        ]);

        if (!$updateResponse->successful()) {
            throw new \Exception("Failed to update layout headers for '{$sheetName}': " . $updateResponse->body());
        }
    }

    private static function getTargetRowAndIndex($accessToken, $spreadsheetId, $sheetName)
    {
        $range = urlencode("'{$sheetName}'!A3:A1000");
        $url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}/values/{$range}";

        $targetRow = 3;
        $index = 1;

        $response = Http::withToken($accessToken)->get($url);
        if ($response->successful()) {
            $data = $response->json();
            $values = $data['values'] ?? [];
            
            foreach ($values as $row) {
                $cellValue = isset($row[0]) ? trim($row[0]) : '';
                if ($cellValue === '') {
                    break;
                }
                $targetRow++;
                $index = intval($cellValue) + 1;
            }
        }

        return [
            'row' => $targetRow,
            'index' => $index
        ];
    }
}
