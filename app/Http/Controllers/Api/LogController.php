<?php
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

class LogController extends Controller
{
    public function index()
    {
        $path = storage_path('logs/laravel.log');
        if (!File::exists($path)) {
            return response()->json([]);
        }

        // Only read the last 500 lines of the log to prevent memory exhaustion
        $content = $this->getTail($path, 500);
        
        // Split by the pattern matching the start of a log entry, e.g. "[YYYY-MM-DD HH:MM:SS]"
        $entries = preg_split('/(?=\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\])/', $content);
        
        $parsed = [];
        foreach ($entries as $entry) {
            $entry = trim($entry);
            if (empty($entry)) {
                continue;
            }

            // Parse timestamp, environment, level, and message
            // Pattern example: "[2026-07-13 11:06:04] production.ERROR: Message here"
            if (preg_match('/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+)\.(\w+): (.*)/s', $entry, $matches)) {
                $parsed[] = [
                    'timestamp' => $matches[1],
                    'environment' => $matches[2],
                    'level' => strtoupper($matches[3]),
                    'message' => trim($matches[4]),
                ];
            } else {
                $parsed[] = [
                    'timestamp' => '',
                    'environment' => '',
                    'level' => 'INFO',
                    'message' => $entry,
                ];
            }
        }

        // Return newest logs first
        return response()->json(array_reverse($parsed));
    }

    public function destroy()
    {
        $path = storage_path('logs/laravel.log');
        if (File::exists($path)) {
            File::put($path, ''); // truncate the log file
        }
        return response()->noContent();
    }

    /**
     * Efficiently read the last N lines of a file
     */
    private function getTail($filepath, $lines = 100)
    {
        if (!file_exists($filepath)) {
            return '';
        }
        $f = fopen($filepath, 'rb');
        if (!$f) {
            return '';
        }

        // Seek to the end
        fseek($f, 0, SEEK_END);
        $pos = ftell($f);
        
        $buffer = '';
        $lineCount = 0;
        $chunkSize = 4096;

        while ($pos > 0 && $lineCount <= $lines) {
            $readSize = min($pos, $chunkSize);
            $pos -= $readSize;
            fseek($f, $pos, SEEK_SET);
            $chunk = fread($f, $readSize);
            $buffer = $chunk . $buffer;
            
            $lineCount = substr_count($buffer, "\n");
        }

        fclose($f);

        // If we read more lines than requested, slice them
        if ($lineCount > $lines) {
            $parts = explode("\n", $buffer);
            $parts = array_slice($parts, -$lines);
            $buffer = implode("\n", $parts);
        }

        return $buffer;
    }
}
