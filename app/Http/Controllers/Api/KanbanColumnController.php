<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KanbanColumn;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class KanbanColumnController extends Controller
{
    private array $defaultColumns = [
        ['id' => 'backlog', 'title' => 'Backlog', 'color' => 'slate', 'hidden' => true],
        ['id' => 'wishlist', 'title' => 'Желаемые', 'color' => 'purple', 'hidden' => false],
        ['id' => 'negotiation', 'title' => 'Обговорить', 'color' => 'amber', 'hidden' => false],
        ['id' => 'requisites_pending', 'title' => 'Получить реквизиты', 'color' => 'blue', 'hidden' => false],
        ['id' => 'ready_for_payment', 'title' => 'Готов к оплате', 'color' => 'indigo', 'hidden' => false],
        ['id' => 'paid_in_progress', 'title' => 'Оплачено / В работе', 'color' => 'emerald', 'hidden' => false],
        ['id' => 'completed', 'title' => 'Завершено', 'color' => 'neutral', 'hidden' => false],
    ];

    private array $systemColumnIds = ['backlog', 'ready_for_payment', 'paid_in_progress'];

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
                    'is_hidden' => !empty($col['hidden']),
                ]);
            }
            $columns = KanbanColumn::orderBy('position', 'asc')->get();
        } else {
            // Guarantee all system columns exist
            foreach ($this->defaultColumns as $defaultCol) {
                if (in_array($defaultCol['id'], $this->systemColumnIds, true) && !$columns->contains('column_id', $defaultCol['id'])) {
                    KanbanColumn::create([
                        'column_id' => $defaultCol['id'],
                        'title' => $defaultCol['title'],
                        'color' => $defaultCol['color'],
                        'position' => $defaultCol['id'] === 'backlog' ? 0 : 50,
                        'is_hidden' => !empty($defaultCol['hidden']),
                    ]);
                }
            }

            // Ensure backlog is at position 0
            $backlog = KanbanColumn::where('column_id', 'backlog')->first();
            if ($backlog && $backlog->position !== 0) {
                $otherColumns = KanbanColumn::where('column_id', '!=', 'backlog')->orderBy('position', 'asc')->get();
                $backlog->update(['position' => 0]);
                foreach ($otherColumns as $idx => $other) {
                    $other->update(['position' => $idx + 1]);
                }
            }
            $columns = KanbanColumn::orderBy('position', 'asc')->get();
        }

        return response()->json($columns->map(function ($col) {
            return [
                'id' => $col->column_id,
                'title' => $col->title,
                'color' => $col->color,
                'hidden' => (bool) $col->is_hidden,
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
            'columns.*.hidden' => 'nullable|boolean',
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
                        'is_hidden' => !empty($item['hidden']),
                    ]
                );
            }

            // Remove columns deleted by user, but NEVER delete system columns!
            KanbanColumn::whereNotIn('column_id', $submittedIds)
                ->whereNotIn('column_id', $this->systemColumnIds)
                ->delete();
        });

        $updated = KanbanColumn::orderBy('position', 'asc')->get();

        return response()->json($updated->map(function ($col) {
            return [
                'id' => $col->column_id,
                'title' => $col->title,
                'color' => $col->color,
                'hidden' => (bool) $col->is_hidden,
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
