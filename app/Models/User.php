<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'telegram_id', 'telegram_username', 'password', 'must_change_password', 'role', 'allowed_metrics', 'allowed_pages', 'allowed_projects', 'allowed_subdomains', 'last_login_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'must_change_password' => 'boolean',
            'password' => 'hashed',
            'role' => UserRole::class,
            'allowed_metrics' => 'array',
            'allowed_pages' => 'array',
            'allowed_projects' => 'array',
            'allowed_subdomains' => 'array',
        ];
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(UserSession::class);
    }

    public function passkeys(): HasMany
    {
        return $this->hasMany(UserPasskey::class);
    }

    public function authChallenges(): HasMany
    {
        return $this->hasMany(AuthChallenge::class);
    }

    /**
     * Find a user by Telegram @username (primary), email, or handle prefix.
     */
    public static function findByTelegramUsername(string $username): ?self
    {
        $normalized = ltrim(mb_strtolower(trim($username)), '@');
        if ($normalized === '') {
            return null;
        }

        return self::query()
            ->whereNotNull('telegram_username')
            ->whereRaw("LOWER(REPLACE(telegram_username, '@', '')) = ?", [$normalized])
            ->first();
    }

    /**
     * Find a user by email, handle prefix, @telegram_username, or exact name.
     */
    public static function findByLoginIdentifier(string $identifier): ?self
    {
        $clean = mb_strtolower(trim($identifier));
        if ($clean === '') {
            return null;
        }

        $normalized = ltrim($clean, '@');
        $resolvedEmail = str_contains($normalized, '@')
            ? $normalized
            : $normalized . '@tezi.uz';

        $user = self::query()
            ->whereRaw('LOWER(email) = ?', [$normalized])
            ->orWhereRaw('LOWER(email) = ?', [$clean])
            ->orWhereRaw('LOWER(email) = ?', [$resolvedEmail])
            ->first();

        if ($user) {
            return $user;
        }

        // Match by stored telegram_username (with or without leading @)
        $user = self::query()
            ->whereNotNull('telegram_username')
            ->whereRaw("LOWER(REPLACE(telegram_username, '@', '')) = ?", [$normalized])
            ->first();

        if ($user) {
            return $user;
        }

        // Fallback match by email local-part or trimmed display name
        return self::query()
            ->whereRaw('LOWER(name) = ?', [$clean])
            ->orWhereRaw('LOWER(name) = ?', [$normalized])
            ->orWhereRaw("LOWER(email) LIKE ?", [$normalized . '@%'])
            ->first();
    }

    public function canAccessPanel(Panel $panel): bool
    {
        return $this->role instanceof UserRole;
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SuperAdmin;
    }

    public function isExecutive(): bool
    {
        return $this->role === UserRole::Executive;
    }

    public function isPrManager(): bool
    {
        return $this->role === UserRole::PrManager;
    }

    public function isProductManager(): bool
    {
        return $this->role === UserRole::ProductManager;
    }

    /**
     * Check if user has permission to access a specific subdomain slug.
     */
    public function hasSubdomainAccess(?string $subdomain): bool
    {
        if ($this->isSuperAdmin() || $this->isExecutive()) {
            return true;
        }

        if (empty($subdomain) || $subdomain === 'all' || $subdomain === 'timeline') {
            return true;
        }

        if (empty($this->allowed_subdomains)) {
            // Null or empty array means all subdomains access by default
            return true;
        }

        return in_array($subdomain, $this->allowed_subdomains, true);
    }

    /**
     * Resolve the route binding for the model by ID, mock ID, or email/login handle.
     */
    public function resolveRouteBinding($value, $field = null)
    {
        if (is_numeric($value)) {
            $user = $this->where('id', $value)->first();
            if ($user) return $user;
        }

        // Support string mock IDs like 'user-4' or 'user-5'
        if (is_string($value) && str_starts_with($value, 'user-')) {
            $num = substr($value, 5);
            if (is_numeric($num)) {
                $user = $this->where('id', $num)->first();
                if ($user) return $user;
            }
        }

        // Support email, stripped @handle, or @tezi.uz suffix
        $clean = is_string($value) ? strtolower(trim($value)) : '';
        $normalized = ltrim($clean, '@');

        return $this->where('email', $clean)
            ->orWhere('email', $normalized)
            ->orWhere('email', $normalized . '@tezi.uz')
            ->first();
    }
}
