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

        $content = File::get($path);
        
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
}
