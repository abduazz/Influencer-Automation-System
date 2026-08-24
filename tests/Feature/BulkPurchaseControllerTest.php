<?php

namespace Tests\Feature;

use App\Models\BulkPurchase;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BulkPurchaseControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.telegram.bot_token' => 'fake_token']);
        config(['services.telegram.reports_chat_id' => 'fake_chat_id']);
    }

    public function test_creating_bulk_purchase_registers_package_and_financial_report(): void
    {
        Http::fake([
            'https://api.telegram.org/bot*' => Http::response(['ok' => true], 200),
        ]);

        $payload = [
            'bloggerName' => 'big_channel',
            'platform' => 'Telegram',
            'totalSlots' => 10,
            'pricePerSlot' => 1000.00,
            'paidAmount' => 10000.00,
            'purchaseDate' => '2026-07-24',
            'comments' => 'Bulk package deal',
        ];

        $response = $this->postJson('/api/bulk-purchases', $payload);
        $response->assertStatus(201);
        $response->assertJsonFragment([
            'bloggerName' => 'big_channel',
            'totalSlots' => 10,
            'allocatedSlots' => 0,
            'remainingSlots' => 10,
        ]);

        $this->assertDatabaseHas('bulk_purchases', [
            'blogger_name' => 'big_channel',
            'total_slots' => 10,
            'price_per_slot' => 1000.00,
            'total_amount' => 10000.00,
        ]);

        // Financial report should be automatically created
        $this->assertDatabaseHas('reports', [
            'channel_blogger' => 'big_channel',
            'slots_count' => 10,
            'total_amount' => 10000.00,
        ]);
    }

    public function test_allocating_slots_from_bulk_purchase_creates_integrations(): void
    {
        Http::fake([
            'https://api.telegram.org/bot*' => Http::response(['ok' => true], 200),
        ]);

        $projectA = Project::create(['name' => 'Project A', 'description' => 'Desc A']);
        $projectB = Project::create(['name' => 'Project B', 'description' => 'Desc B']);

        $bulkPurchase = BulkPurchase::create([
            'blogger_name' => 'mega_blogger',
            'platform' => 'Telegram',
            'total_slots' => 10,
            'price_per_slot' => 1000.00,
            'paid_amount' => 10000.00,
            'total_amount' => 10000.00,
            'purchase_date' => '2026-07-24',
            'slots_config' => array_map(fn($i) => [
                'slot' => $i,
                'platform' => 'Telegram',
                'format' => 'Post',
                'projectId' => null,
                'allocatedAt' => null,
            ], range(1, 10)),
        ]);

        // Today (Week 1): Allocate 2 slots to Project A
        $allocateResponse1 = $this->postJson("/api/bulk-purchases/{$bulkPurchase->id}/allocate", [
            'projectId' => $projectA->id,
            'slotsCount' => 2,
        ]);
        $allocateResponse1->assertStatus(200);
        $allocateResponse1->assertJsonFragment([
            'allocatedSlots' => 2,
            'remainingSlots' => 8,
        ]);

        // Assert Integration for Project A created with 2 slots @ 1000 = 2000 total
        $this->assertDatabaseHas('integrations', [
            'project_id' => $projectA->id,
            'blogger_name' => 'mega_blogger',
            'slots_count' => 2,
            'total_amount' => 2000.00,
        ]);

        // Next Week (Week 2): Allocate 3 slots to Project B
        $allocateResponse2 = $this->postJson("/api/bulk-purchases/{$bulkPurchase->id}/allocate", [
            'projectId' => $projectB->id,
            'slotsCount' => 3,
        ]);
        $allocateResponse2->assertStatus(200);
        $allocateResponse2->assertJsonFragment([
            'allocatedSlots' => 5,
            'remainingSlots' => 5,
        ]);

        // Assert Integration for Project B created with 3 slots @ 1000 = 3000 total
        $this->assertDatabaseHas('integrations', [
            'project_id' => $projectB->id,
            'blogger_name' => 'mega_blogger',
            'slots_count' => 3,
            'total_amount' => 3000.00,
        ]);
    }
}
