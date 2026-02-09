#!/bin/bash
set -e

echo "Starting deployment..."
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

# Install dependencies
echo "Installing dependencies..."
npm install --ignore-scripts

# Build the app
echo "Building Next.js application..."
npm run build

# Copy built files to deployment directory
if [ -n "$DEPLOYMENT_TARGET" ]; then
  echo "Copying files to deployment directory..."
  mkdir -p $DEPLOYMENT_TARGET

  # Copy standalone server files
  cp -r .next/standalone/* $DEPLOYMENT_TARGET/

  # Copy static assets
  mkdir -p $DEPLOYMENT_TARGET/.next
  cp -r .next/static $DEPLOYMENT_TARGET/.next/

  # Copy public folder
  cp -r public $DEPLOYMENT_TARGET/

  # Optional: copy config files
  cp next.config.mjs $DEPLOYMENT_TARGET/
fi

echo "Deployment complete!"