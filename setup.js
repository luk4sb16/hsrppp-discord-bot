#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('\nHouston City Roleplay Bot - Setup Wizard\n');
  console.log('This wizard will help you configure your Discord bot.\n');

  const token = await question('Enter your Discord Bot Token: ');
  const discordId = await question('Enter your Discord Application/Bot Client ID: ');
  const guildId = await question('Enter your Guild/Server ID: ');
  const adminRoleId = await question('Enter Admin Role ID: ');
  const modRoleId = await question('Enter Moderator Role ID: ');
  const logChannelId = await question('Enter Moderation Log Channel ID: ');
  const serverAdminRoleId = await question('Enter Server Admin Role ID: ');
  const maxWarnings = await question('Max warnings before auto-kick (default 3): ') || '3';
  const muteDuration = await question('Default mute duration in minutes (default 15): ') || '15';

  const envContent = `# Discord Bot Token
DISCORD_TOKEN=${token}

# Discord Application/Bot Client ID
DISCORD_ID=${discordId}

# Guild IDs (Server IDs) - comma separated for multiple servers
GUILD_IDS=${guildId}

# Admin Role ID - users with this role can use moderation commands
ADMIN_ROLE_ID=${adminRoleId}

# Moderator Role ID
MODERATOR_ROLE_ID=${modRoleId}

# Moderation Log Channel ID - where moderation actions are logged
LOG_CHANNEL_ID=${logChannelId}

# Server Management Role ID - can startup/shutdown servers
SERVER_ADMIN_ROLE_ID=${serverAdminRoleId}

# Max Warnings before auto-kick
MAX_WARNINGS=${maxWarnings}

# Mute Duration in minutes (for /mute command)
MUTE_DURATION=${muteDuration}
`;

  fs.writeFileSync(path.join(__dirname, '.env'), envContent);

  console.log('\nConfiguration saved to .env file!');
  console.log('\nNext steps:');
  console.log('1. Run: npm install');
  console.log('2. Run: node deploy-commands.js');
  console.log('3. Run: npm start\n');

  rl.close();
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
