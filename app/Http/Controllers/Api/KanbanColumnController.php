<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KanbanColumn;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class KanbanColumnController extends Controller
{
    private array $defaultColumns = [
        ['id' => 'wishlist', 'title' => 'Желаемые', 'color' => 'purple'],
        ['id' => 'negotiation', 'title' => 'Обговорить', 'color' => 'amber'],
        ['id' => 'requisites_pending', 'title' => 'Получить реквизиты', 'color' => 'blue'],
        ['id' => 'ready_for_payment', 'title' => 'Готов к оплате', 'color' => 'indigo'],
        ['id' => 'paid_in_progress', 'title' => 'Оплачено / В работе', 'color' => 'emerald'],
        ['id' => 'completed', 'title' => 'Завершено', 'color' => 'neutral'],
    ];

    public function index()
    {
        $columns = KanbanColumn::orderBy('position', 'asc')->get();

        if ($columns->isEmpty()) {
            foreach ($this->defaultColumns as $pos => $col) {
                KanbanColumn::create([
                    'column_id' => $col['id'],
                    'title' => $col['title'],
                    'color' => $col['color'],
                    'position' => $pos,
                ]);
            }
            $columns = KanbanColumn::orderBy('position', 'asc')->get();
        }

        return response()->json($columns->map(function ($col) {
            return [
                'id' => $col->column_id,
                'title' => $col->title,
                'color' => $col->color,
            ];
        }));
    }

    public function sync(Request $request)
    {
        $request->validate([
            'columns' => 'required|array',
            'columns.*.id' => 'required|string',
            'columns.*.title' => 'required|string|max:255',
            'columns.*.color' => 'nullable|string',
        ]);

        $columnsData = $request->input('columns', []);

        DB::transaction(function () use ($columnsData) {
            $submittedIds = [];
            foreach ($columnsData as $pos => $item) {
                $columnId = $item['id'];
                $submittedIds[] = $columnId;

                KanbanColumn::updateOrCreate(
                    ['column_id' => $columnId],
                    [
                        'title' => $item['title'],
                        'color' => $item['color'] ?? 'indigo',
                        'position' => $pos,
                    ]
                );
            }

            // Remove columns that were deleted by the user
            KanbanColumn::whereNotIn('column_id', $submittedIds)->delete();
        });

        $updated = KanbanColumn::orderBy('position', 'asc')->get();

        return response()->json($updated->map(function ($col) {
            return [
                'id' => $col->column_id,
                'title' => $col->title,
                'color' => $col->color,
            ];
        }));
    }

    public function clearStage(Request $request)
    {
        $stage = $request->input('stage');
        if ($stage) {
            \App\Models\Integration::where('kanban_stage', $stage)->update(['kanban_stage' => null]);
        }
        return response()->json(['success' => true]);
    }
}
