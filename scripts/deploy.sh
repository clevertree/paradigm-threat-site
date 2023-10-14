#!/bin/bash

echo "Compiling NextJs"
npm run build || exit;

echo "Running tests"
npm run start &
CYPRESS_BASE_URL=http://localhost:8081 npx cypress run --e2e || exit;
npx cypress run --component || exit;

echo "Deploying to server"
ssh ari@paradigmthreat.net << EOF
cd /var/www/paradigm-threat-site;
#git stash;
git pull || exit;
#git reset --hard origin/master;
git submodule update || exit;
#git submodule update --init --recursive;
#git submodule foreach git reset --hard;
yarn install;

pm2 stop "Paradigm Threat Server";

free -h;
npm run build || exit;

pm2 restart "Paradigm Threat Server";

echo "Running tests";
CYPRESS_BASE_URL=https://paradigmthreat.net npx cypress run --e2e || exit;
npx cypress run --component;
echo "Deploy complete";
EOF
