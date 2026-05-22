@echo off
title Egg Counter Local Server
color 0A

echo =========================================
echo INITIALIZING MULTI-CAM EGG MONITOR...
echo =========================================

:: Change directory to your exact project folder
cd /d "C:\Users\miggy\Desktop\Egg Counter py+GUI"

:: Run the server
python server.py

:: If the server crashes, this keeps the window open so you can read the error
pause