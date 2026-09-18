<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Report;
use App\Services\TelegramService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ReportTelegramUrlTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.telegram.bot_token' => 'fake_token']);
        config(['services.telegram.reports_chat_id' => '-1004329107459']);
    }

    public function test_send_report_notification_saves_telegram_message_url(): void
    {
        Http::fake([
            'https://api.telegram.org/botfake_token/sendMessage' => Http::response([
                'ok' => true,
                'result' => [
                    'message_id' => 999123,
                    'chat' => [
                        'id' => -1004329107459,
                    ],
                ],
            ], 200),
        ]);

        $project = Project::create([
            'name' => 'Test Project',
            'telegram_thread_id' => '55',
        ]);

        $report = Report::create([
            'payment_type' => 'full',
            'date' => '2026-09-18',
            'project_id' => $project->id,
            'destination' => 'https://example.com/promo',
            'channel_blogger' => 'TestBlogger',
            'platform' => 'Instagram',
            'slots_count' => 1,
            'paid_slots_count' => 1,
            'price_per_slot' => 500000,
            'total_amount' => 500000,
            'paid_amount' => 500000,
        ]);

        $result = TelegramService::sendReportNotification($report, null, 'ru', 'Admin');

        $this->assertTrue($result);
        $report->refresh();
        $this->assertEquals('https://t.me/c/4329107459/999123', $report->telegram_message_url);

        // Verify GET /api/reports includes telegramMessageUrl
        $response = $this->getJson('/api/reports');
        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(1, $data);
        $this->assertEquals('https://t.me/c/4329107459/999123', $data[0]['telegramMessageUrl']);
    }
}
