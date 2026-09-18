<?php

namespace Tests\Feature;

use App\Models\Integration;
use App\Models\Project;
use App\Models\User;
use App\Services\TelegramService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ReportIntegrationSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.telegram.bot_token' => 'fake_token']);
        config(['services.telegram.reports_chat_id' => 'fake_chat_id']);
    }

    public function test_multiple_reports_with_different_prices_accurately_update_integration(): void
    {
        Http::fake([
            'https://api.telegram.org/bot*' => Http::response(['ok' => true], 200),
        ]);

        $project = Project::create([
            'name' => 'Tezda',
            'description' => 'Test Project',
        ]);

        // 1. Create first report: 2 slots @ 1 812 500 = 3 625 000 UZS
        $payload1 = [
            'paymentType' => 'prepaid',
            'date' => '2026-08-01',
            'projectId' => $project->id,
            'destination' => 'https://bulink.io/tezda_davronovf',
            'channelBlogger' => 'DAVRONOV FAKTOR',
            'bloggerPageLink' => 'https://www.youtube.com/@DAVRONOVFACTOR/videos',
            'platform' => 'YouTube',
            'slotsCount' => 2,
            'paidSlotsCount' => 2,
            'pricePerSlot' => 1812500.00,
            'lang' => 'ru',
        ];

        $response1 = $this->postJson('/api/reports', $payload1);
        $response1->assertStatus(201);

        $integration = Integration::where('blogger_name', 'DAVRONOV FAKTOR')->first();
        $this->assertNotNull($integration);
        $this->assertEquals(2, $integration->slots_count);
        $this->assertEquals(2, $integration->paid_slots_count);
        $this->assertEquals(3625000.00, (float)$integration->paid_amount);
        $this->assertEquals(3625000.00, (float)$integration->total_amount);
        $this->assertCount(2, $integration->slots_config);

        // 2. Create second report: 2 slots @ 800 000 = 1 600 000 UZS
        $payload2 = [
            'paymentType' => 'prepaid',
            'date' => '2026-09-01',
            'projectId' => $project->id,
            'destination' => 'https://bulink.io/tezda_davronovf',
            'channelBlogger' => 'DAVRONOV FAKTOR',
            'bloggerPageLink' => 'https://www.youtube.com/@DAVRONOVFACTOR/videos',
            'platform' => 'YouTube',
            'slotsCount' => 2,
            'paidSlotsCount' => 2,
            'pricePerSlot' => 800000.00,
            'lang' => 'ru',
        ];

        $response2 = $this->postJson('/api/reports', $payload2);
        $response2->assertStatus(201);

        $integration->refresh();

        // Must accurately have 4 slots, 4 paid slots, and exact sum of 5 225 000 UZS (NOT 6 400 000!)
        $this->assertEquals(4, $integration->slots_count);
        $this->assertEquals(4, $integration->paid_slots_count);
        $this->assertEquals(5225000.00, (float)$integration->paid_amount);
        $this->assertEquals(5225000.00, (float)$integration->total_amount);
        $this->assertCount(4, $integration->slots_config);

        // Verify slot numbers in slots_config are 1, 2, 3, 4
        $slots = $integration->slots_config;
        $this->assertEquals(1, $slots[0]['slot']);
        $this->assertEquals(2, $slots[1]['slot']);
        $this->assertEquals(3, $slots[2]['slot']);
        $this->assertEquals(4, $slots[3]['slot']);

        // Verify API returns the correct formatted integration
        $apiResponse = $this->getJson('/api/integrations');
        $apiResponse->assertStatus(200);
        $matched = collect($apiResponse->json())->firstWhere('bloggerName', 'DAVRONOV FAKTOR');
        $this->assertNotNull($matched);
        $this->assertEquals(4, $matched['slotsCount']);
        $this->assertEquals(4, $matched['paidSlotsCount']);
        $this->assertEquals(5225000.00, $matched['paidAmount']);
        $this->assertEquals(5225000.00, $matched['totalAmount']);
    }

    public function test_telegram_thread_id_parsing(): void
    {
        $this->assertEquals(12345, TelegramService::parseThreadId('https://t.me/c/4329107459/12345'));
        $this->assertEquals(12345, TelegramService::parseThreadId('https://t.me/c/4329107459/12345/'));
        $this->assertEquals(483, TelegramService::parseThreadId('483'));
        $this->assertEquals(483, TelegramService::parseThreadId(483));
        $this->assertNull(TelegramService::parseThreadId(''));
        $this->assertNull(TelegramService::parseThreadId(null));
        $this->assertNull(TelegramService::parseThreadId('invalid_non_numeric'));
    }
}
