<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\BloggerRequisite;
use App\Models\Integration;

return new class extends Migration
{
    public function up(): void
    {
        if (BloggerRequisite::count() === 0) {
            $integrations = Integration::take(3)->get();

            $samples = [
                [
                    'integration_id' => $integrations->get(0)?->id ?? null,
                    'blogger_name' => $integrations->get(0)?->blogger_name ?? 'tashkent_vines',
                    'tax_status' => 'card_transfer',
                    'full_name' => 'Каримов Жасур Бахтиёрович',
                    'passport_series_number' => 'AA 4829103',
                    'pinfl_or_tin' => '31405928190034',
                    'passport_issue_date' => '2021-06-15',
                    'passport_issued_by' => 'Юнусабадский РОВД г. Ташкента',
                    'registration_address' => 'г. Ташкент, Юнусабадский район, 11-квартал, д. 24, кв. 18',
                    'card_number_or_iban' => '8600 4924 8192 3014',
                    'bank_name' => 'АКБ "Капиталбанк"',
                    'bank_inn' => '200158402',
                    'mfo' => '00974',
                    'transit_account' => '23118000900000974001',
                    'recipient_name' => 'Каримов Жасур Бахтиёрович',
                    'phone' => '+998 90 123 45 67',
                    'telegram_handle' => '@jasur_vines',
                    'status' => 'verified',
                    'submitted_at' => now()->subDays(2),
                ],
                [
                    'integration_id' => $integrations->get(1)?->id ?? null,
                    'blogger_name' => $integrations->get(1)?->blogger_name ?? 'madina_beauty',
                    'tax_status' => 'card_transfer',
                    'full_name' => 'Абдуллаева Мадина Шерзодовна',
                    'passport_series_number' => 'AB 9102834',
                    'pinfl_or_tin' => '42801957380019',
                    'passport_issue_date' => '2022-03-20',
                    'passport_issued_by' => 'Мирзо-Улугбекский ГОМ г. Ташкента',
                    'registration_address' => 'г. Ташкент, Мирзо-Улугбекский р-н, ул. Буюк Ипак Йули, 82',
                    'card_number_or_iban' => '9860 3501 9284 1102',
                    'bank_name' => 'АКБ "Ипак Йули"',
                    'bank_inn' => '200123456',
                    'mfo' => '00444',
                    'transit_account' => '23118000400000444002',
                    'recipient_name' => 'Абдуллаева Мадина Шерзодовна',
                    'phone' => '+998 97 765 43 21',
                    'telegram_handle' => '@madina_blogger',
                    'status' => 'verified',
                    'submitted_at' => now()->subDay(),
                ],
                [
                    'integration_id' => $integrations->get(2)?->id ?? null,
                    'blogger_name' => $integrations->get(2)?->blogger_name ?? 'tech_uzbekistan',
                    'tax_status' => 'contract',
                    'full_name' => 'Юсупов Сардор Анварович',
                    'passport_series_number' => 'AC 7729104',
                    'pinfl_or_tin' => '30208916290045',
                    'passport_issue_date' => '2020-11-10',
                    'passport_issued_by' => 'Чиланзарский РОВД г. Ташкента',
                    'registration_address' => 'г. Ташкент, Чиланзарский р-н, кв-л 9, д. 15',
                    'card_number_or_iban' => '8600 5510 8823 4901',
                    'bank_name' => 'АКБ "TBC Bank"',
                    'bank_inn' => '207328901',
                    'mfo' => '01180',
                    'transit_account' => '23118000100001180003',
                    'recipient_name' => 'Юсупов Сардор Анварович',
                    'phone' => '+998 99 888 77 66',
                    'telegram_handle' => '@sardor_tech',
                    'status' => 'submitted',
                    'submitted_at' => now()->subHours(6),
                ],
            ];

            foreach ($samples as $index => $sampleData) {
                $req = BloggerRequisite::create($sampleData);

                if (!empty($sampleData['integration_id'])) {
                    $int = Integration::find($sampleData['integration_id']);
                    if ($int) {
                        $int->update([
                            'requisites' => [
                                'id' => 'req-' . $req->id,
                                'integrationId' => (string) $int->id,
                                'bloggerName' => $int->blogger_name,
                                'taxStatus' => $sampleData['tax_status'],
                                'fullName' => $sampleData['full_name'],
                                'passportSeriesNumber' => $sampleData['passport_series_number'],
                                'pinflOrTin' => $sampleData['pinfl_or_tin'],
                                'passportIssueDate' => $sampleData['passport_issue_date'],
                                'passportIssuedBy' => $sampleData['passport_issued_by'],
                                'registrationAddress' => $sampleData['registration_address'],
                                'cardNumberOrIban' => $sampleData['card_number_or_iban'],
                                'bankName' => $sampleData['bank_name'],
                                'bankInn' => $sampleData['bank_inn'],
                                'mfo' => $sampleData['mfo'],
                                'transitAccount' => $sampleData['transit_account'],
                                'recipientName' => $sampleData['recipient_name'],
                                'phone' => $sampleData['phone'],
                                'telegramHandle' => $sampleData['telegram_handle'],
                                'submittedAt' => $sampleData['submitted_at']->toISOString(),
                                'status' => $sampleData['status'],
                            ],
                            'kanban_stage' => 'ready_for_payment',
                        ]);
                    }
                }
            }
        }
    }

    public function down(): void
    {
        // Keep user data safe
    }
};
