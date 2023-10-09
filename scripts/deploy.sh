#!/bin/bash

echo "Compiling NextJs"
npm run build || exit;

echo "Running tests"
npm run start &
CYPRESS_BASE_URL=http://localhost:8081 npx cypress run || exit;

echo "Deploying to server"
ssh ari@paradigmthreat.net << EOF
cd /var/www/paradigm-threat-site;
#git stash;
git pull;
#git reset --hard origin/master;
git submodule update --init --recursive;
git submodule foreach git reset --hard;
yarn install;

pm2 stop "Paradigm Threat Server"

npm run build;

pm2 restart "Paradigm Threat Server"

echo "Running tests"
CYPRESS_BASE_URL=https://paradigmthreat.net npx cypress run || exit;

EOF
