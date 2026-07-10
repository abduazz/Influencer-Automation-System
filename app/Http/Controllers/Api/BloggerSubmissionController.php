<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BloggerSubmission;
use Illuminate\Http\Request;

class BloggerSubmissionController extends Controller
{
    public function index()
    {
        return response()->json(BloggerSubmission::all()->map(function ($sub) {
            return [
                'id' => (string) $sub->id,
                'integrationId' => (string) $sub->integration_id,
                'submittedAt' => $sub->submitted_at->toISOString(),
                'status' => $sub->status,
                'data' => $sub->data ?? [],
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'integrationId' => 'required|exists:integrations,id',
            'status' => 'nullable|in:pending,approved,rejected',
            'data' => 'required|array',
        ]);

        $sub = BloggerSubmission::create([
            'integration_id' => $request->integrationId,
            'status' => $request->status ?? 'pending',
            'submitted_at' => now(),
            'data' => $request->data,
        ]);

        return response()->json([
            'id' => (string) $sub->id,
            'integrationId' => (string) $sub->integration_id,
            'submittedAt' => $sub->submitted_at->toISOString(),
            'status' => $sub->status,
            'data' => $sub->data ?? [],
        ], 201);
    }
}
