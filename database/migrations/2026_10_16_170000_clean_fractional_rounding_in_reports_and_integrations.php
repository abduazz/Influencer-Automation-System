<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Cleans up existing reports and integrations where total_amount or paid_amount
     * suffered from division/multiplication rounding artifacts (e.g. .01 or .99).
     */
    public function up(): void
    {
        DB::table('reports')
            ->whereRaw('ABS(total_amount - ROUND(total_amount)) > 0 AND ABS(total_amount - ROUND(total_amount)) < 0.05')
            ->update([
                'total_amount' => DB::raw('ROUND(total_amount)'),
            ]);

        DB::table('reports')
            ->whereRaw('ABS(paid_amount - ROUND(paid_amount)) > 0 AND ABS(paid_amount - ROUND(paid_amount)) < 0.05')
            ->update([
                'paid_amount' => DB::raw('ROUND(paid_amount)'),
            ]);

        DB::table('integrations')
            ->whereRaw('ABS(total_amount - ROUND(total_amount)) > 0 AND ABS(total_amount - ROUND(total_amount)) < 0.05')
            ->update([
                'total_amount' => DB::raw('ROUND(total_amount)'),
            ]);

        DB::table('integrations')
            ->whereRaw('ABS(paid_amount - ROUND(paid_amount)) > 0 AND ABS(paid_amount - ROUND(paid_amount)) < 0.05')
            ->update([
                'paid_amount' => DB::raw('ROUND(paid_amount)'),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No down migration needed for data cleanup
    }
};
