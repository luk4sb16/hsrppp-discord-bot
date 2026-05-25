const { REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const commands = [
  // Moderation
  {
    name: 'warn',
    description: 'Warn a user',
    options: [
      {
        name: 'user',
        description: 'The user to warn',
        type: 6,
        required: true,
      },
      {
        name: 'reason',
        description: 'Reason for warning',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'kick',
    description: 'Kick a user from the server',
    options: [
      {
        name: 'user',
        description: 'The user to kick',
        type: 6,
        required: true,
      },
      {
        name: 'reason',
        description: 'Reason for kick',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'ban',
    description: 'Ban a user from the server',
    options: [
      {
        name: 'user',
        description: 'The user to ban',
        type: 6,
        required: true,
      },
      {
        name: 'reason',
        description: 'Reason for ban',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'mute',
    description: 'Timeout/mute a user',
    options: [
      {
        name: 'user',
        description: 'The user to mute',
        type: 6,
        required: true,
      },
      {
        name: 'reason',
        description: 'Reason for mute',
        type: 3,
        required: true,
      },
      {
        name: 'duration',
        description: 'Duration in minutes (default: 15)',
        type: 4,
        required: false,
      },
    ],
  },
  {
    name: 'remove-warning',
    description: 'Remove warnings from a user',
    options: [
      {
        name: 'user',
        description: 'The user whose warnings should be removed',
        type: 6,
        required: true,
      },
      {
        name: 'reason',
        description: 'Reason for removing warnings',
        type: 3,
        required: true,
      },
      {
        name: 'amount',
        description: 'Number of warnings to remove (default: 1)',
        type: 4,
        required: false,
      },
    ],
  },
  {
    name: 'warnings',
    description: 'Check how many warnings a user has',
    options: [
      {
        name: 'user',
        description: 'The user to check',
        type: 6,
        required: true,
      },
    ],
  },
  {
    name: 'nickname',
    description: 'Change a user nickname',
    options: [
      {
        name: 'user',
        description: 'The user whose nickname should be changed',
        type: 6,
        required: true,
      },
      {
        name: 'nickname',
        description: 'The new nickname',
        type: 3,
        required: true,
        max_length: 32,
      },
    ],
  },
  {
    name: 'say',
    description: 'Make the bot send a message',
    options: [
      {
        name: 'message',
        description: 'The message for the bot to send',
        type: 3,
        required: true,
        max_length: 2000,
      },
    ],
  },
  // Promotions
  {
    name: 'promote',
    description: 'Promote a user (add a role)',
    options: [
      {
        name: 'user',
        description: 'The user to promote',
        type: 6,
        required: true,
      },
      {
        name: 'role',
        description: 'The role to add',
        type: 8,
        required: true,
      },
      {
        name: 'reason',
        description: 'Reason for promotion',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'demote',
    description: 'Demote a user (remove a role)',
    options: [
      {
        name: 'user',
        description: 'The user to demote',
        type: 6,
        required: true,
      },
      {
        name: 'role',
        description: 'The role to remove',
        type: 8,
        required: true,
      },
      {
        name: 'reason',
        description: 'Reason for demotion',
        type: 3,
        required: true,
      },
    ],
  },
  // Server
  {
    name: 'startup',
    description: 'Startup the game server',
  },
  {
    name: 'shutdown',
    description: 'Shutdown the game server',
  },
  {
    name: 'serverstatus',
    description: 'Check the server status',
  },
  {
    name: 'erlc-status',
    description: 'Test the ERLC API link and view server info',
  },
  {
    name: 'erlc-command',
    description: 'Run an in-game ERLC server command',
    options: [
      {
        name: 'command',
        description: 'The in-game command to run, for example :h Session starting',
        type: 3,
        required: true,
        max_length: 500,
      },
    ],
  },
  {
    name: 'vote',
    description: 'Start a session vote',
    options: [
      {
        name: 'votes',
        description: 'How many yes votes are needed to start the session',
        type: 4,
        required: true,
        min_value: 1,
      },
      {
        name: 'ping',
        description: 'The session ping role to mention',
        type: 8,
        required: false,
      },
    ],
  },
  // Info
  {
    name: 'help',
    description: 'Show all available commands',
  },
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.DISCORD_ID) {
      throw new Error('Missing DISCORD_ID in .env. Add your Discord application/client ID before deploying commands.');
    }

    const guildIds = process.env.GUILD_IDS.split(',').map(id => id.trim());
    
    console.log('🔄 Registering slash commands...');

    for (const guildId of guildIds) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_ID, guildId),
        { body: commands }
      );
      console.log(`✅ Commands registered for guild: ${guildId}`);
    }

    console.log('✅ All commands registered successfully!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    process.exit(1);
  }
})();
