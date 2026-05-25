# ⚡ Quick Start Guide

Get your Houston City Roleplay moderation bot running in 5 minutes!

## 📋 Prerequisites Checklist

- ✅ Node.js installed (v18+) - [Download](https://nodejs.org/)
- ✅ Discord Server (where you're admin)
- ✅ Discord Developer Portal access

---

## 🎯 5-Step Setup

### Step 1: Create Discord Bot (2 minutes)

1. Go to https://discord.com/developers/applications
2. Click **"New Application"** → Name it **"Houston City Roleplay Bot"**
3. Go to **"Bot"** tab → Click **"Add Bot"**
4. Under **"TOKEN"** → Click **"Copy"** → **SAVE THIS!** 🔑
5. Enable these intents:
   - ✅ Message Content Intent
   - ✅ Server Members Intent

---

### Step 2: Invite Bot to Server (1 minute)

1. In Developer Portal → Go to **"OAuth2"** → **"URL Generator"**
2. Select scope: **`bot`**
3. Select permissions:
   - Send Messages
   - Embed Links
   - Manage Messages
   - Timeout Members
   - Kick Members
   - Ban Members
   - Manage Nicknames
   - Manage Roles
4. Copy the generated URL → Paste in browser → **Invite to server**

---

### Step 3: Get Your Discord IDs (1 minute)

1. In Discord, enable **Developer Mode** (User Settings → Advanced → Developer Mode)
2. Right-click your **server** → **Copy Server ID** → Save as `GUILD_ID`
3. Right-click a **role** → **Copy Role ID** → Save as role IDs
4. Right-click a **channel** → **Copy Channel ID** → Save as channel IDs

You need:
- **Application/Bot Client ID**
- **Guild ID** (Server ID)
- **Admin Role ID**
- **Moderator Role ID**
- **Log Channel ID** (where moderation actions log)
- **Server Admin Role ID** (for startup/shutdown)

---

### Step 4: Install & Configure (1 minute)

```bash
# Navigate to bot folder
cd "Bot testing discord"

# Install dependencies
npm install

# Run interactive setup
node setup.js
```

Follow the prompts and enter your bot token + IDs.

---

### Step 5: Deploy & Start (30 seconds)

```bash
# Register commands with Discord
node deploy-commands.js

# Start the bot!
npm start
```

You should see:
```
✅ Bot logged in as YourBotName#0000
```

---

## 🎉 Done!

Your bot is now running! Try `/help` in Discord.

---

## 🚀 First Commands to Try

```
/serverstatus      - Check server info
/help              - See all commands
```

---

## ❌ Having Issues?

### Bot doesn't respond to `/` commands
- Wait 1 minute for Discord to sync
- Run `node deploy-commands.js` again
- Reload Discord (Ctrl+R)

### "Missing Permissions" error
- Give bot the required roles
- Ensure bot role is **above** user roles
- Check bot has "Manage Roles" permission

### Bot won't start
- Check your `.env` file exists
- Verify DISCORD_TOKEN is correct
- Run `npm install` again

### Still stuck?
- Read [README.md](README.md) for detailed troubleshooting
- Check Discord bot permissions
- Verify all IDs are correct

---

## 📝 Bot Token Safety

⚠️ **IMPORTANT:**
- Never share your bot token
- Never commit `.env` to Git
- If token leaked, regenerate in Developer Portal

---

## 📚 What's Included?

- ✅ 8 Moderation commands (warn, kick, ban, mute, nickname, say, etc.)
- ✅ 2 Promotion commands (promote, demote)
- ✅ 4 Server commands (vote, startup, shutdown, status)
- ✅ Automatic warning system
- ✅ Moderation logging
- ✅ Help command

---

## 🎮 Next Steps

1. **Customize roles** in your Discord server
2. **Test commands** with trusted users
3. **Check logs** in your moderation channel
4. **Explore advanced features** in `ADVANCED_FEATURES.md`

---

Enjoy your new bot! 🎉
