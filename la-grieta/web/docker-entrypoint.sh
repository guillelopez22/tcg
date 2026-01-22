#!/bin/sh
set -e

# Substitute environment variables in nginx config
# This allows runtime configuration of API_URL for Railway deployments

CONFIG_FILE="/etc/nginx/conf.d/default.conf"

if [ -n "$API_URL" ]; then
    echo "Configuring API proxy to: $API_URL"
    # Replace the API_URL_PLACEHOLDER with the actual API_URL value
    sed -i "s|API_URL_PLACEHOLDER|${API_URL}|g" "$CONFIG_FILE"
else
    echo "WARNING: API_URL not set, using default http://api:3000"
    sed -i "s|API_URL_PLACEHOLDER|http://api:3000|g" "$CONFIG_FILE"
fi

# Substitute PORT for Railway's dynamic port assignment
# Default to 80 for local Docker development
PORT=${PORT:-80}
echo "Configuring nginx to listen on port: $PORT"
sed -i "s|PORT_PLACEHOLDER|${PORT}|g" "$CONFIG_FILE"

# Validate nginx configuration
echo "Validating nginx configuration..."
nginx -t

# Start nginx
echo "Starting nginx..."
exec nginx -g "daemon off;"
