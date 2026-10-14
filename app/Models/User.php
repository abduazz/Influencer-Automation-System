<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'role', 'allowed_metrics', 'allowed_pages', 'allowed_projects', 'allowed_subdomains'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'allowed_metrics' => 'array',
            'allowed_pages' => 'array',
            'allowed_projects' => 'array',
            'allowed_subdomains' => 'array',
        ];
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

        if (empty($subdomain) || $subdomain === 'all') {
            return true;
        }

        if (empty($this->allowed_subdomains)) {
            // Null or empty array means all subdomains access by default
            return true;
        }

        return in_array($subdomain, $this->allowed_subdomains, true);
    }
}
