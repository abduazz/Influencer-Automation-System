<?php

namespace App\Enums;

enum Platform: string
{
    case Telegram = 'Telegram';
    case Instagram = 'Instagram';
    case YouTube = 'YouTube';
    case MAX = 'MAX';
}
