# Phase 4 Environment Setup

## Encryption Key

To enable secure storage of database credentials, you need to generate an encryption key:

```bash
# Generate a 32-byte (256-bit) encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add this to your `.env` file:

```env
ENCRYPTION_KEY=<your-generated-key-here>
```

**IMPORTANT:** 
- The key MUST be exactly 64 hexadecimal characters (32 bytes)
- Never commit the `.env` file or expose this key
- Use different keys for development, staging, and production
- Store production keys in a secure key management system

## Example .env addition:

```env
# Encryption for database connection credentials (Phase 4)
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```
