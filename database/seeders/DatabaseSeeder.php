<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Project;
use App\Models\Integration;
use App\Models\Report;
use App\Models\BloggerSubmission;
use App\Enums\UserRole;
use App\Enums\Platform;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Clean up old mock users
        User::whereIn('email', ['pr@fluenceflow.com', 'product@fluenceflow.com'])->delete();

        // Seed Whitelisted Users
        $users = [
            [
                'name' => 'Super Admin',
                'email' => 'abduazizmurodqosimov@gmail.com',
                'role' => UserRole::SuperAdmin,
                'password' => Hash::make('password'),
            ],
            [
                'name' => 'Super Admin 2',
                'email' => 'khalilovdev@gmail.com',
                'role' => UserRole::SuperAdmin,
                'password' => Hash::make('password'),
            ],
        ];

        foreach ($users as $userData) {
            User::updateOrCreate(['email' => $userData['email']], $userData);
        }

    }
}
