#!/bin/bash
set -e

echo "Starting deployment..."
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the app
echo "Building Next.js application..."
npm run build

# Copy built files to deployment directory
if [ -n "$DEPLOYMENT_TARGET" ]; then
  echo "Copying files to deployment directory..."
  mkdir -p $DEPLOYMENT_TARGET
  cp -r .next/standalone/* $DEPLOYMENT_TARGET/
  cp -r public $DEPLOYMENT_TARGET/
  cp -r .next/static $DEPLOYMENT_TARGET/.next/
  cp next.config.mjs $DEPLOYMENT_TARGET/
fi

echo "Deployment complete!"