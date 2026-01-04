@echo off
set DIRNAME=%~dp0
set GRADLE_WRAPPER_JAR=%DIRNAME%gradle\wrapper\gradle-wrapper.jar

if not exist "%GRADLE_WRAPPER_JAR%" (
    echo Gradle wrapper jar not found!
    exit /b 1
)

java -jar "%GRADLE_WRAPPER_JAR%" %*
