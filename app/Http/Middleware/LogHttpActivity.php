<?php

namespace App\Http\Middleware;

use App\Services\ActivityLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogHttpActivity
{
    /**
     * Handle an incoming request and log mutating actions and sensitive operations.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $startTime = microtime(true);

        $method = strtoupper($request->method());
        $path = $request->path();

        // Determine if this request represents an action to be logged
        $isMutatingMethod = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
        $isSensitiveGet = $method === 'GET' && (
            str_contains($path, 'backup') ||
            str_contains($path, 'clear-server-cache') ||
            str_contains($path, 'reset-database')
        );

        // Bypass high frequency webhooks or repetitive read polls from noisy logs
        $isNoisyWebhook = str_contains($path, 'telegram-gateway/webhook') || str_contains($path, 'telegram/webhook');

        $response = $next($request);

        $durationMs = round((microtime(true) - $startTime) * 1000, 1);
        $statusCode = $response->getStatusCode();

        if (($isMutatingMethod || $isSensitiveGet) && !$isNoisyWebhook) {
            $actor = ActivityLogger::resolveActor($request);
            $cleanParams = ActivityLogger::sanitizeDetails($request->except(['password', 'password_confirmation', '_token']));

            $summary = sprintf(
                '%s /%s [%d %s] in %sms',
                $method,
                ltrim($path, '/'),
                $statusCode,
                Response::$statusTexts[$statusCode] ?? '',
                $durationMs
            );

            $level = 'info';
            $actionTag = 'HTTP';

            if ($statusCode >= 500) {
                $level = 'error';
                $actionTag = 'HTTP_ERROR';
            } elseif ($statusCode >= 400) {
                $level = 'warning';
                $actionTag = 'HTTP_REJECTED';
            }

            ActivityLogger::log(
                $actionTag,
                $method,
                $summary,
                [
                    'url' => $request->fullUrl(),
                    'method' => $method,
                    'status_code' => $statusCode,
                    'duration_ms' => $durationMs,
                    'payload' => $cleanParams,
                    'ip' => $actor['ip'],
                    'user_agent' => $request->userAgent(),
                ],
                $level,
                $request
            );
        }

        return $response;
    }
}
