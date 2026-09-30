@echo off
chcp 65001 > nul
title DaDuino + Kendryte K210 Simulator

echo =======================================================
echo    Запуск симулятора DaDuino + Kendryte K210
echo    Кейс «Motion. Камера вместо джойстика»
echo =======================================================
echo.

if not exist node_modules (
    echo [INFO] Установка зависимостей (npm install)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Не удалось установить зависимости. Убедитесь, что Node.js установлен.
        pause
        exit /b 1
    )
)

echo [INFO] Запуск локального сервера разработки...
start http://localhost:3000/
call npm run dev

pause
