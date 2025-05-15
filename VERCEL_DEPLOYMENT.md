# Vercel Deployment Guide for WatchTugV2

This guide will help you deploy your WatchTugV2 application on Vercel.

## Pre-deployment Preparation

1. Make sure your project has the following files:
   - `vercel.json`: Contains configuration for Vercel deployment
   - `package.json`: Contains scripts including build command
   - `server.js`: Your Express server

2. Ensure your project is pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Option 1: Using Vercel CLI

1. Install Vercel CLI globally:
   ```
   npm install -g vercel
   ```

2. Log in to your Vercel account:
   ```
   vercel login
   ```

3. Navigate to your project directory and run:
   ```
   vercel
   ```

4. Follow the prompts to complete the deployment.

### Option 2: Using Vercel Web Interface

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." and select "Project"
3. Import your Git repository
4. Configure the project with the following settings:
   - Build Command: `npm run build`
   - Output Directory: `public` (default)
   - Install Command: `npm install`
5. Click "Deploy"

## Environment Variables

If you need to add environment variables, you can do so in the Vercel dashboard under Project Settings > Environment Variables.

## Monitoring Your Deployment

After deployment, you can monitor your application's performance, logs, and metrics from the Vercel dashboard.

## Troubleshooting

- If your deployment fails, check the build logs in the Vercel dashboard
- Ensure that your `vercel.json` configuration is correct
- Verify that your server listens on the port provided by the environment variable

## Important Notes for WebRTC Applications

Since WatchTugV2 is a WebRTC application:

1. Make sure your application is served over HTTPS (Vercel provides this by default)
2. For production use, consider adding TURN server configuration to handle NAT traversal in restricted networks
3. Socket.io connections might need additional configuration in some deployment scenarios

## Need Help?

If you encounter any issues during deployment, check the [Vercel documentation](https://vercel.com/docs) or contact Vercel support. 