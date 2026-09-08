#!/bin/bash
set -e

echo "🚀 Deploying application..."

echo "📥 Pulling latest changes..."
git reset --hard && git pull

echo "📦 Installing composer dependencies..."
composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

echo "🗃️ Running database migrations and seeding..."
php artisan migrate --force
php artisan db:seed --force

echo "🔄 Syncing reports..."
php artisan reports:sync

echo "⚡ Optimizing application caches..."
php artisan optimize:clear
php artisan optimize

echo "🎉 Deployment completed successfully!"
