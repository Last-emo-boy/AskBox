# AskBox Android

原生 Android 客户端，使用 Kotlin + Jetpack Compose 构建。

## 技术栈

- **语言**: Kotlin 2.0
- **UI**: Jetpack Compose + Material 3
- **架构**: MVVM + Repository Pattern
- **依赖注入**: Hilt
- **网络**: Retrofit + Kotlin Serialization
- **本地存储**: DataStore Preferences
- **加密**: Lazysodium (libsodium Android binding)
- **导航**: Navigation Compose

## 功能

- ✅ 创建/导入账户
- ✅ 密码保护种子短语
- ✅ 创建和管理提问箱
- ✅ 查看和回答问题
- ✅ 端到端加密提问
- ✅ 回执管理（查看私密回答）
- ✅ 账户管理（导出种子、删除账户）
- ✅ Deep Link 支持

## 构建

### 前置要求

- Android Studio Ladybug (2024.2.1) 或更高版本
- JDK 17
- Android SDK 35

### 步骤

1. 用 Android Studio 打开 `apps/android` 目录
2. 等待 Gradle 同步完成
3. 运行 `app` 配置

### 构建 Release APK

```bash
cd apps/android
./gradlew assembleRelease
```

APK 输出位置: `app/build/outputs/apk/release/app-release.apk`

## 项目结构

```
app/src/main/java/xyz/askbox/app/
├── AskBoxApplication.kt    # Application 入口
├── MainActivity.kt         # 主 Activity
├── crypto/
│   └── CryptoManager.kt    # 加密操作
├── data/
│   ├── local/
│   │   ├── AccountStorage.kt   # 账户本地存储
│   │   └── ReceiptStorage.kt   # 回执本地存储
│   ├── remote/
│   │   └── AskBoxApi.kt        # API 接口定义
│   └── repository/
│       └── AskBoxRepository.kt # 数据仓库
├── di/
│   └── NetworkModule.kt    # Hilt 网络模块
└── ui/
    ├── Navigation.kt       # 导航配置
    ├── MainViewModel.kt    # 主 ViewModel
    ├── theme/              # Material 3 主题
    └── screens/            # 各个页面
        ├── HomeScreen.kt
        ├── CreateAccountScreen.kt
        ├── ImportAccountScreen.kt
        ├── LoginScreen.kt
        ├── DashboardScreen.kt
        ├── BoxesScreen.kt
        ├── QuestionsScreen.kt
        ├── AskQuestionScreen.kt
        ├── ReceiptsScreen.kt
        └── AccountScreen.kt
```

## 配置

API 地址在 `app/build.gradle.kts` 中配置：

```kotlin
buildConfigField("String", "API_BASE_URL", "\"https://askbox.w33d.xyz/api/v1/\"")
```

## 加密兼容性

Android 客户端使用 Lazysodium，与 Web 端的 libsodium-wrappers 完全兼容：

- Ed25519 签名密钥派生
- X25519 加密密钥派生
- Sealed Box 匿名加密
- Envelope Encryption 多方加密
- Argon2id 密码派生
