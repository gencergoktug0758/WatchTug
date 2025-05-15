@echo off
echo WatchTugV2 Vercel Deployment Preparation
echo =====================================
echo.

rem Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Git is not installed. Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

rem Check if vercel CLI is installed
where vercel >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Vercel CLI is not installed. Installing now...
    npm install -g vercel
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install Vercel CLI. Please run 'npm install -g vercel' manually.
        pause
        exit /b 1
    )
)

echo All requirements satisfied.
echo.

rem Checking for changes
git diff --quiet --exit-code
if %ERRORLEVEL% NEQ 0 (
    echo There are uncommitted changes. Do you want to commit them before deployment? (Y/N)
    set /p COMMIT_CHOICE=
    if /i "%COMMIT_CHOICE%"=="Y" (
        echo Enter commit message:
        set /p COMMIT_MSG=
        git add .
        git commit -m "%COMMIT_MSG%"
        echo Changes committed successfully.
    ) else (
        echo Proceeding without committing changes.
    )
)

echo.
echo Ready to deploy! Choose your deployment method:
echo 1. Use Vercel CLI (recommended)
echo 2. Use Vercel Dashboard (web interface)
echo.
set /p DEPLOY_CHOICE=Enter your choice (1 or 2): 

if "%DEPLOY_CHOICE%"=="1" (
    echo.
    echo Starting Vercel CLI deployment...
    echo You may need to login if you haven't already.
    echo.
    vercel
) else if "%DEPLOY_CHOICE%"=="2" (
    echo.
    echo Please follow these steps:
    echo 1. Go to https://vercel.com/dashboard
    echo 2. Click "Add New..." and select "Project"
    echo 3. Import your Git repository
    echo 4. Configure with the settings from VERCEL_DEPLOYMENT.md
    echo 5. Click "Deploy"
    echo.
    echo Opening Vercel dashboard in your browser...
    start https://vercel.com/dashboard
) else (
    echo Invalid choice. Please run the script again.
)

echo.
echo Deployment preparation complete!
pause 