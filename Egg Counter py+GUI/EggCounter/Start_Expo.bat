@echo off
title Expo Frontend Server
color 0D

echo =========================================
echo BOOTING MULTI-CAM DASHBOARD (EXPO)...
echo =========================================

:: Change directory to your exact project folder
:: (Update this path if your Expo frontend is in a different folder than your Python server)
cd /d "C:\Users\miggy\Desktop\Egg Counter py+GUI\EggCounter"

:: Start Expo with the clear-cache flag to prevent ghost UI issues
npx expo start -c

pause