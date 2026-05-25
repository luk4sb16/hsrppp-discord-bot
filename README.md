# 🤖 Houston City Roleplay Discord Bot

A powerful Discord moderation bot designed for Houston City Roleplay with promotions, warnings system, and server control features.

## ✨ Features

### ⚖️ Moderation System
- **Warn System** - Issue warnings to users with auto-kick after 3 warnings
- **Kick** - Remove users from the server
- **Ban** - Permanently ban users
- **Mute/Timeout** - Timeout users for specified duration
- **Warning Management** - Remove/check warnings
- **Moderation Logs** - All actions logged to designated channel

### 🎖️ Promotion System
- **Promote Users** - Add promotional roles (Staff, VIP, etc.)
- **Demote Users** - Remove roles from users
- **Role Management** - Easy role assignment

### 🖥️ Server Management
- **Startup** - Initialize server with startup sequence
- **Shutdown** - Graceful server shutdown
- **Status** - Check server status and member count

---

## 🚀 Setup Guide

### Prerequisites
- Node.js 18 or higher
- Discord Bot (created at [Discord Developer Portal](https://discord.com/developers/applications))

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Name it "Houston City Roleplay Bot" (or your choice)
4. Go to **Bot** tab → Click **Add Bot**
5. Under **TOKEN**, click **Copy** → Save this safely ⚠️
6. Enable these **Intents**:
   - Message Content Intent
   - Server Members Intent
   - Guild Messages

7. Go to **OAuth2** → **URL Generator**
8. Select scopes:
   - `bot`
9. Select permissions:
   - Send Messages
   - Embed Links
   - Manage Messages
   - Timeout Members
   - Kick Members
   - Ban Members
   - Manage Nicknames
   - Manage Roles
   - View Channels

10. Copy the generated URL and invite bot to your server

### Step 3: Configure Environment

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file with your values:**
   ```
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_ID=123456789012345678
   GUILD_IDS=123456789012345678
   ADMIN_ROLE_ID=123456789012345678
   MODERATOR_ROLE_ID=123456789012345678
   LOG_CHANNEL_ID=123456789012345678
   SERVER_ADMIN_ROLE_ID=123456789012345678
   MAX_WARNINGS=3
   MUTE_DURATION=15
   ```

### Step 4: Get Your IDs

Right-click on your server/role/channel and select **Copy User/Channel/Role ID** (enable Developer Mode in Discord Settings first)

**What you need:**
- **DISCORD_TOKEN**: Bot token from Developer Portal
- **DISCORD_ID**: Application ID from Developer Portal
- **GUILD_IDS**: Your Discord server ID
- **ADMIN_ROLE_ID**: Role for admins (can use moderation commands)
- **MODERATOR_ROLE_ID**: Role for moderators
- **LOG_CHANNEL_ID**: Channel for moderation logs
- **SERVER_ADMIN_ROLE_ID**: Role for server startup/shutdown access

### Step 5: Deploy Commands

```bash
node deploy-commands.js
```

You should see: `✅ Commands registered successfully!`

### Step 6: Start the Bot

```bash
npm start
```

You should see: `✅ Bot logged in as YourBotName#0000`

---

## 📋 Commands

### Moderation
| Command | Usage | Example |
|---------|-------|---------|
| `/warn` | Warn a user with a required public reason | `/warn user:@John reason:Spamming` |
| `/kick` | Kick a user with a required public reason | `/kick user:@John reason:Harassment` |
| `/ban` | Ban a user with a required public reason | `/ban user:@John reason:Breaking rules` |
| `/mute` | Timeout a user with a required public reason | `/mute user:@John reason:Spam duration:30` |
| `/remove-warning` | Remove warnings with a required public reason | `/remove-warning user:@John reason:Appeal accepted amount:1` |
| `/nickname` | Change a user nickname | `/nickname user:@John nickname:Officer John` |
| `/say` | Make the bot send a message | `/say message:Session starts now` |
| `/warnings` | Check warnings | `/warnings user:@John` |

### Promotions
| Command | Usage | Example |
|---------|-------|---------|
| `/promote` | Add role to user with a required public reason | `/promote user:@John role:@Staff reason:Passed training` |
| `/demote` | Remove role from user with a required public reason | `/demote user:@John role:@Staff reason:Failed activity check` |

### Server Management
| Command | Usage |
|---------|-------|
| `/startup` | Start the game server |
| `/shutdown` | Shutdown the game server |
| `/serverstatus` | Check server status |
| `/erlc-status` | Test the ERLC API link |
| `/erlc-command` | Run an ERLC in-game command | `/erlc-command command::h Session starting` |
| `/vote` | Start a session vote and ping Session Ping | `/vote votes:5` |

### Info
| Command | Usage |
|---------|-------|
| `/help` | Show all commands |

---

## ⚙️ Configuration File

Edit `config.json` to customize:
- Bot name and version
- Moderation features list
- Required permissions
- Auto-kick limits

---

## 📝 Moderation Logs

All moderation actions are logged to your designated log channel:
- User warns
- Kicks
- Bans
- Mutes
- Server startup/shutdown

---

## 🔧 Troubleshooting

### Bot not responding to commands
- Ensure commands are registered: `node deploy-commands.js`
- Check bot has proper permissions in the channel
- Verify GUILD_IDS matches your server ID

### "Missing Permissions" error
- Give bot the required roles in Discord
- Ensure bot role is positioned above user roles
- Check bot has "Manage Roles" permission

### Commands not showing up
- Wait 1 minute for Discord to sync
- Reload Discord (Ctrl+R)
- Run deploy-commands.js again

### Bot crashes on startup
- Check DISCORD_TOKEN is valid
- Verify .env file has DISCORD_TOKEN
- Check node version: `node --version` (should be 18+)

---

## 🛡️ Security Notes

- ⚠️ **Never share your DISCORD_TOKEN** - anyone with it can control your bot
- Keep `.env` file private (never commit to git)
- The `.env.example` file is safe to commit for reference

---

## 📦 Dependencies

- **discord.js** v14.13.0 - Discord API wrapper
- **dotenv** v16.3.1 - Environment variable management

---

## 📄 License

ISC

---

## 🆘 Support

For issues or questions:
1. Check troubleshooting section
2. Review Discord bot permissions
3. Ensure all environment variables are set correctly
4. Check bot token is valid

---

**Made for Houston City Roleplay** 🎮
