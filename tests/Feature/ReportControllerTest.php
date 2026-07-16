<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ReportControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        config(['services.telegram.bot_token' => 'fake_token']);
        config(['services.telegram.reports_chat_id' => 'fake_chat_id']);
    }

    public function test_creating_report_sends_telegram_notification_with_creator_name(): void
    {
        Http::fake([
            'https://api.telegram.org/bot*' => Http::response(['ok' => true], 200),
        ]);

        // Create whitelisted user
        $user = User::create([
            'name' => 'John Doe',
            'email' => 'john@company.com',
            'role' => 'pr_manager',
            'password' => bcrypt('password'),
        ]);

        $project = Project::create([
            'name' => 'Campaign A',
            'description' => 'Test Description',
        ]);

        $payload = [
            'paymentType' => 'prepaid',
            'date' => '2026-07-16',
            'projectId' => $project->id,
            'destination' => 'https://example.com/target',
            'channelBlogger' => 'some_influencer',
            'platform' => 'Telegram',
            'slotsCount' => 5,
            'paidSlotsCount' => 2,
            'pricePerSlot' => 100.00,
            'lang' => 'ru',
        ];

        $response = $this->withHeaders([
            'X-User-Email' => 'john@company.com',
        ])->postJson('/api/reports', $payload);

        $response->assertStatus(201);

        $recorded = Http::recorded(function ($request) {
            return str_contains($request->url(), 'api.telegram.org');
        });
        $this->assertCount(1, $recorded);

        $req = is_array($recorded[0]) ? ($recorded[0]['request'] ?? $recorded[0][0]) : $recorded[0];
        $this->assertTrue(str_contains($req->url(), 'sendMessage'));
        
        // Assert the notification contains the creator's name
        $body = json_decode($req->body(), true);
        $this->assertTrue(str_contains($body['text'] ?? '', 'Создан кем:'));
        $this->assertTrue(str_contains($body['text'] ?? '', 'John Doe'));
    }

    public function test_creating_report_sends_telegram_notification_with_fallback_email_if_not_found(): void
    {
        Http::fake([
            'https://api.telegram.org/bot*' => Http::response(['ok' => true], 200),
        ]);

        $project = Project::create([
            'name' => 'Campaign B',
            'description' => 'Test Description',
        ]);

        $payload = [
            'paymentType' => 'full',
            'date' => '2026-07-16',
            'projectId' => $project->id,
            'destination' => 'https://example.com/target2',
            'channelBlogger' => 'another_influencer',
            'platform' => 'Instagram',
            'slotsCount' => 10,
            'paidSlotsCount' => 10,
            'pricePerSlot' => 500.00,
            'lang' => 'ru',
        ];

        $response = $this->withHeaders([
            'X-User-Email' => 'notfound@company.com',
        ])->postJson('/api/reports', $payload);

        $response->assertStatus(201);

        $recorded = Http::recorded(function ($request) {
            return str_contains($request->url(), 'api.telegram.org');
        });
        $this->assertCount(1, $recorded);

        $req = is_array($recorded[0]) ? ($recorded[0]['request'] ?? $recorded[0][0]) : $recorded[0];
        $this->assertTrue(str_contains($req->url(), 'sendMessage'));
        
        // Assert the notification contains the creator's fallback email
        $body = json_decode($req->body(), true);
        $this->assertTrue(str_contains($body['text'] ?? '', 'Создан кем:'));
        $this->assertTrue(str_contains($body['text'] ?? '', 'notfound@company.com'));
    }

    public function test_creating_other_payment_type_report_goes_to_prochie_sheet(): void
    {
        Http::fake([
            'https://api.telegram.org/bot*' => Http::response(['ok' => true], 200),
            'https://sheets.googleapis.com/v4/spreadsheets/*' => Http::response([
                'sheets' => [
                    ['properties' => ['title' => 'Прочие']]
                ]
            ], 200),
        ]);

        $payload = [
            'paymentType' => 'other',
            'date' => '2026-07-16',
            'destination' => 'Office Rent',
            'amount' => 600000.00,
            'lang' => 'ru',
        ];

        $response = $this->withHeaders([
            'X-User-Email' => 'john@company.com',
        ])->postJson('/api/reports', $payload);

        $response->assertStatus(201);

        $recorded = Http::recorded();
        foreach ($recorded as $i => $rec) {
            $req = is_array($rec) ? ($rec['request'] ?? $rec[0]) : $rec;
            \Illuminate\Support\Facades\Log::info("TEST SHEET REQ #{$i} URL: " . $req->url());
        }

        $recordedSheets = Http::recorded(function ($request) {
            return str_contains($request->url(), 'sheets.googleapis.com');
        })->values();

        // There should be Google Sheets API calls
        $this->assertNotEmpty($recordedSheets);

        $firstReq = is_array($recordedSheets[0]) ? ($recordedSheets[0]['request'] ?? $recordedSheets[0][0]) : $recordedSheets[0];

        // One of the sheets request URLs should reference the spreadsheetId
        $this->assertTrue(str_contains($firstReq->url(), '1_TBYmmaWZPIG5_Kz2Sr706w6Km_VS-l7Q2UtKADrrus'));
    }
}
