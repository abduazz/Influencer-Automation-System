<?php

namespace Tests\Feature;

use App\Models\Integration;
use App\Models\Project;
use App\Models\BloggerSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BloggerSubmissionControllerTest extends TestCase
{
    use RefreshDatabase;

    private $project;
    private $integration;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Configure Telegram Bot token and chat ID for testing
        config(['services.telegram.bot_token' => 'fake_token']);
        config(['services.telegram.submissions_chat_id' => 'fake_chat_id']);

        $this->project = Project::create([
            'name' => 'Test Project',
            'description' => 'Test Description',
        ]);

        $this->integration = Integration::create([
            'project_id' => $this->project->id,
            'blogger_name' => 'Blogger 1',
            'platform' => 'Instagram',
            'slots_count' => 3,
            'paid_slots_count' => 3,
            'price_per_slot' => 100.00,
            'start_date' => now(),
            'end_date' => now(),
            'blogger_cabinet_token' => 'test-cabinet-token',
            'slots_config' => [
                ['platform' => 'Instagram', 'format' => 'Stories'],
                ['platform' => 'Instagram', 'format' => 'Stories'],
                ['platform' => 'Instagram', 'format' => 'Stories'],
            ],
        ]);
    }

    public function test_first_submission_sends_one_telegram_notification(): void
    {
        Http::fake([
            'https://api.telegram.org/bot*' => Http::response(['ok' => true], 200),
        ]);

        $payload = [
            'integrationId' => 'test-cabinet-token',
            'lang' => 'ru',
            'data' => [
                'slot_1' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // mock 1x1 png
                'slot_2' => '',
                'slot_3' => '',
            ],
        ];

        $response = $this->postJson('/api/blogger-submissions', $payload);
        $response->assertStatus(201);

        $this->assertDatabaseHas('blogger_submissions', [
            'integration_id' => $this->integration->id,
        ]);

        // Verify exactly 1 Telegram notification was sent for slot_1 with 2 remaining slots
        $recorded = Http::recorded();
        $this->assertCount(1, $recorded);
        $req = is_array($recorded[0]) ? ($recorded[0]['request'] ?? $recorded[0][0]) : $recorded[0];
        $this->assertTrue(str_contains($req->url(), 'sendPhoto'));
        $this->assertTrue(str_contains($req->body(), 'Слот #1'));
        $this->assertTrue(str_contains($req->body(), 'Оставшиеся слоты:</b> 2'));
    }

    public function test_subsequent_submission_only_notifies_newly_filled_slots(): void
    {
        Http::fake([
            'https://api.telegram.org/bot*' => Http::response(['ok' => true], 200),
        ]);

        // Manually create the pre-existing submission in the DB
        BloggerSubmission::create([
            'integration_id' => $this->integration->id,
            'submitted_at' => now(),
            'status' => 'approved',
            'data' => [
                'slot_1' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                'slot_2' => null,
                'slot_3' => null,
            ],
        ]);

        // Blogger fills slot_2 (already filled slot_1 is sent too, slot_3 remains empty)
        $payload = [
            'integrationId' => 'test-cabinet-token',
            'lang' => 'ru',
            'data' => [
                'slot_1' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                'slot_2' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                'slot_3' => '',
            ],
        ];

        $response = $this->postJson('/api/blogger-submissions', $payload);
        $response->assertStatus(201);

        // Verify exactly 1 Telegram notification was sent (only for slot_2, not slot_1 again)
        $recorded = Http::recorded();
        $this->assertCount(1, $recorded);

        $req = is_array($recorded[0]) ? ($recorded[0]['request'] ?? $recorded[0][0]) : $recorded[0];
        $this->assertTrue(str_contains($req->url(), 'sendPhoto'));
        $this->assertTrue(str_contains($req->body(), 'Слот #2'));
        $this->assertTrue(str_contains($req->body(), 'Оставшиеся слоты:</b> 1'));
        $this->assertFalse(str_contains($req->body(), 'Слот #1'));
    }
}
