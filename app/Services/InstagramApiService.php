<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class InstagramApiService
{
    /**
     * Extracts clean Instagram username from URL or handle.
     */
    public static function extractUsername(string $input): string
    {
        $clean = trim($input);
        $clean = preg_replace('/[?#].*$/', '', $clean);
        $clean = rtrim($clean, '/');

        if (preg_match('/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9._-]+)/i', $clean, $matches)) {
            return strtolower(trim($matches[1]));
        }

        return strtolower(trim(ltrim($clean, '@#')));
    }

    /**
     * Extracts clean Telegram username from URL or handle.
     */
    public static function extractTelegramUsername(string $input): string
    {
        $clean = trim($input);
        $clean = preg_replace('/[?#].*$/', '', $clean);
        $clean = rtrim($clean, '/');

        if (preg_match('/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/i', $clean, $matches)) {
            return strtolower(trim($matches[1]));
        }

        return strtolower(trim(ltrim($clean, '@#')));
    }

    /**
     * Extracts or constructs a valid public YouTube channel URL from handle or link.
     */
    public static function extractYouTubeUrl(string $input): string
    {
        $clean = trim($input);
        $clean = preg_replace('/[?#].*$/', '', $clean);
        $clean = rtrim($clean, '/');

        // If it's already a full YouTube channel URL
        if (preg_match('#^https?://(?:www\.)?youtube\.com/(?:@[a-zA-Z0-9._-]+|channel/[a-zA-Z0-9_-]+|c/[a-zA-Z0-9_-]+)#i', $clean)) {
            return $clean;
        }

        // If it's just @handle or handle
        $handle = ltrim($clean, '@#');
        return 'https://www.youtube.com/@' . $handle;
    }

    /**
     * Helper to parse textual subscriber counts into integer numbers.
     * Handles: "14.5M", "10.8M subscribers", "1 098 501 subscribers", "125.4K", "1.2 млн", "45 000 members", etc.
     */
    public static function parseSubscriberCountString(string $text): ?int
    {
        $clean = trim(str_replace(["\xc2\xa0", "&nbsp;"], " ", $text));

        // Pattern 1: Check for explicit K/M/B multiplier e.g. "10.8M", "125.4K", "14.5 million", "1.2 млн"
        if (preg_match('/^([\d.,]+)\s*(M|B|K|млн|тыс|тыщ|million|billion)\b/iu', $clean, $m)) {
            $val = (float) str_replace(',', '.', $m[1]);
            $suffix = strtolower($m[2]);
            if (in_array($suffix, ['m', 'млн', 'million'])) {
                return (int) round($val * 1000000);
            }
            if (in_array($suffix, ['k', 'тыс', 'тыщ'])) {
                return (int) round($val * 1000);
            }
            if (in_array($suffix, ['b', 'billion'])) {
                return (int) round($val * 1000000000);
            }
        }

        // Pattern 2: Pure integer count with spaces, commas or dots as thousands separators
        if (preg_match('/^([\d\s.,]+)/u', $clean, $m)) {
            $digits = preg_replace('/[^\d]/', '', $m[1]);
            if (!empty($digits)) {
                return (int) $digits;
            }
        }

        return null;
    }

    /**
     * Fetches current subscriber/follower count across supported platforms.
     * Returns ['success' => bool, 'count' => int, 'source' => string, 'error' => string|null]
     */
    public function fetchSubscriberCount(string $platform, string $handleOrUrl, ?int $previousCount = null): array
    {
        $platformNorm = strtolower(trim($platform));

        // 1. Telegram (Method B - public preview parsing, no keys needed)
        if ($platformNorm === 'telegram') {
            return $this->fetchFromTelegram($handleOrUrl);
        }

        // 2. YouTube (Method B - public channel page scraping, no keys needed)
        if ($platformNorm === 'youtube') {
            return $this->fetchFromYouTube($handleOrUrl);
        }

        // 3. TikTok (Manual only, as ByteDance requires OAuth)
        if ($platformNorm === 'tiktok') {
            return [
                'success' => false,
                'count' => 0,
                'source' => 'manual',
                'error' => 'Для TikTok количество подписчиков вносится вручную через кнопку "+ Замер"'
            ];
        }

        // 4. Instagram (Meta Graph API / RapidAPI / Mock Driver)
        return $this->fetchFromInstagram($handleOrUrl, $previousCount);
    }

    /**
     * Telegram "Method B": Public channel parsing via t.me without API keys.
     */
    public function fetchFromTelegram(string $handleOrUrl): array
    {
        $username = self::extractTelegramUsername($handleOrUrl);

        if (empty($username)) {
            return [
                'success' => false,
                'count' => 0,
                'source' => 'telegram_public',
                'error' => 'Не удалось распознать юзернейм Telegram-канала'
            ];
        }

        try {
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\r\n" .
                                "Accept-Language: en-US,en;q=0.9,ru;q=0.8\r\n",
                    'timeout' => 7,
                    'ignore_errors' => true
                ]
            ]);

            // Attempt 1: Direct channel preview page (https://t.me/username)
            $html = @file_get_contents("https://t.me/{$username}", false, $context);

            if ($html && preg_match('/class="tgme_page_extra"[^>]*>([^<]+)<\/div>/i', $html, $m)) {
                $count = self::parseSubscriberCountString($m[1]);
                if ($count !== null && $count >= 0) {
                    return [
                        'success' => true,
                        'count' => $count,
                        'source' => 'telegram_public',
                        'error' => null
                    ];
                }
            }

            // Attempt 2: Public channel web preview feed (https://t.me/s/username)
            $sHtml = @file_get_contents("https://t.me/s/{$username}", false, $context);

            if ($sHtml) {
                // Check header counter (e.g. <div class="tgme_header_counter">10.8M subscribers</div>)
                if (preg_match('/class="tgme_header_counter"[^>]*>([^<]+)<\/div>/i', $sHtml, $m)) {
                    $count = self::parseSubscriberCountString($m[1]);
                    if ($count !== null && $count >= 0) {
                        return [
                            'success' => true,
                            'count' => $count,
                            'source' => 'telegram_public',
                            'error' => null
                        ];
                    }
                }

                // Check info counter (e.g. <span class="counter_value">10.8M</span> <span class="counter_type">subscribers</span>)
                if (preg_match('/class="counter_value">([^<]+)<\/span>\s*<span class="counter_type">(?:subscribers|members|подписчиков|участников)/i', $sHtml, $m)) {
                    $count = self::parseSubscriberCountString($m[1]);
                    if ($count !== null && $count >= 0) {
                        return [
                            'success' => true,
                            'count' => $count,
                            'source' => 'telegram_public',
                            'error' => null
                        ];
                    }
                }
            }

            return [
                'success' => false,
                'count' => 0,
                'source' => 'telegram_public',
                'error' => "Telegram-канал @{$username} не найден или является приватным (требуется открытый публичный канал)"
            ];
        } catch (\Throwable $e) {
            Log::warning("Telegram public fetch failed for @{$username}: " . $e->getMessage());
            return [
                'success' => false,
                'count' => 0,
                'source' => 'telegram_public',
                'error' => 'Ошибка при запросе к Telegram: ' . $e->getMessage()
            ];
        }
    }

    /**
     * YouTube "Method B": Public channel page scraping without API keys.
     */
    public function fetchFromYouTube(string $handleOrUrl): array
    {
        $channelUrl = self::extractYouTubeUrl($handleOrUrl);

        try {
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\r\n" .
                                "Accept-Language: en-US,en;q=0.9\r\n" .
                                "Cookie: CONSENT=YES+cb; SOCS=CAESEwgDEgk2NDU4MzkwMTQaAmVuIAEaBgiA_LyuBg\r\n",
                    'timeout' => 8,
                    'ignore_errors' => true
                ]
            ]);

            $html = @file_get_contents($channelUrl, false, $context);

            if (!$html) {
                return [
                    'success' => false,
                    'count' => 0,
                    'source' => 'youtube_public',
                    'error' => "Не удалось открыть страницу YouTube канала: {$channelUrl}"
                ];
            }

            // Strategy 1: FollowAction Schema.org metadata (Most accurate integer number)
            if (preg_match('/"interactionType":\s*\{\s*"type":\s*"FollowAction"\s*\},\s*"userInteractionCount":\s*"(\d+)"/i', $html, $m)) {
                $count = (int) $m[1];
                return [
                    'success' => true,
                    'count' => $count,
                    'source' => 'youtube_public',
                    'error' => null
                ];
            }

            // Strategy 2: Extract from ytInitialData JSON in HTML
            $pos = strpos($html, 'var ytInitialData = ');
            if ($pos !== false) {
                $sub = substr($html, $pos + strlen('var ytInitialData = '));
                $end = strpos($sub, ';</script>');
                if ($end !== false) {
                    $json = json_decode(substr($sub, 0, $end), true);
                    $header = $json['header'] ?? [];
                    $foundStrings = [];

                    $search = function($arr) use (&$search, &$foundStrings) {
                        foreach ($arr as $k => $v) {
                            if (is_string($v) && stripos($v, 'subscriber') !== false) {
                                $foundStrings[] = $v;
                            } elseif (is_array($v)) {
                                $search($v);
                            }
                        }
                    };
                    $search($header);

                    foreach ($foundStrings as $str) {
                        $parsed = self::parseSubscriberCountString($str);
                        if ($parsed !== null && $parsed >= 0) {
                            return [
                                'success' => true,
                                'count' => $parsed,
                                'source' => 'youtube_public',
                                'error' => null
                            ];
                        }
                    }
                }
            }

            // Strategy 3: Regex fallback on subscriberCountText
            if (preg_match('/"subscriberCountText":\s*\{[^}]*"(?:simpleText|label)":\s*"([^"]+)"/i', $html, $m)) {
                $count = self::parseSubscriberCountString($m[1]);
                if ($count !== null && $count >= 0) {
                    return [
                        'success' => true,
                        'count' => $count,
                        'source' => 'youtube_public',
                        'error' => null
                    ];
                }
            }

            return [
                'success' => false,
                'count' => 0,
                'source' => 'youtube_public',
                'error' => "YouTube-канал не найден или число подписчиков скрыто автором"
            ];
        } catch (\Throwable $e) {
            Log::warning("YouTube public fetch failed for {$channelUrl}: " . $e->getMessage());
            return [
                'success' => false,
                'count' => 0,
                'source' => 'youtube_public',
                'error' => 'Ошибка при запросе к YouTube: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Instagram Driver Handler (Meta API, RapidAPI, or Mock stub)
     */
    protected function fetchFromInstagram(string $handleOrUrl, ?int $previousCount = null): array
    {
        $driver = config('services.instagram.driver', env('INSTAGRAM_API_DRIVER', 'mock'));
        $username = self::extractUsername($handleOrUrl);

        if (empty($username)) {
            return [
                'success' => false,
                'count' => 0,
                'source' => 'error',
                'error' => 'Не удалось распознать имя профиля Instagram'
            ];
        }

        // If Meta API is configured and driver is 'meta'
        if ($driver === 'meta') {
            return $this->fetchFromMetaGraphApi($username);
        }

        // If RapidAPI is configured and driver is 'rapidapi'
        if ($driver === 'rapidapi') {
            return $this->fetchFromRapidApi($username);
        }

        // Mock / Simulation Driver ("Глушилка" для тестирования UI/UX)
        return $this->fetchFromMockDriver($username, 'Instagram', $previousCount);
    }

    /**
     * Official Meta Graph API (Business Discovery)
     */
    protected function fetchFromMetaGraphApi(string $username): array
    {
        $userId = config('services.instagram.meta_user_id', env('INSTAGRAM_META_USER_ID'));
        $token = config('services.instagram.meta_access_token', env('INSTAGRAM_META_ACCESS_TOKEN'));

        if (!$userId || !$token) {
            return [
                'success' => false,
                'count' => 0,
                'source' => 'meta',
                'error' => 'Meta credentials (INSTAGRAM_META_USER_ID / INSTAGRAM_META_ACCESS_TOKEN) не настроены'
            ];
        }

        try {
            $url = "https://graph.facebook.com/v21.0/{$userId}";
            $response = Http::timeout(10)->get($url, [
                'fields' => "business_discovery.username({$username}){followers_count,media_count,name}",
                'access_token' => $token,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $discovery = $data['business_discovery'] ?? [];
                $count = (int) ($discovery['followers_count'] ?? 0);

                return [
                    'success' => true,
                    'count' => $count,
                    'source' => 'meta_api',
                    'error' => null
                ];
            }

            $errorMsg = $response->json('error.message') ?? 'Meta API error: ' . $response->status();
            Log::warning("Meta Graph API error for @{$username}: " . $errorMsg);

            return [
                'success' => false,
                'count' => 0,
                'source' => 'meta_api',
                'error' => $errorMsg
            ];
        } catch (\Throwable $e) {
            Log::error("Meta Graph API exception for @{$username}: " . $e->getMessage());
            return [
                'success' => false,
                'count' => 0,
                'source' => 'meta_api',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * RapidAPI Driver (Optional ready-made Instagram scraper)
     */
    protected function fetchFromRapidApi(string $username): array
    {
        $apiKey = config('services.instagram.rapidapi_key', env('INSTAGRAM_RAPIDAPI_KEY'));
        $apiHost = config('services.instagram.rapidapi_host', env('INSTAGRAM_RAPIDAPI_HOST', 'instagram-scraper-api2.p.rapidapi.com'));

        if (!$apiKey) {
            return [
                'success' => false,
                'count' => 0,
                'source' => 'rapidapi',
                'error' => 'INSTAGRAM_RAPIDAPI_KEY не указан'
            ];
        }

        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'X-RapidAPI-Key' => $apiKey,
                    'X-RapidAPI-Host' => $apiHost,
                ])
                ->get("https://{$apiHost}/v1/info", [
                    'username_or_id_or_url' => $username,
                ]);

            if ($response->successful()) {
                $data = $response->json('data') ?? $response->json();
                $count = (int) ($data['follower_count'] ?? $data['followers'] ?? 0);

                return [
                    'success' => true,
                    'count' => $count,
                    'source' => 'rapidapi',
                    'error' => null
                ];
            }

            return [
                'success' => false,
                'count' => 0,
                'source' => 'rapidapi',
                'error' => 'RapidAPI error: ' . $response->status()
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'count' => 0,
                'source' => 'rapidapi',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Mock / Stub Driver ("Глушилка"):
     * Generates a realistic follower count and increments on refresh so team can test the UI/UX immediately.
     */
    protected function fetchFromMockDriver(string $username, string $platform, ?int $previousCount = null): array
    {
        // If there was already a follower count, simulate realistic organic growth (+0.8% to +3.5%)
        if ($previousCount && $previousCount > 0) {
            $growthFactor = mt_rand(8, 35) / 1000.0;
            $increment = max(120, (int) round($previousCount * $growthFactor));
            $newCount = $previousCount + $increment;

            return [
                'success' => true,
                'count' => $newCount,
                'source' => 'mock_api',
                'error' => null
            ];
        }

        // If starting from scratch, generate deterministic realistic follower count based on username hash
        $hash = crc32($username);
        $tiers = [
            [15000, 45000],   // Micro
            [55000, 140000],  // Mid
            [160000, 480000], // High mid
            [520000, 1200000] // Macro
        ];
        $tier = $tiers[abs($hash) % count($tiers)];
        $generatedCount = $tier[0] + (abs($hash * 7) % ($tier[1] - $tier[0]));
        $generatedCount = (int) round($generatedCount / 100) * 100;

        return [
            'success' => true,
            'count' => $generatedCount,
            'source' => 'mock_api',
            'error' => null
        ];
    }

    /**
     * Helper to generate a realistic initial 4-point historical timeline (spaced ~14 days apart)
     * so that charts immediately look rich and realistic for new or existing bloggers.
     */
    public static function generateInitialHistory(int $currentCount, string $source = 'api'): array
    {
        if ($currentCount <= 0) {
            return [];
        }

        $history = [];
        $intervals = [42, 28, 14, 0]; // 6 weeks ago, 4 weeks ago, 2 weeks ago, today
        $growthPercentages = [0.91, 0.94, 0.97, 1.0]; // progressive growth

        foreach ($intervals as $idx => $daysAgo) {
            $date = now()->subDays($daysAgo)->format('Y-m-d');
            $count = (int) round($currentCount * $growthPercentages[$idx]);
            $history[] = [
                'date' => $date,
                'count' => $count,
                'source' => $daysAgo === 0 ? $source : 'historical',
                'note' => $daysAgo === 0 ? 'Текущий срез' : null
            ];
        }

        return $history;
    }
}
