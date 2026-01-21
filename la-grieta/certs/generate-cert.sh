#!/bin/bash
# ================================
# SSL Certificate Generator for La Grieta TCG
# ================================
# Generates a self-signed SSL certificate for local network development.
# This enables HTTPS which is required for iOS Safari camera access (getUserMedia).
#
# Usage: ./generate-cert.sh [IP_ADDRESS]
#   IP_ADDRESS: Optional. Your local network IP (e.g., 192.168.1.100)
#               If not provided, uses localhost only.
#
# Example: ./generate-cert.sh 192.168.1.100

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="$SCRIPT_DIR"

# Certificate configuration
DAYS_VALID=365
KEY_SIZE=2048
COUNTRY="US"
STATE="California"
LOCALITY="San Francisco"
ORGANIZATION="La Grieta TCG"
ORGANIZATIONAL_UNIT="Development"
COMMON_NAME="${1:-localhost}"

# Output files
KEY_FILE="$CERT_DIR/server.key"
CERT_FILE="$CERT_DIR/server.crt"
CONFIG_FILE="$CERT_DIR/openssl.cnf"

echo "================================"
echo "La Grieta TCG - SSL Certificate Generator"
echo "================================"
echo ""
echo "Generating self-signed certificate for: $COMMON_NAME"
echo "Certificate will be valid for $DAYS_VALID days"
echo ""

# Create OpenSSL configuration file with SAN (Subject Alternative Names)
# This is required for modern browsers to accept the certificate
cat > "$CONFIG_FILE" << EOF
[req]
default_bits = $KEY_SIZE
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = $COUNTRY
ST = $STATE
L = $LOCALITY
O = $ORGANIZATION
OU = $ORGANIZATIONAL_UNIT
CN = $COMMON_NAME

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = lagrieta.local
DNS.3 = *.lagrieta.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Add the custom IP if provided
if [ "$COMMON_NAME" != "localhost" ]; then
    echo "IP.3 = $COMMON_NAME" >> "$CONFIG_FILE"
    echo "DNS.4 = $COMMON_NAME" >> "$CONFIG_FILE"
fi

# Generate private key and certificate
echo "Generating private key..."
openssl genrsa -out "$KEY_FILE" $KEY_SIZE 2>/dev/null

echo "Generating certificate..."
openssl req -new -x509 \
    -key "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days $DAYS_VALID \
    -config "$CONFIG_FILE" \
    -extensions v3_req

# Set appropriate permissions
chmod 644 "$CERT_FILE"
chmod 600 "$KEY_FILE"

echo ""
echo "================================"
echo "Certificate generated successfully!"
echo "================================"
echo ""
echo "Files created:"
echo "  - Private Key: $KEY_FILE"
echo "  - Certificate: $CERT_FILE"
echo "  - Config:      $CONFIG_FILE"
echo ""
echo "Certificate details:"
openssl x509 -in "$CERT_FILE" -noout -subject -dates
echo ""
echo "================================"
echo "IMPORTANT: iOS Certificate Installation"
echo "================================"
echo ""
echo "For iOS devices to accept this certificate:"
echo ""
echo "1. Copy server.crt to a location accessible from iOS"
echo "   (email it, host on HTTP, or use AirDrop)"
echo ""
echo "2. On iOS device:"
echo "   a. Open the .crt file"
echo "   b. Go to Settings > General > VPN & Device Management"
echo "   c. Install the profile"
echo "   d. Go to Settings > General > About > Certificate Trust Settings"
echo "   e. Enable full trust for the certificate"
echo ""
echo "3. Access the app at: https://$COMMON_NAME"
echo ""
echo "================================"
