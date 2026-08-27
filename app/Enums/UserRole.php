<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'super_admin';
    case PrManager = 'pr_manager';
    case ProductManager = 'product_manager';
    case Executive = 'executive';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Супер-администратор',
            self::PrManager => 'PR-менеджер',
            self::ProductManager => 'Продуктовый менеджер',
            self::Executive => 'Руководство',
        };
    }
}
