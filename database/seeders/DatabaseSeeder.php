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
            [
                'name' => 'PR Manager',
                'email' => 'pr@fluenceflow.com',
                'role' => UserRole::PrManager,
                'password' => Hash::make('password'),
            ],
            [
                'name' => 'Product Manager',
                'email' => 'product@fluenceflow.com',
                'role' => UserRole::ProductManager,
                'password' => Hash::make('password'),
            ],
        ];

        foreach ($users as $userData) {
            User::updateOrCreate(['email' => $userData['email']], $userData);
        }

        // Seed Projects
        $proj1 = Project::updateOrCreate(['id' => 1], [
            'name' => 'VK Fest Summer Promo',
            'description' => 'Promo campaign for VK Fest offline activations with lifestyle and tech bloggers.',
            'created_at' => '2026-06-01 00:00:00',
        ]);

        $proj2 = Project::updateOrCreate(['id' => 2], [
            'name' => 'SaaS AI Assistant Launch',
            'description' => 'Global integration campaign for new AI code assistant platform with developer channels.',
            'created_at' => '2026-06-15 00:00:00',
        ]);

        $proj3 = Project::updateOrCreate(['id' => 3], [
            'name' => 'Fitness Marathon 2026',
            'description' => 'Instagram Stories influencer marathon for fitness supplements and training schedules.',
            'created_at' => '2026-07-01 00:00:00',
        ]);

        // Seed Integrations
        $int1 = Integration::updateOrCreate(['id' => 1], [
            'project_id' => $proj1->id,
            'blogger_name' => 'Alex Tech Review',
            'start_date' => '2026-07-01',
            'platform' => Platform::Telegram,
            'referral_link' => 'https://vk.fest/promo?utm_source=alex_tech&utm_medium=tg',
            'price_per_slot' => 150,
            'slots_count' => 3,
            'paid_slots_count' => 2,
            'paid_amount' => 300,
            'total_amount' => 450,
            'end_date' => '2026-07-15',
            'status' => 'active',
            'blogger_cabinet_token' => 'tok_alextech',
            'slots_config' => [
                ['platform' => 'Telegram', 'format' => 'Post'],
                ['platform' => 'Telegram', 'format' => 'Post'],
                ['platform' => 'Telegram', 'format' => 'Post'],
            ],
        ]);

        $int2 = Integration::updateOrCreate(['id' => 2], [
            'project_id' => $proj1->id,
            'blogger_name' => 'Masha Lifestyle',
            'start_date' => '2026-07-05',
            'platform' => Platform::Instagram,
            'referral_link' => 'https://vk.fest/promo?utm_source=masha_life&utm_medium=inst',
            'price_per_slot' => 300,
            'slots_count' => 4,
            'paid_slots_count' => 4,
            'paid_amount' => 1200,
            'total_amount' => 1200,
            'end_date' => '2026-07-10',
            'status' => 'completed',
            'blogger_cabinet_token' => 'tok_mashalife',
            'slots_config' => [
                ['platform' => 'Instagram', 'format' => 'Stories'],
                ['platform' => 'Instagram', 'format' => 'Stories'],
                ['platform' => 'Instagram', 'format' => 'Stories'],
                ['platform' => 'Instagram', 'format' => 'Stories'],
            ],
        ]);

        $int3 = Integration::updateOrCreate(['id' => 3], [
            'project_id' => $proj2->id,
            'blogger_name' => 'CodeGeek Channel',
            'start_date' => '2026-07-12',
            'platform' => Platform::YouTube,
            'referral_link' => 'https://saas-ai.io/start?utm_campaign=geek_yt',
            'price_per_slot' => 800,
            'slots_count' => 1,
            'paid_slots_count' => 1,
            'paid_amount' => 800,
            'total_amount' => 800,
            'end_date' => '2026-07-20',
            'status' => 'active',
            'blogger_cabinet_token' => 'tok_codegeek',
            'slots_config' => [
                ['platform' => 'YouTube', 'format' => 'Release'],
            ],
        ]);

        $int4 = Integration::updateOrCreate(['id' => 4], [
            'project_id' => $proj3->id,
            'blogger_name' => 'Elena Fit & Health',
            'start_date' => '2026-07-08',
            'platform' => Platform::Instagram,
            'referral_link' => 'https://fitmara.com/join?utm_source=elena_fit',
            'price_per_slot' => 200,
            'slots_count' => 5,
            'paid_slots_count' => 3,
            'paid_amount' => 600,
            'total_amount' => 1000,
            'end_date' => '2026-07-18',
            'status' => 'active',
            'blogger_cabinet_token' => 'tok_elenafit',
            'slots_config' => [
                ['platform' => 'Instagram', 'format' => 'Stories'],
                ['platform' => 'Instagram', 'format' => 'Stories'],
                ['platform' => 'Instagram', 'format' => 'Stories'],
                ['platform' => 'Instagram', 'format' => 'Stories'],
                ['platform' => 'Instagram', 'format' => 'Stories'],
            ],
        ]);

        // Seed Reports
        Report::updateOrCreate(['id' => 1], [
            'date' => '2026-07-09',
            'project_id' => $proj1->id,
            'destination' => 'Direct Conversion Promo',
            'channel_blogger' => 'TG/Masha Dev Stories',
            'platform' => 'Telegram',
            'slots_count' => 2,
            'paid_slots_count' => 1,
            'price_per_slot' => 120,
            'paid_amount' => 120,
            'total_amount' => 240,
            'comments' => 'Good CTR observed on the first slot. Will follow up for the second one next week.',
            'slots_config' => [
                ['platform' => 'Telegram', 'format' => 'Post'],
                ['platform' => 'Telegram', 'format' => 'Post'],
            ],
        ]);

        Report::updateOrCreate(['id' => 2], [
            'date' => '2026-07-10',
            'project_id' => $proj2->id,
            'destination' => 'Beta Signups',
            'channel_blogger' => 'WebDev Mastery',
            'platform' => 'YouTube',
            'slots_count' => 1,
            'paid_slots_count' => 1,
            'price_per_slot' => 750,
            'paid_amount' => 750,
            'total_amount' => 750,
            'comments' => 'Video integration is live. Direct traffic spiking.',
            'slots_config' => [
                ['platform' => 'YouTube', 'format' => 'Release'],
            ],
        ]);

        // Seed Blogger Submissions
        BloggerSubmission::updateOrCreate(['id' => 1], [
            'integration_id' => $int2->id,
            'submitted_at' => '2026-07-09 18:30:00',
            'status' => 'approved',
            'data' => [
                'slot_1' => 'stories_screenshot_1_active.png',
                'slot_2' => 'stories_screenshot_2_metric.png',
                'slot_3' => 'stories_screenshot_3_swipe.png',
                'slot_4' => 'stories_screenshot_4_link.png',
            ],
        ]);
    }
}
