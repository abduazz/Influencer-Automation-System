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
}
