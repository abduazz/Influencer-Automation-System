<?php

namespace Tests\Feature;

use App\Models\Integration;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BloggerRequisitesTest extends TestCase
{
    use RefreshDatabase;

    public function test_blogger_can_submit_requisites_successfully(): void
    {
        Http::fake([
            'https://api.telegram.org/bot*' => Http::response(['ok' => true], 200),
        ]);

        $project = Project::create([
            'name' => 'Test Project',
            'description' => 'Test Description',
        ]);

        $integration = Integration::create([
            'project_id' => $project->id,
            'blogger_name' => 'test_blogger',
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addDays(30)->format('Y-m-d'),
            'platform' => 'Instagram',
            'price_per_slot' => 1000000,
            'slots_count' => 1,
            'kanban_stage' => 'requisites_pending',
        ]);

        $payload = [
            'integrationId' => (string) $integration->id,
            'taxStatus' => 'card_transfer',
            'fullName' => 'Aliev Vali',
            'cardNumberOrIban' => '8600 1234 5678 9012',
            'pinflOrTin' => '30102938475839',
            'bankName' => 'Kapitalbank',
            'phone' => '+998901234567',
            'telegramHandle' => '@valiblogger',
        ];

        $response = $this->postJson('/api/blogger-requisites', $payload);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'integration' => [
                'id' => (string) $integration->id,
                'kanbanStage' => 'ready_for_payment',
                'requisites' => [
                    'fullName' => 'Aliev Vali',
                    'cardNumberOrIban' => '8600 1234 5678 9012',
                ],
            ],
        ]);

        // Check database
        $fresh = $integration->fresh();
        $this->assertEquals('ready_for_payment', $fresh->kanban_stage);
        $this->assertNotNull($fresh->requisites);
        $this->assertEquals('Aliev Vali', $fresh->requisites['fullName']);

        // Check blogger_requisites table
        $this->assertDatabaseHas('blogger_requisites', [
            'integration_id' => $integration->id,
            'full_name' => 'Aliev Vali',
            'card_number_or_iban' => '8600 1234 5678 9012',
        ]);
    }

    public function test_can_fetch_all_blogger_requisites(): void
    {
        $project = Project::create([
            'name' => 'Test Project',
            'description' => 'Test Description',
        ]);

        $integration = Integration::create([
            'project_id' => $project->id,
            'blogger_name' => 'blogger_fetch_test',
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addDays(30)->format('Y-m-d'),
            'platform' => 'Instagram',
            'price_per_slot' => 1000000,
            'slots_count' => 1,
            'requisites' => [
                'id' => 'req-test-1',
                'fullName' => 'Sardor Test',
                'cardNumberOrIban' => '9860 0000 1111 2222',
            ],
        ]);

        $response = $this->getJson('/api/blogger-requisites');

        $response->assertStatus(200);
        $this->assertTrue(count($response->json()) >= 1);
        $this->assertTrue(collect($response->json())->contains(function ($item) {
            return ($item['fullName'] ?? '') === 'Sardor Test' || ($item['cardNumberOrIban'] ?? '') === '9860 0000 1111 2222';
        }));
    }

    public function test_cleanup_migration_removes_fake_data_and_preserves_aga(): void
    {
        $project = Project::create([
            'name' => 'Project 1',
            'description' => 'Test Desc',
        ]);

        // Fake/test integrations
        $fake1 = Integration::create([
            'project_id' => $project->id,
            'blogger_name' => 'Ispanchik',
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addDays(30)->format('Y-m-d'),
            'platform' => 'Instagram',
            'kanban_stage' => 'ready_for_payment',
            'requisites' => [
                'fullName' => 'Каримов Жасур Бахтиёрович',
                'cardNumberOrIban' => '8600 4924 8192 3014',
            ],
        ]);

        \App\Models\BloggerRequisite::create([
            'integration_id' => $fake1->id,
            'blogger_name' => 'Ispanchik',
            'full_name' => 'Каримов Жасур Бахтиёрович',
            'card_number_or_iban' => '8600 4924 8192 3014',
        ]);

        // Real AGA integration and requisite
        $agaInt = Integration::create([
            'project_id' => $project->id,
            'blogger_name' => 'AGA',
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addDays(30)->format('Y-m-d'),
            'platform' => 'YouTube',
            'kanban_stage' => 'ready_for_payment',
            'requisites' => [
                'fullName' => 'JUMANAZAR KOMILOV NIZOMIDDIN O\'G\'LI',
                'cardNumberOrIban' => '5614 6822 0317 6682',
            ],
        ]);

        $agaReq = \App\Models\BloggerRequisite::create([
            'integration_id' => $agaInt->id,
            'blogger_name' => 'AGA',
            'full_name' => 'JUMANAZAR KOMILOV NIZOMIDDIN O\'G\'LI',
            'card_number_or_iban' => '5614 6822 0317 6682',
        ]);

        // Execute cleanup migration up() logic
        $migration = require database_path('migrations/2026_09_17_110000_cleanup_test_blogger_requisites.php');
        $migration->up();

        // Check fake integration requisites removed
        $this->assertNull($fake1->fresh()->requisites);
        $this->assertEquals('requisites_pending', $fake1->fresh()->kanban_stage);

        // Check fake blogger_requisites removed
        $this->assertDatabaseMissing('blogger_requisites', [
            'full_name' => 'Каримов Жасур Бахтиёрович',
        ]);

        // Check AGA is preserved
        $this->assertNotNull($agaInt->fresh()->requisites);
        $this->assertEquals('5614 6822 0317 6682', $agaInt->fresh()->requisites['cardNumberOrIban']);
        $this->assertDatabaseHas('blogger_requisites', [
            'id' => $agaReq->id,
            'blogger_name' => 'AGA',
            'full_name' => 'JUMANAZAR KOMILOV NIZOMIDDIN O\'G\'LI',
        ]);
    }

    public function test_telegram_notification_sends_photos_to_requisites_topic(): void
    {
        config(['services.telegram.bot_token' => 'fake-token']);
        config(['services.telegram.requisites_chat_id' => '-1004424306910']);
        config(['services.telegram.requisites_thread_id' => '483']);

        Http::fake([
            'https://api.telegram.org/botfake-token/sendMediaGroup' => Http::response(['ok' => true], 200),
        ]);

        $project = Project::create([
            'name' => 'TeaPay Promo',
            'description' => 'Test Desc',
        ]);

        $integration = Integration::create([
            'project_id' => $project->id,
            'blogger_name' => 'AGA',
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addDays(30)->format('Y-m-d'),
            'platform' => 'YouTube',
        ]);

        $fakeBase64 = 'data:image/jpeg;base64,' . base64_encode('fake-image-bytes');

        $requisites = [
            'fullName' => 'Jumanazar Komilov',
            'taxStatus' => 'contract',
            'cardNumberOrIban' => '5614 6822 0317 6682',
            'pinflOrTin' => '52704007100033',
            'passportSeriesNumber' => 'AE8386632',
            'phone' => '+998995615131',
            'bankName' => 'Kapitalbank',
            'passportFrontScan' => $fakeBase64,
            'passportBackScan' => $fakeBase64,
        ];

        $result = \App\Services\TelegramService::sendRequisitesNotification($integration, $requisites);

        $this->assertTrue($result);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'sendMediaGroup') &&
                   str_contains($request->body(), '-1004424306910') &&
                   str_contains($request->body(), '483');
        });
    }
}


