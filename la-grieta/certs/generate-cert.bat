@echo off
REM ================================
REM SSL Certificate Generator for La Grieta TCG (Windows)
REM ================================
REM Generates a self-signed SSL certificate for local network development.
REM This enables HTTPS which is required for iOS Safari camera access (getUserMedia).
REM
REM Usage: generate-cert.bat [IP_ADDRESS]
REM   IP_ADDRESS: Optional. Your local network IP (e.g., 192.168.1.100)
REM               If not provided, uses localhost only.
REM
REM Example: generate-cert.bat 192.168.1.100
REM
REM Requires: OpenSSL installed and in PATH
REM   - Install via: choco install openssl
REM   - Or download from: https://slproweb.com/products/Win32OpenSSL.html

setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "CERT_DIR=%SCRIPT_DIR%"

REM Certificate configuration
set "DAYS_VALID=365"
set "KEY_SIZE=2048"

REM Use provided IP or default to localhost
if "%~1"=="" (
    set "COMMON_NAME=localhost"
) else (
    set "COMMON_NAME=%~1"
)

REM Output files
set "KEY_FILE=%CERT_DIR%server.key"
set "CERT_FILE=%CERT_DIR%server.crt"
set "CONFIG_FILE=%CERT_DIR%openssl.cnf"

echo ================================
echo La Grieta TCG - SSL Certificate Generator
echo ================================
echo.
echo Generating self-signed certificate for: %COMMON_NAME%
echo Certificate will be valid for %DAYS_VALID% days
echo.

REM Check if OpenSSL is available
where openssl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: OpenSSL is not installed or not in PATH
    echo.
    echo Please install OpenSSL:
    echo   - Using Chocolatey: choco install openssl
    echo   - Or download from: https://slproweb.com/products/Win32OpenSSL.html
    echo.
    pause
    exit /b 1
)

REM Create OpenSSL configuration file
echo [req] > "%CONFIG_FILE%"
echo default_bits = %KEY_SIZE% >> "%CONFIG_FILE%"
echo prompt = no >> "%CONFIG_FILE%"
echo default_md = sha256 >> "%CONFIG_FILE%"
echo distinguished_name = dn >> "%CONFIG_FILE%"
echo x509_extensions = v3_req >> "%CONFIG_FILE%"
echo. >> "%CONFIG_FILE%"
echo [dn] >> "%CONFIG_FILE%"
echo C = US >> "%CONFIG_FILE%"
echo ST = California >> "%CONFIG_FILE%"
echo L = San Francisco >> "%CONFIG_FILE%"
echo O = La Grieta TCG >> "%CONFIG_FILE%"
echo OU = Development >> "%CONFIG_FILE%"
echo CN = %COMMON_NAME% >> "%CONFIG_FILE%"
echo. >> "%CONFIG_FILE%"
echo [v3_req] >> "%CONFIG_FILE%"
echo basicConstraints = CA:FALSE >> "%CONFIG_FILE%"
echo keyUsage = nonRepudiation, digitalSignature, keyEncipherment >> "%CONFIG_FILE%"
echo subjectAltName = @alt_names >> "%CONFIG_FILE%"
echo. >> "%CONFIG_FILE%"
echo [alt_names] >> "%CONFIG_FILE%"
echo DNS.1 = localhost >> "%CONFIG_FILE%"
echo DNS.2 = lagrieta.local >> "%CONFIG_FILE%"
echo DNS.3 = *.lagrieta.local >> "%CONFIG_FILE%"
echo IP.1 = 127.0.0.1 >> "%CONFIG_FILE%"
echo IP.2 = ::1 >> "%CONFIG_FILE%"

REM Add custom IP if provided
if NOT "%COMMON_NAME%"=="localhost" (
    echo IP.3 = %COMMON_NAME% >> "%CONFIG_FILE%"
    echo DNS.4 = %COMMON_NAME% >> "%CONFIG_FILE%"
)

echo Generating private key...
openssl genrsa -out "%KEY_FILE%" %KEY_SIZE% 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to generate private key
    pause
    exit /b 1
)

echo Generating certificate...
openssl req -new -x509 -key "%KEY_FILE%" -out "%CERT_FILE%" -days %DAYS_VALID% -config "%CONFIG_FILE%" -extensions v3_req
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to generate certificate
    pause
    exit /b 1
)

echo.
echo ================================
echo Certificate generated successfully!
echo ================================
echo.
echo Files created:
echo   - Private Key: %KEY_FILE%
echo   - Certificate: %CERT_FILE%
echo   - Config:      %CONFIG_FILE%
echo.
echo Certificate details:
openssl x509 -in "%CERT_FILE%" -noout -subject -dates
echo.
echo ================================
echo IMPORTANT: iOS Certificate Installation
echo ================================
echo.
echo For iOS devices to accept this certificate:
echo.
echo 1. Copy server.crt to a location accessible from iOS
echo    (email it, host on HTTP, or use AirDrop)
echo.
echo 2. On iOS device:
echo    a. Open the .crt file
echo    b. Go to Settings ^> General ^> VPN ^& Device Management
echo    c. Install the profile
echo    d. Go to Settings ^> General ^> About ^> Certificate Trust Settings
echo    e. Enable full trust for the certificate
echo.
echo 3. Access the app at: https://%COMMON_NAME%
echo.
echo ================================
pause
