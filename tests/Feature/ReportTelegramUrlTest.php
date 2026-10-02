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

    public function test_extract_message_identifiers(): void
    {
        $report = new Report();
        $report->telegram_message_url = 'https://t.me/c/4329107459/999123';

        $identifiers = TelegramService::extractMessageIdentifiers($report);
        $this->assertNotNull($identifiers);
        $this->assertEquals('-1004329107459', $identifiers['chat_id']);
        $this->assertEquals(999123, $identifiers['message_id']);

        // Direct URL string
        $identifiersFromStr = TelegramService::extractMessageIdentifiers('https://t.me/c/4329107459/777');
        $this->assertNotNull($identifiersFromStr);
        $this->assertEquals(777, $identifiersFromStr['message_id']);

        // Null url
        $this->assertNull(TelegramService::extractMessageIdentifiers(new Report()));
    }

    public function test_delete_report_notification(): void
    {
        Http::fake([
            'https://api.telegram.org/botfake_token/deleteMessage' => Http::response([
                'ok' => true,
                'result' => true,
            ], 200),
        ]);

        $report = Report::create([
            'payment_type' => 'full',
            'date' => '2026-09-18',
            'channel_blogger' => 'TestBlogger',
            'platform' => 'Instagram',
            'slots_count' => 1,
            'price_per_slot' => 500000,
            'total_amount' => 500000,
            'telegram_message_url' => 'https://t.me/c/4329107459/999123',
        ]);

        $result = TelegramService::deleteReportNotification($report);
        $this->assertTrue($result);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.telegram.org/botfake_token/deleteMessage'
                && $request['chat_id'] === '-1004329107459'
                && $request['message_id'] === 999123;
        });
    }

    public function test_update_report_notification(): void
    {
        Http::fake([
            'https://api.telegram.org/botfake_token/editMessageCaption' => Http::response([
                'ok' => true,
                'result' => true,
            ], 200),
        ]);

        $project = Project::create(['name' => 'Alpha']);

        $report = Report::create([
            'payment_type' => 'full',
            'date' => '2026-09-18',
            'project_id' => $project->id,
            'channel_blogger' => 'UpdatedBlogger',
            'platform' => 'Telegram',
            'slots_count' => 2,
            'paid_slots_count' => 2,
            'price_per_slot' => 600000,
            'total_amount' => 1200000,
            'comments' => 'Updated comments text',
            'telegram_message_url' => 'https://t.me/c/4329107459/999123',
        ]);

        $result = TelegramService::updateReportNotification($report, 'ru');
        $this->assertTrue($result);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.telegram.org/botfake_token/editMessageCaption'
                && $request['chat_id'] === '-1004329107459'
                && $request['message_id'] === 999123
                && str_contains($request['caption'], 'UpdatedBlogger')
                && str_contains($request['caption'], '1 200 000 UZS')
                && str_contains($request['caption'], 'Updated comments text');
        });
    }

    public function test_destroy_report_triggers_telegram_delete(): void
    {
        Http::fake([
            'https://api.telegram.org/botfake_token/deleteMessage' => Http::response([
                'ok' => true,
                'result' => true,
            ], 200),
        ]);

        $report = Report::create([
            'payment_type' => 'full',
            'date' => '2026-09-18',
            'channel_blogger' => 'TestBlogger',
            'platform' => 'Instagram',
            'slots_count' => 1,
            'price_per_slot' => 500000,
            'total_amount' => 500000,
            'telegram_message_url' => 'https://t.me/c/4329107459/999123',
        ]);

        $response = $this->deleteJson("/api/reports/{$report->id}");
        $response->assertStatus(200);

        $this->assertDatabaseMissing('reports', ['id' => $report->id]);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.telegram.org/botfake_token/deleteMessage'
                && $request['message_id'] === 999123;
        });
    }
}
