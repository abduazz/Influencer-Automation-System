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

echo "📊 Syncing integrations with actual reports..."
php artisan integrations:sync-reports

echo "⚡ Optimizing application caches..."
php artisan optimize:clear
php artisan optimize

echo "📦 Installing npm dependencies & building assets..."
npm install --no-audit
npm run build

echo "🤖 Starting Telegram Gateway microservice..."
if command -v pm2 &> /dev/null; then
    pm2 restart telegram-gateway 2>/dev/null || pm2 start telegram-gateway/server.js --name "telegram-gateway"
    pm2 save
else
    pkill -f "telegram-gateway/server.js" || true
    nohup node telegram-gateway/server.js > storage/logs/telegram-gateway.log 2>&1 < /dev/null &
fi

echo "🎉 Deployment completed successfully!"
