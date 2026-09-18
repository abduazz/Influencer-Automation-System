<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\BloggerSubmission;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            $submissions = BloggerSubmission::all();
            foreach ($submissions as $sub) {
                $data = $sub->data ?? [];
                $changed = false;
                $defaultDate = ($sub->submitted_at ?? $sub->created_at ?? now())->toISOString();

                foreach ($data as $key => $val) {
                    if (preg_match('/^slot_\d+$/', $key) && !empty($val)) {
                        $dateKey = "{$key}_submitted_at";
                        if (empty($data[$dateKey])) {
                            $data[$dateKey] = $defaultDate;
                            $changed = true;
                        }
                    }
                }

                if ($changed) {
                    $sub->update(['data' => $data]);
                }
            }
        } catch (\Throwable $e) {
            // Safe fallback
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No down needed for data backfill
    }
};
