<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use Illuminate\Http\Request;

class SubdomainService
{
    /**
     * Resolves the current subdomain from the request.
     * Returns string (e.g. '1', '2') or null if global / unassigned.
     */
    public static function resolve(?Request $request = null): ?string
    {
        $request = $request ?? request();

        // 1. Explicit header override (e.g. for API clients, testing, dev)
        $header = $request->header('X-Subdomain');
        if (!empty($header)) {
            $val = strtolower(trim($header));
            if ($val !== '' && $val !== 'all') {
                return $val;
            }
            if ($val === 'all') {
                return null;
            }
        }

        // 2. Query param override (e.g. ?subdomain=1 for easy preview/testing or switching)
        if ($request->has('subdomain')) {
            $querySub = strtolower(trim((string) $request->query('subdomain')));
            if ($querySub !== '' && $querySub !== 'all') {
                return $querySub;
            }
            if ($querySub === 'all') {
                return null;
            }
        }

        $host = $request->getHost();

        // 3. Skip IP addresses (e.g. 89.39.94.45 or 127.0.0.1)
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return null;
        }

        // 4. Localhost support (e.g. 1.localhost:8000 -> '1')
        if (str_ends_with($host, 'localhost')) {
            $parts = explode('.', $host);
            if (count($parts) > 1 && $parts[0] !== 'localhost') {
                return strtolower($parts[0]);
            }
            return null;
        }

        // 5. Standard domain parsing (e.g. 1.tezi.uz -> '1', 2.tezi.uz -> '2')
        $parts = explode('.', $host);
        if (count($parts) >= 3) {
            $sub = strtolower($parts[0]);
            // Ignore system / non-tenant subdomains
            if (in_array($sub, ['www', 'mail', 'ftp', 'smtp', 'admin', 'api'])) {
                return null;
            }
            return $sub;
        }

        return null;
    }

    /**
     * Get filtered project IDs for the current request context.
     * Returns an array of IDs if scoped, or null if all projects are accessible.
     */
    public static function getScopedProjectIds(?Request $request = null, ?User $user = null): ?array
    {
        $subdomain = self::resolve($request);

        $query = Project::query();

        if ($subdomain !== null) {
            // Match projects explicitly assigned to this subdomain
            // If subdomain is '1', also treat NULL as '1' for backwards compatibility
            if ($subdomain === '1') {
                $query->where(function ($q) {
                    $q->where('subdomain', '1')->orWhereNull('subdomain')->orWhere('subdomain', '');
                });
            } else {
                $query->where('subdomain', $subdomain);
            }
        } elseif ($user && !$user->isSuperAdmin()) {
            // No subdomain restriction, but user might have allowed_projects
            if (!empty($user->allowed_projects) && is_array($user->allowed_projects)) {
                return array_map('intval', $user->allowed_projects);
            }
            return null;
        } else {
            // No subdomain restriction and super admin or guest
            return null;
        }

        $projectIds = $query->pluck('id')->map(fn($id) => (int) $id)->toArray();

        // If user is not superadmin and has allowed_projects, intersect
        if ($user && !$user->isSuperAdmin() && !empty($user->allowed_projects) && is_array($user->allowed_projects)) {
            $userAllowed = array_map('intval', $user->allowed_projects);
            $projectIds = array_values(array_intersect($projectIds, $userAllowed));
        }

        return $projectIds;
    }
}
