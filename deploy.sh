#!/bin/sh
set -e

echo "🚚 Deploying application"

echo "🚀 Pulling latest changes..."
git reset --hard && git pull

echo "📦 Installing composer dependencies"
export COMPOSER_HOME="/tmp"
php composer.phar install --no-interaction --prefer-dist --optimize-autoloader --no-dev

# Assets are pre-compiled locally and committed to the repository, npm is not needed on the server.

echo "🗃️ Running migrations and seeding"
php artisan migrate --force
php artisan db:seed --force

echo "⚡ Optimizing application caches"
php artisan optimize

echo "🎉 Deployed application"


