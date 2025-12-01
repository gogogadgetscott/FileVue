# FileVue

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Modern web-based file and folder explorer with a secure Node.js API, React UI, and Docker Compose deployment. FileVue can safely browse any host folder, optionally locking itself to **read-only** mode for dry runs and testing, and ships with optional username/password authentication.

![FileVue Screenshot](https://via.placeholder.com/800x450?text=FileVue+Screenshot)

## ✨ Features

- 📁 **Fast directory listing** with metadata (size, modified date, MIME hints) and contextual sorting
- 👁️ **File previews** for text, binary, and image content with automatic MIME detection
- 🖼️ **Multiple view modes** — thumbnail view with inline image rendering, table view, and card view
- ✏️ **File operations** — download, create, and delete files or directories (subject to read-only flag)
- 🧭 **Easy navigation** — inline UI prompts for new folders/files plus breadcrumb navigation
- 🔒 **Security hardened** — path resolution prevents escaping the mounted root
- 🔐 **Optional authentication** — JWT-protected API with username/password login
- 🐳 **Single-container deployment** — Express API serves the built React client

## 📋 Requirements

- **Node.js 20+** and npm (for local development)
- **Docker + Docker Compose** (for containerized usage)

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/gogogadgetscott/filevue.git
cd filevue

# Copy and configure environment
cp default.env .env

# Start the application
docker compose up --build
```

Then open [http://localhost:8080](http://localhost:8080) in your browser (or [https://localhost:8443](https://localhost:8443) if HTTPS is enabled).

> **Note:** Docker maps external ports `8080` (HTTP) and `8443` (HTTPS) to the container's internal ports `80` and `443`.

### Local Development

1. **Install dependencies:**
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. **Start the API** (default root is `./sample-data` when run locally):
   ```bash
   ROOT_DIRECTORY=$(pwd)/sample-data READ_ONLY_MODE=false node server/src/server.js
   ```
   Alternatively, use `npm run dev` in `server` for auto-reload.

3. **Start the React dev server:**
   ```bash
   cd client
   npm run dev
   ```
   Vite proxies `/api` calls to `localhost:80`.

## 🐳 Docker Compose

The provided stack builds both client and server, then mounts the host folder into `/data` in the container. Copy `.env` as needed to adjust preview limits or credentials.

```bash
docker compose up --build
```

Configuration happens through environment variables (see below). Update the volume line in `docker-compose.yml` to point at the folder you want to expose:

```yaml
volumes:
  - /absolute/path/to/your/files:/data:ro
```

Switch the trailing `:ro` to `:rw` plus set `READ_ONLY_MODE=false` when you are ready for write access.

## ⚙️ Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `80` | HTTP port for the combined API/UI server. |
| `HTTPS_ENABLED` | `false` | Enable HTTPS server with SSL/TLS certificates. |
| `HTTPS_PORT` | `443` | HTTPS port when `HTTPS_ENABLED=true`. |
| `SSL_CERT_PATH` | `/certs/cert.pem` | Path to SSL certificate file. |
| `SSL_KEY_PATH` | `/certs/key.pem` | Path to SSL private key file. |
| `COOKIE_SECURE` | `true` | Set to `true` for HTTPS to enable secure cookies. |
| `ROOT_DIRECTORY` | `/data` | Directory exposed through the explorer. With Docker this is the mounted volume. |
| `READ_ONLY_MODE` | `true` | When `true`, any write/delete endpoints return HTTP 403. Leave enabled during validation. |
| `MAX_PREVIEW_BYTES` | `1048576` | Max bytes for text/binary previews. |
| `IMAGE_PREVIEW_MAX_BYTES` | `2097152` | Max bytes for inline image previews. |
| `THUMBNAIL_MAX_BYTES` | `262144` | Max bytes for thumbnail retrieval requests. |
| `EXPLORER_USERNAME` | `demo` | Username required to obtain a JWT session token. Leave blank to disable auth entirely. |
| `EXPLORER_PASSWORD` | `demo-password` | Password paired with `EXPLORER_USERNAME`. |
| `SESSION_SECRET` | `change-me` | Secret used to sign JWTs. Always override in production. |
| `SESSION_TTL_SECONDS` | `3600` | Token lifetime in seconds. |

### 🔐 Enabling HTTPS

To enable HTTPS, you need SSL certificates. You can use Let's Encrypt, self-signed certificates, or certificates from a CA.

1. **Generate self-signed certificates** (for development/testing):
   ```bash
   make certs
   ```
   This creates a `certs/` directory with `key.pem` and `cert.pem` valid for 365 days.

   > **Note:** The `certs/` folder is git-ignored. Each environment should generate its own certificates or use certificates from a trusted CA.

2. **Update your `.env` file**:
   ```env
   HTTPS_ENABLED=true
   SSL_CERT_PATH=/certs/cert.pem
   SSL_KEY_PATH=/certs/key.pem
   COOKIE_SECURE=true
   ```

3. **Mount the certificates in Docker Compose** (uncomment the certs volume in `docker-compose.yml`):
   ```yaml
   volumes:
     - ./certs:/certs:ro
   ```

4. **Access via HTTPS**: 
   - **Docker:** Open [https://localhost:8443](https://localhost:8443)
   - **Local development:** Open [https://localhost:443](https://localhost:443)

> ⚠️ **Production Note:** For production deployments, use certificates from a trusted Certificate Authority (e.g., Let's Encrypt) instead of self-signed certificates.

## 📡 API Overview

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/meta` | Returns root path, read-only flag, and preview limits. |
| `GET` | `/api/tree?path=.` | Lists entries within the specified directory. |
| `GET` | `/api/file/content?path=foo.txt` | Returns file metadata plus preview (auto base64 for binary data). |
| `GET` | `/api/file/thumbnail?path=image.png` | Returns a base64 thumbnail for supported image types. |
| `GET` | `/api/file/download?path=foo.txt` | Streams file download. |
| `POST` | `/api/folders` | Creates a directory. Body: `{ parentPath, name }`. Disabled when read-only. |
| `POST` | `/api/files` | Creates a text/binary file. Body: `{ parentPath, name, content, encoding }`. Disabled when read-only. |
| `DELETE` | `/api/entries?path=foo` | Deletes a file or folder recursively. Disabled when read-only. |
| `GET` | `/api/auth/status` | Public endpoint indicating whether auth is required. |
| `POST` | `/api/auth/login` | Exchanges username/password for a JWT token. |

## 🔒 Read-only Mode

- **Enabled by default** (`READ_ONLY_MODE=true`)
- All mutating endpoints short-circuit with HTTP 403
- Frontend automatically disables creation/deletion buttons when `readOnly` is true
- Use this mode whenever you mount a sensitive or production dataset for auditing

## 🔐 Authentication

- When authentication is enabled (default credentials in `.env`), the frontend prompts for a login before issuing API calls
- Tokens are short-lived JWTs signed with `SESSION_SECRET`
- Delete or rename `EXPLORER_USERNAME`/`EXPLORER_PASSWORD` to disable authentication entirely

> ⚠️ **Security Note:** Always change the default credentials and `SESSION_SECRET` in production!

## 🏗️ Building Without Docker Compose

```bash
# Build the client
cd client && npm run build

# The built files will be in client/dist
# Copy them to server/public for the Express server to serve
cp -r client/dist/* server/public/

# Start the server
cd server && npm start
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/)
- Backend powered by [Express.js](https://expressjs.com/)
- Icons and UI inspiration from various open-source file managers

```bash
# Build client assets
cd client && npm run build

# Copy the dist folder into the server's public directory
cp -r dist ../server/public

# Install prod dependencies and start
cd ../server
npm install --production
NODE_ENV=production ROOT_DIRECTORY=/path/to/folder node src/server.js
```

The Express server will detect `server/public` and serve the static assets alongside the API. When auth is enabled, remember to export `EXPLORER_USERNAME`, `EXPLORER_PASSWORD`, and `SESSION_SECRET` before launching the server.
