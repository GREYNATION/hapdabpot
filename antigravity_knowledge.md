# 🧠 Antigravity Knowledge Base
*Lessons learned and fixes applied.*

### 🛠️ Fix Log - May 2, 2026

#### 1. Supabase Null Reference Guards
- **Issue**: `getSupabase()` can return `null`, causing crashes when calling `.from()`.
- **Fix**: Implemented a private `db` getter in services.
- **Lesson**: Always wrap global service clients in a getter to provide clear error messages and type safety.

#### 2. ComfyUI Private Property Access
- **Issue**: Attempting to access `comfyAgent["comfyClient"]` failed because the property was private.
- **Fix**: Switched to a direct dynamic import of `comfyClient` in the command handler.
- **Lesson**: Don't reach into other agents' private states; use shared service instances or public APIs.

#### 3. Pandoc PDF Limitations
- **Issue**: Pandoc cannot convert *from* PDF natively on Windows.
- **Fix**: Created `scripts/pdf-to-md.ts` using the `pdf-parse` library.
- **Lesson**: For PDF extraction, Node-native libraries are more reliable than external CLI tools like Pandoc.

#### 4. Container Environment Isolation (.env)
- **Issue**: Docker containers on Railway often skip the `.env` file unless explicitly copied, leading to missing `SKIP_DB_CONFIG` flags.
- **Fix**: Updated `Dockerfile` to explicitly `COPY` the `.env` file into the runtime stage.
- **Lesson**: Never assume `.env` exists in a container; always prefer platform dashboard variables or explicitly include the file.

#### 5. Supabase "Legacy API Key" Failure
- **Issue**: Expired or rotated Supabase keys cause `PostgREST` to return "Legacy API keys are disabled", crashing the startup.
- **Fix**: Wrapped the config fetch in a `.catch()` and added a non-fatal fallback.
- **Lesson**: External configuration fetches should be advisory, not blocking. Always provide a local fallback.

#### 6. Duplicate Service Initialization during Polling Retries
- **Issue**: Services like `DealWatcher` were being initialized inside the Telegram `launch()` method, causing multiple instances to spawn during 409 Conflict retry loops.
- **Fix**: Moved service initializations to the `TelegramBot` constructor to guarantee a single instance.
- **Lesson**: Keep the bot's `launch/polling` logic pure; only include reconnection logic there, not service setup.
