<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class GoogleSheetsService
{
    private static function getClient()
    {
        $client = new \Google\Client();
        $client->setApplicationName('Influencer Automation System');
        $client->setScopes([\Google\Service\Sheets::SPREADSHEETS]);
        
        $jsonKey = env('GOOGLE_SERVICE_ACCOUNT_JSON');
        if (!$jsonKey) {
            $filePath = storage_path('app/google-service-account.json');
            if (file_exists($filePath)) {
                $client->setAuthConfig($filePath);
                return $client;
            }
            throw new \Exception("Google service account credentials not found in env(GOOGLE_SERVICE_ACCOUNT_JSON) or at $filePath");
        }
        
        // Strip any surrounding single/double quotes that might be parsed from dotenv
        $jsonKeyCleaned = trim($jsonKey, "'\"");
        $config = json_decode($jsonKeyCleaned, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception("GOOGLE_SERVICE_ACCOUNT_JSON is not a valid JSON string: " . json_last_error_msg());
        }
        
        $client->setAuthConfig($config);
        return $client;
    }

    public static function appendReport($report)
    {
        $spreadsheetId = env('GOOGLE_SPREADSHEET_ID', '1_TBYmmaWZPIG5_Kz2Sr706w6Km_VS-l7Q2UtKADrrus');
        if (!$spreadsheetId) {
            Log::warning("GOOGLE_SPREADSHEET_ID not set in environment.");
            return false;
        }

        try {
            $client = self::getClient();
            $service = new \Google\Service\Sheets($client);

            // Determine sheet (tab) name by project name or fallback
            $sheetName = $report->project->name ?? 'Без проекта';

            // Ensure the sheet/tab exists
            self::ensureSheetExists($service, $spreadsheetId, $sheetName);

            // Get next sequential index for the first column
            $index = self::getNextIndex($service, $spreadsheetId, $sheetName);

            // Row columns: №, Назначение, Канал, Платформа, Сумма, Дата, Комментарии
            $values = [
                [
                    $index,
                    $report->destination,
                    $report->channel_blogger ?? '—',
                    $report->platform ?? '—',
                    (float) ($report->total_amount ?? 0),
                    $report->date ? $report->date->format('Y-m-d') : '',
                    $report->comments ?? '',
                ]
            ];

            $body = new \Google\Service\Sheets\ValueRange([
                'values' => $values
            ]);

            $params = [
                'valueInputOption' => 'USER_ENTERED'
            ];

            // Append right after the table ending
            $range = "'{$sheetName}'!A3";
            $service->spreadsheets_values->append($spreadsheetId, $range, $body, $params);

            Log::info("Successfully duplicated report ID {$report->id} to Google Sheet tab '{$sheetName}'.");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to append report to Google Sheets: " . $e->getMessage());
            return false;
        }
    }

    private static function ensureSheetExists(\Google\Service\Sheets $service, $spreadsheetId, $sheetName)
    {
        $spreadsheet = $service->spreadsheets->get($spreadsheetId);
        $sheets = $spreadsheet->getSheets();

        foreach ($sheets as $s) {
            if ($s->getProperties()->getTitle() === $sheetName) {
                return; // already exists
            }
        }

        // Create new tab/sheet
        $body = new \Google\Service\Sheets\BatchUpdateSpreadsheetRequest([
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

        $service->spreadsheets->batchUpdate($spreadsheetId, $body);

        // Populate layout:
        // Row 1: №, Назначение , Канал, Платформа, Сумма, Дата, Комментарии
        // Row 2: (empty), Итого, (empty), (empty), =SUM(E3:E1000), (empty), (empty)
        $layoutValues = [
            ['№', 'Назначение ', 'Канал', 'Платформа', 'Сумма', 'Дата', 'Комментарии'],
            ['', 'Итого', '', '', '=SUM(E3:E1000)', '', '']
        ];

        $bodyValues = new \Google\Service\Sheets\ValueRange([
            'values' => $layoutValues
        ]);

        $params = [
            'valueInputOption' => 'USER_ENTERED'
        ];

        $service->spreadsheets_values->update($spreadsheetId, "'{$sheetName}'!A1:G2", $bodyValues, $params);
    }

    private static function getNextIndex(\Google\Service\Sheets $service, $spreadsheetId, $sheetName)
    {
        $range = "'{$sheetName}'!A3:A1000";
        try {
            $response = $service->spreadsheets_values->get($spreadsheetId, $range);
            $values = $response->getValues();
            if (empty($values)) {
                return 1;
            }
            return count($values) + 1;
        } catch (\Exception $e) {
            return 1;
        }
    }
}
