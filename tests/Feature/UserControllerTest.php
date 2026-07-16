<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\AllowedUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_add_user_to_access_list_with_name(): void
    {
        $payload = [
            'name' => 'Alice Smith',
            'email' => 'alice@company.com',
            'role' => 'pr_manager',
            'allowedMetrics' => ['deals', 'spend'],
        ];

        $response = $this->postJson('/api/allowed-users', $payload);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'name' => 'Alice Smith',
                'email' => 'alice@company.com',
                'role' => 'pr_manager',
            ]);

        $this->assertDatabaseHas('users', [
            'name' => 'Alice Smith',
            'email' => 'alice@company.com',
            'role' => 'pr_manager',
        ]);
    }

    public function test_can_list_authorized_users_including_names(): void
    {
        // Add a user directly
        User::create([
            'name' => 'Bob Johnson',
            'email' => 'bob@company.com',
            'role' => 'product_manager',
            'password' => bcrypt('password'),
        ]);

        $response = $this->getJson('/api/allowed-users');

        $response->assertStatus(200)
            ->assertJsonFragment([
                'name' => 'Bob Johnson',
                'email' => 'bob@company.com',
                'role' => 'product_manager',
            ]);
    }

    public function test_can_update_authorized_user_details(): void
    {
        $user = User::create([
            'name' => 'Bob Johnson',
            'email' => 'bob@company.com',
            'role' => 'product_manager',
            'password' => bcrypt('password'),
            'allowed_metrics' => ['deals'],
        ]);

        $payload = [
            'name' => 'Bob Updated',
            'role' => 'super_admin',
            'allowedMetrics' => ['deals', 'spend'],
        ];

        $response = $this->putJson("/api/allowed-users/{$user->id}", $payload);

        $response->assertStatus(200)
            ->assertJsonFragment([
                'name' => 'Bob Updated',
                'email' => 'bob@company.com',
                'role' => 'super_admin',
                'allowedMetrics' => ['deals', 'spend'],
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Bob Updated',
            'role' => 'super_admin',
        ]);
    }
}
