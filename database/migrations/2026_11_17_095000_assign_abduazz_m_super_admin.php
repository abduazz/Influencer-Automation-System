<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        $handle = 'abduazz_m';
        $formattedHandle = '@abduazz_m';

        // 1. Check if a user already has @abduazz_m
        $existingByHandle = User::whereNotNull('telegram_username')
            ->whereRaw("LOWER(REPLACE(telegram_username, '@', '')) = ?", [$handle])
            ->first();

        if ($existingByHandle) {
            if ($existingByHandle->role !== UserRole::SuperAdmin) {
                $existingByHandle->forceFill(['role' => UserRole::SuperAdmin])->save();
            }
            return;
        }

        // 2. Otherwise attach @abduazz_m to primary Super Admin account if present
        $primaryAdmin = User::whereRaw('LOWER(email) = ?', ['abduazizmurodqosimov@gmail.com'])->first()
            ?: User::where('role', UserRole::SuperAdmin->value)->orderBy('id')->first();

        if ($primaryAdmin) {
            $primaryAdmin->forceFill([
                'telegram_username' => $formattedHandle,
                'role' => UserRole::SuperAdmin,
            ])->save();
            return;
        }

        // 3. Fallback: create Super Admin account if database was empty
        User::create([
            'name' => 'Super Admin',
            'email' => 'abduazizmurodqosimov@gmail.com',
            'telegram_username' => $formattedHandle,
            'role' => UserRole::SuperAdmin,
            'password' => Hash::make(bin2hex(random_bytes(16))),
        ]);
    }

    public function down(): void
    {
        // Preserve super admin access on rollback
    }
};
