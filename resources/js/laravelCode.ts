/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CodeBlock {
  id: string;
  filename: string;
  path: string;
  category: 'Migrations' | 'Models' | 'Filament Resources' | 'Blogger Cabinet';
  language: string;
  description: string;
  code: string;
}

export const LARAVEL_FILAMENT_CODE: CodeBlock[] = [
  {
    id: 'mig-projects',
    filename: 'create_projects_table.php',
    path: 'database/migrations/2026_07_10_000001_create_projects_table.php',
    category: 'Migrations',
    language: 'php',
    description: 'Migration file to define the projects table layout.',
    code: `<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};`,
  },
  {
    id: 'mig-integrations',
    filename: 'create_integrations_table.php',
    path: 'database/migrations/2026_07_10_000002_create_integrations_table.php',
    category: 'Migrations',
    language: 'php',
    description: 'Migration with foreign keys to projects, platforms enum, and integration specific fields.',
    code: `<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('blogger_name');
            $table->date('start_date');
            $table->string('platform'); // e.g. Telegram, Instagram, YouTube
            $table->text('referral_link')->nullable();
            $table->decimal('price_per_slot', 12, 2)->default(0.00);
            $table->integer('slots_count')->default(1);
            $table->decimal('total_amount', 12, 2)->storedAs('price_per_slot * slots_count'); // Generated virtual column, or updated via Model/Form
            $table->date('end_date');
            $table->string('status')->default('active'); // active, completed, paused
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integrations');
    }
};`,
  },
  {
    id: 'mig-reports',
    filename: 'create_reports_table.php',
    path: 'database/migrations/2026_07_10_000003_create_reports_table.php',
    category: 'Migrations',
    language: 'php',
    description: 'Database schema for influencer reports, compatible with fast inserts via mobile web interfaces.',
    code: `<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('destination');
            $table->string('channel_blogger');
            $table->string('platform');
            $table->integer('slots_count');
            $table->decimal('price_per_slot', 12, 2);
            $table->decimal('total_amount', 12, 2);
            $table->text('comments')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};`,
  },
  {
    id: 'mig-submissions',
    filename: 'create_blogger_submissions_table.php',
    path: 'database/migrations/2026_07_10_000004_create_blogger_submissions_table.php',
    category: 'Migrations',
    language: 'php',
    description: 'Dynamic submissions storage which records file uploads (JSON array of paths) or URLs (JSON array) based on channel requirements.',
    code: `<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blogger_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('integration_id')->constrained()->cascadeOnDelete();
            $table->timestamp('submitted_at');
            $table->string('status')->default('pending'); // pending, approved, rejected
            $table->json('data'); // Stores key-value values of screenshots or publication links
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blogger_submissions');
    }
};`,
  },
  {
    id: 'model-project',
    filename: 'Project.php',
    path: 'app/Models/Project.php',
    category: 'Models',
    language: 'php',
    description: 'Project Eloquent Model outlining relationship definitions to Integrations and Reports.',
    code: `<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
    ];

    /**
     * Get all integrations belonging to the project.
     */
    public function integrations(): HasMany
    {
        return $this->hasMany(Integration::class);
    }

    /**
     * Get all reports filed under this project.
     */
    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }
}`,
  },
  {
    id: 'model-integration',
    filename: 'Integration.php',
    path: 'app/Models/Integration.php',
    category: 'Models',
    language: 'php',
    description: 'Integration Eloquent Model defining inverse belongsTo and dynamic recalculation trigger.',
    code: `<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Integration extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'blogger_name',
        'start_date',
        'platform',
        'referral_link',
        'price_per_slot',
        'slots_count',
        'total_amount',
        'end_date',
        'status',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'price_per_slot' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'slots_count' => 'integer',
    ];

    /**
     * Get the project that owns the integration.
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Get work submissions related to this integration slot.
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(BloggerSubmission::class);
    }

    /**
     * Auto-calculate total amount on save if database virtual column isn't utilized.
     */
    protected static function boot()
    {
        parent::boot();

        static::saving(function (Integration $integration) {
            $integration->total_amount = $integration->price_per_slot * $integration->slots_count;
        });
    }
}`,
  },
  {
    id: 'model-report',
    filename: 'Report.php',
    path: 'app/Models/Report.php',
    category: 'Models',
    language: 'php',
    description: 'Report Eloquent Model capturing mobile or Telegram Mini App form records.',
    code: `<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    use HasFactory;

    protected $fillable = [
        'date',
        'project_id',
        'destination',
        'channel_blogger',
        'platform',
        'slots_count',
        'price_per_slot',
        'total_amount',
        'comments',
    ];

    protected $casts = [
        'date' => 'date',
        'price_per_slot' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'slots_count' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}`,
  },
  {
    id: 'model-submission',
    filename: 'BloggerSubmission.php',
    path: 'app/Models/BloggerSubmission.php',
    category: 'Models',
    language: 'php',
    description: 'BloggerSubmission Model configured to cast dynamic fields as JSON arrays.',
    code: `<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BloggerSubmission extends Model
{
    use HasFactory;

    protected $fillable = [
        'integration_id',
        'submitted_at',
        'status',
        'data',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'data' => 'array', // Cast JSON fields automatically into structured PHP arrays
    ];

    public function integration(): BelongsTo
    {
        return $this->belongsTo(Integration::class);
    }
}`,
  },
  {
    id: 'filament-project-resource',
    filename: 'ProjectResource.php',
    path: 'app/Filament/Resources/ProjectResource.php',
    category: 'Filament Resources',
    language: 'php',
    description: 'Filament Resource configuration outlining project forms and action columns.',
    code: `<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProjectResource\Pages;
use App\Filament\Resources\ProjectResource\RelationManagers\IntegrationsRelationManager;
use App\Models\Project;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class ProjectResource extends Resource
{
    protected static ?string $model = Project::class;

    protected static ?string $navigationIcon = 'heroicon-o-folder-open';
    
    protected static ?string $navigationGroup = 'Campaign Managers';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('General Information')
                    ->description('Define core project metadata.')
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->required()
                            ->maxLength(255)
                            ->placeholder('e.g., Summer Promo Blast'),
                        Forms\Components\Textarea::make('description')
                            ->maxLength(65535)
                            ->columnSpanFull()
                            ->rows(3),
                    ])->columns(1)
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->weight('semibold'),
                Tables\Columns\TextColumn::make('description')
                    ->limit(50)
                    ->color('gray'),
                Tables\Columns\TextColumn::make('integrations_count')
                    ->counts('integrations')
                    ->label('Integrations')
                    ->badge()
                    ->color('info'),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime('M d, Y')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                //
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            IntegrationsRelationManager::class, // Attached relation manager inside Project view!
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\\ListProjects::route('/'),
            'create' => Pages\\CreateProject::route('/create'),
            'edit' => Pages\\EditProject::route('/{record}/edit'),
        ];
    }
}`,
  },
  {
    id: 'filament-relation-manager',
    filename: 'IntegrationsRelationManager.php',
    path: 'app/Filament/Resources/ProjectResource/RelationManagers/IntegrationsRelationManager.php',
    category: 'Filament Resources',
    language: 'php',
    description: 'Crucial Relation Manager embedded in Project View. It configures live calculations of total amounts and platform settings.',
    code: `<?php

namespace App\Filament\Resources\ProjectResource\RelationManagers;

use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Forms\Set;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Table;

class IntegrationsRelationManager extends RelationManager
{
    protected static string $relationship = 'integrations';

    protected static ?string $title = 'Blogger Integrations';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Grid::make(3)
                    ->schema([
                        Forms\Components\TextInput::make('blogger_name')
                            ->required()
                            ->maxLength(255)
                            ->placeholder('e.g., Jane Tech Vlogs'),
                            
                        Forms\Components\Select::make('platform')
                            ->options([
                                'Telegram' => 'Telegram',
                                'Instagram' => 'Instagram',
                                'YouTube' => 'YouTube',
                            ])
                            ->required()
                            ->native(false),

                        Forms\Components\TextInput::make('referral_link')
                            ->url()
                            ->placeholder('https://url.to/ref_code')
                            ->maxLength(500),
                    ]),

                Forms\Components\Grid::make(4)
                    ->schema([
                        Forms\Components\DatePicker::make('start_date')
                            ->required()
                            ->default(now()),

                        Forms\Components\DatePicker::make('end_date')
                            ->required()
                            ->default(now()->addDays(7)),

                        Forms\Components\TextInput::make('price_per_slot')
                            ->numeric()
                            ->prefix('₽')
                            ->required()
                            ->live() // Recalculates dynamically
                            ->afterStateUpdated(function (Get $get, Set $set, ?string $state) {
                                $price = floatval($state ?? 0);
                                $slots = intval($get('slots_count') ?? 0);
                                $set('total_amount', $price * $slots);
                            }),

                        Forms\Components\TextInput::make('slots_count')
                            ->integer()
                            ->required()
                            ->default(1)
                            ->live() // Recalculates dynamically
                            ->afterStateUpdated(function (Get $get, Set $set, ?string $state) {
                                $slots = intval($state ?? 0);
                                $price = floatval($get('price_per_slot') ?? 0);
                                $set('total_amount', $price * $slots);
                            }),
                    ]),

                Forms\Components\TextInput::make('total_amount')
                    ->numeric()
                    ->prefix('₽')
                    ->disabled() // Protected input
                    ->dehydrated() // Transmitted to save action
                    ->label('Total Integration Sum')
                    ->helperText('Automatically calculated as Price * Slots Count.')
                    ->columnSpanFull(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('blogger_name')
            ->columns([
                Tables\Columns\TextColumn::make('blogger_name')
                    ->searchable()
                    ->weight('medium'),
                Tables\Columns\TextColumn::make('platform')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'Telegram' => 'info',
                        'Instagram' => 'warning',
                        'YouTube' => 'danger',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('price_per_slot')
                    ->money('RUB')
                    ->sortable(),
                Tables\Columns\TextColumn::make('slots_count')
                    ->numeric()
                    ->sortable()
                    ->alignCenter(),
                Tables\Columns\TextColumn::make('total_amount')
                    ->money('RUB')
                    ->sortable()
                    ->weight('bold'),
                Tables\Columns\TextColumn::make('start_date')
                    ->date('M d, Y')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('platform')
                    ->options([
                        'Telegram' => 'Telegram',
                        'Instagram' => 'Instagram',
                        'YouTube' => 'YouTube',
                    ]),
            ])
            ->headerActions([
                Tables\Actions\CreateAction::make(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }
}`,
  },
  {
    id: 'filament-create-report',
    filename: 'CreateReport.php',
    path: 'app/Filament/Pages/CreateReport.php',
    category: 'Filament Resources',
    language: 'php',
    description: 'Filament custom page with active form validation, optimized for Telegram Mini App integrations with reactive computations.',
    code: `<?php

namespace App\Filament\Pages;

use App\Models\Project;
use App\Models\Report;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Forms\Set;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

class CreateReport extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-document-plus';

    protected static string $view = 'filament.pages.create-report';
    
    protected static ?string $title = 'Create Daily Report';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'date' => now()->format('Y-m-d'),
            'slots_count' => 1,
            'price_per_slot' => 0,
            'total_amount' => 0,
        ]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\\Components\\Section::make('Report Configuration')
                    ->description('This form is optimized for mobile screens (Telegram Mini App viewport).')
                    ->schema([
                        Grid::make(2)->schema([
                            DatePicker::make('date')
                                ->default(now())
                                ->required()
                                ->native(false),

                            Select::make('project_id')
                                ->label('Target Project')
                                ->options(Project::all()->pluck('name', 'id'))
                                ->searchable()
                                ->required(),
                        ]),

                        Grid::make(2)->schema([
                            TextInput::make('destination')
                                ->required()
                                ->placeholder('e.g., App Downloads Campaign'),

                            TextInput::make('channel_blogger')
                                ->label('Channel / Blogger')
                                ->required()
                                ->placeholder('e.g., Pavel Code Hub'),
                        ]),

                        Grid::make(3)->schema([
                            Select::make('platform')
                                ->options([
                                    'Telegram' => 'Telegram',
                                    'Instagram' => 'Instagram',
                                    'YouTube' => 'YouTube',
                                ])
                                ->required()
                                ->native(false),

                            TextInput::make('slots_count')
                                ->label('Slots')
                                ->integer()
                                ->required()
                                ->live()
                                ->afterStateUpdated(function (Get $get, Set $set, ?string $state) {
                                    $slots = intval($state ?? 0);
                                    $price = floatval($get('price_per_slot') ?? 0);
                                    $set('total_amount', $slots * $price);
                                }),

                            TextInput::make('price_per_slot')
                                ->label('Price per Slot')
                                ->numeric()
                                ->prefix('₽')
                                ->required()
                                ->live()
                                ->afterStateUpdated(function (Get $get, Set $set, ?string $state) {
                                    $price = floatval($state ?? 0);
                                    $slots = intval($get('slots_count') ?? 0);
                                    $set('total_amount', $slots * $price);
                                }),
                        ]),

                        TextInput::make('total_amount')
                            ->label('Calculated Total Amount')
                            ->numeric()
                            ->prefix('₽')
                            ->disabled()
                            ->dehydrated()
                            ->helperText('Calculated in real-time as Slots * Unit Price.'),

                        Textarea::make('comments')
                            ->rows(3)
                            ->placeholder('Any comments, CTR details or impressions...'),
                    ])
            ])
            ->statePath('data');
    }

    public function submit(): void
    {
        $reportData = $this->form->getState();

        // Persist report to DB
        Report::create($reportData);

        // Reset state & show alert
        $this->form->fill([
            'date' => now()->format('Y-m-d'),
            'slots_count' => 1,
            'price_per_slot' => 0,
            'total_amount' => 0,
        ]);

        Notification::make()
            ->title('Daily Report Saved!')
            ->body('Influencer integration report successfully stored in the database.')
            ->success()
            ->send();
    }
}`,
  },
  {
    id: 'livewire-blogger-cabinet',
    filename: 'BloggerSubmissionPage.php',
    path: 'app/Livewire/BloggerSubmissionPage.php',
    category: 'Blogger Cabinet',
    language: 'php',
    description: 'Livewire component demonstrating dynamic field generation (file uploaders or text inputs) based on platform and slot parameters.',
    code: `<?php

namespace App\Livewire;

use App\Models\BloggerSubmission;
use App\Models\Integration;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Livewire\Component;

class BloggerSubmissionPage extends Component implements HasForms
{
    use InteractsWithForms;

    // URL / Mount parameters
    public ?Integration $integration = null;
    public string $platform = 'Telegram';
    public int $slots_count = 1;
    
    // Form state
    public ?array $data = [];

    public function mount(): void
    {
        // Dynamically grab attributes either from bound Integration model or general query parameters
        if ($this->integration) {
            $this->platform = $this->integration->platform;
            $this->slots_count = $this->integration->slots_count;
        } else {
            $this->platform = request()->query('platform', 'Telegram');
            $this->slots_count = intval(request()->query('slots_count', 1));
        }

        // Initialize state fields
        $this->form->fill();
    }

    public function form(Form $form): Form
    {
        $fields = [];

        // GENERATE PREDETERMINED COUNT OF FIELDS ACCORDING TO SYSTEM CONFIG
        for ($i = 1; $i <= $this->slots_count; $i++) {
            if ($this->platform === 'Instagram') {
                // Instagram asks for story screenshot uploads to verify slot delivery
                $fields[] = FileUpload::make("slot_{$i}")
                    ->label("Slot #{$i} - Stories Screenshot Upload")
                    ->image()
                    ->directory('blogger-screenshots')
                    ->required()
                    ->helperText('Please upload a valid high-resolution JPG/PNG screenshot of the story with views.');
            } else {
                // Telegram/YouTube channels receive publication links
                $fields[] = TextInput::make("slot_{$i}")
                    ->label("Slot #{$i} - Post Publication URL Link")
                    ->url()
                    ->required()
                    ->placeholder('https://t.me/channel_name/1234')
                    ->helperText('Paste the direct link to the published post.');
            }
        }

        return $form
            ->schema($fields)
            ->statePath('data');
    }

    public function submit(): void
    {
        // Enforce form validation rules
        $formData = $this->form->getState();

        // Create submission entry
        BloggerSubmission::create([
            'integration_id' => $this->integration?->id ?? 1, // Fallback for mockup demo
            'submitted_at' => now(),
            'status' => 'pending',
            'data' => $formData,
        ]);

        // Emit status and flash completion message
        session()->flash('success_message', 'Your integration files have been submitted successfully! The manager will verify them shortly.');
        
        $this->form->fill();
    }

    public function render()
    {
        return view('livewire.blogger-submission-page')
            ->layout('layouts.guest'); // Guest layout containing Tailwind asset injection
    }
}`,
  },
  {
    id: 'livewire-blade',
    filename: 'blogger-submission-page.blade.php',
    path: 'resources/views/livewire/blogger-submission-page.blade.php',
    category: 'Blogger Cabinet',
    language: 'html',
    description: 'Blade layout featuring Filament forms components wrapper styled for modern guest accessibility.',
    code: `<div class="max-w-xl mx-auto my-12 p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
    <div class="mb-8 text-center">
        <h2 class="text-2xl font-bold text-gray-900">Blogger Work Submission Cabinet</h2>
        <p class="mt-2 text-sm text-gray-500">
            Platform: <span class="font-semibold text-primary-600">{{ $platform }}</span> 
            | Purchased Slots: <span class="font-semibold text-primary-600">{{ $slots_count }}</span>
        </p>
    </div>

    @if (session()->has('success_message'))
        <div class="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
            {{ session('success_message') }}
        </div>
    @endif

    <form wire:submit="submit" class="space-y-6">
        {{ $this->form }}

        <button type="submit" class="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl shadow-sm transition duration-150 ease-in-out">
            Submit Integrations
        </button>
    </form>
    
    <div class="mt-8 text-center text-xs text-gray-400">
        Securely powered by Laravel & Filament V3
    </div>
</div>`,
  },
];
