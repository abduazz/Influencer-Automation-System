<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'telegram' => [
        'bot_token' => env('TELEGRAM_BOT_TOKEN'),
        'reports_chat_id' => env('TELEGRAM_REPORTS_CHAT_ID') === '-4904683057' ? '-1004329107459' : (env('TELEGRAM_REPORTS_CHAT_ID') ?: '-1004329107459'),
        'submissions_chat_id' => env('TELEGRAM_SUBMISSIONS_CHAT_ID'),
        'chat_id' => env('TELEGRAM_CHAT_ID'),
    ],

    'google' => [
        'service_account_json' => env('GOOGLE_SERVICE_ACCOUNT_JSON'),
        'spreadsheet_id' => env('GOOGLE_SPREADSHEET_ID', '1_TBYmmaWZPIG5_Kz2Sr706w6Km_VS-l7Q2UtKADrrus'),
    ],

    'instagram' => [
        'driver' => env('INSTAGRAM_API_DRIVER', 'mock'),
        'meta_user_id' => env('INSTAGRAM_META_USER_ID'),
        'meta_access_token' => env('INSTAGRAM_META_ACCESS_TOKEN'),
        'rapidapi_key' => env('INSTAGRAM_RAPIDAPI_KEY'),
        'rapidapi_host' => env('INSTAGRAM_RAPIDAPI_HOST', 'instagram-scraper-api2.p.rapidapi.com'),
    ],

];
