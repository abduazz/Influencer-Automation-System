<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ActivityLogger
{
    /**
     * Resolve the active actor (user email, role, IP, etc.) from the request or session.
     */
    public static function resolveActor(?Request $request = null): array
    {
        $req = $request ?? request();

        /** @var User|null $user */
        $user = auth()->user() ?? ($req ? $req->user() : null);

        $email = null;
        $role = null;

        if ($user instanceof User) {
            $email = $user->email;
            $role = is_object($user->role) && isset($user->role->value) ? $user->role->value : (string) $user->role;
        }

        if (!$email && $req) {
            $email = $req->header('X-User-Email') 
                ?? $req->cookie('ff_user_email') 
                ?? (session()->has('user_email') ? session('user_email') : null);
        }

        if (!$role && $req) {
            $role = $req->header('X-User-Role') 
                ?? $req->cookie('ff_user_role') 
                ?? (session()->has('user_role') ? session('user_role') : null);
        }

        $ip = $req ? $req->ip() : '127.0.0.1';
        $subdomain = class_exists(SubdomainService::class) && $req ? SubdomainService::resolve($req) : '1';

        return [
            'email' => $email ? strtolower(trim($email)) : 'system/guest',
            'role' => $role ?: 'guest',
            'ip' => $ip,
            'subdomain' => $subdomain ?: '1',
        ];
    }

    /**
     * Log an action with structured context.
     */
    public static function log(string $category, string $action, string $description, array $details = [], string $level = 'info', ?Request $request = null): void
    {
        $actor = self::resolveActor($request);

        $categoryUpper = strtoupper($category);
        $actionUpper = strtoupper($action);

        $message = sprintf(
            '[%s:%s] %s | User: %s (%s) | IP: %s | Subdomain: %s',
            $categoryUpper,
            $actionUpper,
            $description,
            $actor['email'],
            $actor['role'],
            $actor['ip'],
            $actor['subdomain']
        );

        $context = [
            'category' => $categoryUpper,
            'action' => $actionUpper,
            'actor' => $actor,
            'details' => self::sanitizeDetails($details),
        ];

        match (strtolower($level)) {
            'warning', 'warn' => Log::warning($message, $context),
            'error' => Log::error($message, $context),
            'debug' => Log::debug($message, $context),
            default => Log::info($message, $context),
        };
    }

    /**
     * Mask sensitive values like passwords, tokens, API keys.
     */
    public static function sanitizeDetails(array $data): array
    {
        $sensitiveKeys = ['password', 'password_confirmation', 'token', 'secret', 'key', 'auth', 'api_key', 'cookie'];

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = self::sanitizeDetails($value);
            } elseif (is_string($key)) {
                $lowerKey = strtolower($key);
                foreach ($sensitiveKeys as $sensitive) {
                    if (str_contains($lowerKey, $sensitive)) {
                        $data[$key] = '********';
                        break;
                    }
                }
            }
        }

        return $data;
    }

    public static function auth(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('AUTH', $action, $description, $details, $level);
    }

    public static function project(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('PROJECT', $action, $description, $details, $level);
    }

    public static function subdomain(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('SUBDOMAIN', $action, $description, $details, $level);
    }

    public static function integration(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('INTEGRATION', $action, $description, $details, $level);
    }

    public static function user(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('USER', $action, $description, $details, $level);
    }

    public static function kanban(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('KANBAN', $action, $description, $details, $level);
    }

    public static function requisites(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('REQUISITES', $action, $description, $details, $level);
    }

    public static function submission(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('SUBMISSION', $action, $description, $details, $level);
    }

    public static function bulk(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('BULK_PURCHASE', $action, $description, $details, $level);
    }

    public static function report(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('REPORT', $action, $description, $details, $level);
    }

    public static function backup(string $action, string $description, array $details = [], string $level = 'info'): void
    {
        self::log('BACKUP', $action, $description, $details, $level);
    }
}
