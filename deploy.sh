#!/bin/sh
set -e

export HOME="/tmp"
export COMPOSER_HOME="/tmp"

echo "🚚 Deploying application"

# Ensure git safe directory and ignore filemode changes
git config --global --add safe.directory /var/www/influencer-laravel 2>/dev/null || true
git config --global --add safe.directory '*' 2>/dev/null || true
git config core.fileMode false 2>/dev/null || true

echo "🚀 Pulling latest changes..."
git reset --hard && git pull

echo "📦 Installing composer dependencies"
composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

# Assets are pre-compiled locally and committed to the repository, npm is not needed on the server.

echo "🗃️ Running migrations and seeding"
php artisan migrate --force
php artisan db:seed --force

echo "🔄 Syncing unsent reports to Telegram & Google Sheets"
php artisan reports:sync

echo "⚡ Optimizing application caches"
php artisan optimize

echo "🔒 Setting permissions for storage and bootstrap/cache"
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

echo "🎉 Deployed application"


