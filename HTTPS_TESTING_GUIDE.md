# HTTPS Testing Guide

This guide will help you test the HTTPS functionality with your existing `ai-fitness.local` configuration.

## Prerequisites

1. You already have `ai-fitness.local` mapped to port 3000
2. Your development server is running on port 3000

## Setup Steps

### 1. Install mkcert (if not already installed)

**macOS:**
```bash
brew install mkcert
mkcert -install
```

**Linux:**
```bash
# See https://github.com/FiloSottile/mkcert#installation
```

**Windows:**
```bash
choco install mkcert
mkcert -install
```

### 2. Check Your Current Status

```bash
pseudo-url status
```

This should show:
- Your existing `ai-fitness.local → 3000` mapping
- Whether mkcert is installed
- Whether certificates are generated

### 3. Check Certificate Status

```bash
pseudo-url cert-status
```

### 4. Generate Certificates (if needed)

If certificates aren't automatically generated, run:

```bash
sudo pseudo-url cert-regenerate
```

### 5. Start the Proxy with HTTPS

Stop any running proxy first (Ctrl+C), then:

```bash
sudo pseudo-url start
```

You should see output like:
```
Starting pseudo-url proxy server...

✓ SSL certificates ready
✓ HTTP proxy server running on port 80
✓ HTTPS proxy server running on port 443
✓ Monitoring 1 domain(s)

Active mappings:
  • http://ai-fitness.local | https://ai-fitness.local → http://localhost:3000
```

## Testing Chrome HTTP-Only Features

### 1. Basic HTTPS Connection Test

Open Chrome and navigate to:
```
https://ai-fitness.local
```

You should see:
- ✅ A padlock icon in the address bar
- ✅ No certificate warnings
- ✅ Your application loads normally

### 2. Test Geolocation API

Open Chrome DevTools Console (F12) and run:
```javascript
navigator.geolocation.getCurrentPosition(
  (position) => console.log('Success:', position),
  (error) => console.error('Error:', error)
);
```

✅ **Expected**: It should prompt for location permission and work
❌ **Without HTTPS**: Would show error or not work

### 3. Test Service Workers

In Chrome DevTools Console:
```javascript
if ('serviceWorker' in navigator) {
  console.log('✅ Service Workers are supported');
  navigator.serviceWorker.getRegistrations()
    .then(registrations => console.log('Registrations:', registrations));
} else {
  console.log('❌ Service Workers are NOT supported');
}
```

✅ **Expected**: Service Workers should be fully supported
❌ **Without HTTPS**: Limited or no support

### 4. Test getUserMedia (Camera/Microphone)

In Chrome DevTools Console:
```javascript
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    console.log('✅ Camera/microphone access granted');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(error => console.error('❌ Error:', error));
```

✅ **Expected**: Prompts for camera/microphone permission
❌ **Without HTTPS**: Blocked by browser

### 5. Check Secure Context

In Chrome DevTools Console:
```javascript
console.log('Is Secure Context:', window.isSecureContext);
console.log('Location protocol:', window.location.protocol);
```

✅ **Expected Output**:
```
Is Secure Context: true
Location protocol: https:
```

### 6. Test Clipboard API

In Chrome DevTools Console:
```javascript
navigator.clipboard.writeText('Hello from HTTPS!')
  .then(() => console.log('✅ Clipboard write successful'))
  .catch(error => console.error('❌ Error:', error));
```

✅ **Expected**: Writes to clipboard successfully
❌ **Without HTTPS**: May be blocked

### 7. Test Web Crypto API

In Chrome DevTools Console:
```javascript
if (window.crypto && window.crypto.subtle) {
  console.log('✅ Web Crypto API is available');
  crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  ).then(key => console.log('Generated key:', key))
    .catch(error => console.error('Error:', error));
} else {
  console.log('❌ Web Crypto API is NOT available');
}
```

✅ **Expected**: Crypto operations work
❌ **Without HTTPS**: Limited availability

### 8. Check Chrome Security Info

1. Click the padlock icon in the address bar
2. Click "Connection is secure"
3. Click "Certificate is valid"

You should see:
- Certificate issued by: "mkcert [your-username]"
- Valid certificate chain
- No warnings

## Troubleshooting

### Certificate Not Trusted

If you see certificate warnings:

```bash
# Reinstall mkcert CA
mkcert -install

# Regenerate certificates
sudo pseudo-url cert-regenerate

# Restart the proxy
sudo pseudo-url start
```

### HTTPS Not Starting

Check:
```bash
pseudo-url cert-status
```

Make sure:
- ✅ mkcert is installed
- ✅ mkcert CA is installed
- ✅ Certificates are generated

### Port Already in Use

If port 443 is already in use:
```bash
# Check what's using port 443
sudo lsof -i :443

# Stop the other service or use a custom port
sudo pseudo-url start --https-port 8443
```

Then access: `https://ai-fitness.local:8443`

## Comparison: HTTP vs HTTPS

### HTTP (http://ai-fitness.local)
- ❌ Geolocation may not work
- ❌ Camera/microphone blocked
- ❌ Service Workers limited
- ❌ Some Web APIs unavailable
- ⚠️ Browser warnings for modern features

### HTTPS (https://ai-fitness.local)
- ✅ Geolocation works
- ✅ Camera/microphone accessible
- ✅ Service Workers fully supported
- ✅ All Web APIs available
- ✅ No browser warnings
- ✅ Matches production environment

## Switching Between HTTP and HTTPS

### Use Both (Default)
```bash
sudo pseudo-url start
# Access via http://ai-fitness.local OR https://ai-fitness.local
```

### HTTPS Only
```bash
sudo pseudo-url start
# Just use https://ai-fitness.local
```

### HTTP Only (Disable HTTPS)
```bash
sudo pseudo-url start --no-https
# Only http://ai-fitness.local will work
```

## Success Criteria

Your HTTPS setup is working correctly if:

1. ✅ `https://ai-fitness.local` loads without warnings
2. ✅ Chrome shows a padlock icon
3. ✅ Geolocation API works
4. ✅ `window.isSecureContext` returns `true`
5. ✅ Service Workers are supported
6. ✅ Camera/microphone access is available
7. ✅ Certificate is trusted by browser

## Next Steps

Once HTTPS is working:

1. Update your development workflow to use HTTPS URLs
2. Test any features that require secure contexts
3. Consider using HTTPS for all your local development domains
4. Add more domains as needed with `pseudo-url add`

All new domains will automatically get SSL certificates!

