#!/bin/bash
set -e

echo "🚀 Deploying application..."

echo "📥 Pulling latest changes..."
git reset --hard && git pull

echo "📦 Installing composer dependencies..."
composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

echo "💾 Creating pre-deploy database safety backup..."
mkdir -p storage/backups
if [ -f "database/database.sqlite" ]; then
    cp database/database.sqlite "storage/backups/pre_deploy_$(date +%Y%m%d_%H%M%S).sqlite"
fi

echo "🗃️ Running database migrations and seeding..."
php artisan migrate --force
php artisan db:seed --force

echo "🔄 Syncing reports..."
php artisan reports:sync


# Ensure Node.js is present (auto-installs standalone portable Node.js if missing)
if [ -f "telegram-gateway/ensure-node.sh" ]; then
    bash telegram-gateway/ensure-node.sh || true
fi

# Load NVM / Node if installed
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Add local node runtime to PATH if present
if [ -d "storage/node-runtime/bin" ]; then
    export PATH="$(pwd)/storage/node-runtime/bin:$PATH"
fi

NODE_CMD="node"
if [ -x "$(pwd)/storage/node-runtime/bin/node" ]; then
    NODE_CMD="$(pwd)/storage/node-runtime/bin/node"
fi

NPM_CMD="npm"
if [ -x "$(pwd)/storage/node-runtime/bin/npm" ]; then
    NPM_CMD="$(pwd)/storage/node-runtime/bin/npm"
fi

echo "⚡ Optimizing application caches..."
php artisan optimize:clear
php artisan optimize

if command -v npm &> /dev/null || [ -x "$NPM_CMD" ]; then
    echo "📦 Installing npm dependencies & building assets..."
    $NPM_CMD install --no-audit || true
    $NPM_CMD run build || true

    echo "🤖 Starting Telegram Gateway microservice..."
    sed -i 's/TELEGRAM_GATEWAY_PORT=5005/TELEGRAM_GATEWAY_PORT=5006/g' .env 2>/dev/null || true

    if command -v pm2 &> /dev/null; then
        pm2 stop telegram-gateway 2>/dev/null || true
        pm2 delete telegram-gateway 2>/dev/null || true
    fi

    # Terminate any process currently holding ports 5005 or 5006
    fuser -k -9 5005/tcp 2>/dev/null || true
    fuser -k -9 5006/tcp 2>/dev/null || true
    pkill -9 -f "telegram-gateway/server.js" 2>/dev/null || true
    sleep 1

    # Ensure storage permissions for www-data
    chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
    chmod -R 775 storage bootstrap/cache 2>/dev/null || true

    if command -v pm2 &> /dev/null; then
        pm2 start telegram-gateway/server.js --name "telegram-gateway" --cwd "$(pwd)" --update-env
        pm2 save
    else
        nohup $NODE_CMD telegram-gateway/server.js > storage/logs/telegram-gateway.log 2>&1 < /dev/null &
    fi

    # Quick health check for gateway
    sleep 2
    curl -s -m 3 http://127.0.0.1:5006/status || echo "⚠️ Gateway starting in background..."
else
    echo "⚠️ Node.js runtime could not be started."
fi

echo "🎉 Deployment completed successfully!"
