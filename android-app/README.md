# FileVue Android Companion App

A native Android app that connects to your FileVue server for mobile file browsing and management.

## Features

- 📱 **Native Android Experience** - Material Design 3 UI
- 🔗 **Server Connection** - Connect to any FileVue server instance
- 🔐 **Secure Authentication** - JWT-based login with encrypted token storage
- 📂 **File Browsing** - Navigate directories with smooth scrolling
- 👁️ **File Previews** - View text and image files inline
- 📥 **Download Files** - Download files to your device
- ✏️ **File Operations** - Create folders and files (when not in read-only mode)
- 🗑️ **Delete Files** - Remove files and folders with confirmation
- 🔍 **Search** - Search for files within directories

## Requirements

- Android 8.0 (API 26) or higher
- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17

## Building

### Using Android Studio

1. Open the `android-app` folder in Android Studio
2. Wait for Gradle sync to complete
3. Click **Run** or press `Shift + F10`

### Using Command Line

```bash
cd android-app

# Debug build
./gradlew assembleDebug

# Release build (requires signing configuration)
./gradlew assembleRelease
```

The APK will be generated in `app/build/outputs/apk/`.

## Setup

1. Install the app on your Android device
2. Enter your FileVue server URL (e.g., `http://192.168.1.100:8080`)
3. Tap **Connect** to verify the connection
4. If authentication is enabled, enter your username and password
5. Start browsing your files!

## Architecture

The app follows modern Android development best practices:

- **MVVM Architecture** with ViewModels and LiveData
- **Repository Pattern** for data operations
- **Retrofit** for REST API communication
- **Kotlin Coroutines** for asynchronous operations
- **View Binding** for type-safe view access
- **Encrypted SharedPreferences** for secure token storage

## Project Structure

```
app/src/main/java/com/filevue/app/
├── api/                 # API client and service
│   ├── ApiClient.kt
│   └── FileVueApiService.kt
├── data/                # Data models and repository
│   ├── Models.kt
│   └── FileVueRepository.kt
├── ui/                  # UI components
│   ├── MainActivity.kt
│   ├── auth/           # Authentication
│   ├── browser/        # File browser
│   └── preview/        # File preview
└── util/               # Utilities
    ├── FileUtils.kt
    └── SecureStorage.kt
```

## Security

- Authentication tokens are stored in Android's EncryptedSharedPreferences
- HTTPS is supported (configure `network_security_config.xml` for production)
- Cleartext traffic is allowed for development; restrict in production

## Configuration

### Network Security

For production use, update `res/xml/network_security_config.xml` to restrict cleartext traffic:

```xml
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">your-domain.com</domain>
    </domain-config>
</network-security-config>
```

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file in the parent directory for details.
