@echo off
setlocal

pyinstaller --onefile --name PixelMonsterQuest --add-data "public;public" --add-data "data;data" desktop_app.py

echo.
echo Build completed. Run dist\PixelMonsterQuest.exe
pause
