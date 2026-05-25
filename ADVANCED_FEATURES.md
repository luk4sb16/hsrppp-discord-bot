# Advanced Features & Extensions

This file contains ideas and code snippets for extending your Houston City Roleplay moderation bot.

## 🚀 Planned Features

### 1. **Database Integration**
Store warnings, bans, and moderation history in MongoDB or SQLite

### 2. **Appeal System**
Allow banned/warned users to appeal through a form

### 3. **Auto-Moderation**
- Auto-filter swearing/spam
- Link detection
- Rate limiting

### 4. **Advanced Statistics**
- Moderation dashboard
- User activity tracking
- Ban/kick statistics

### 5. **Custom Commands**
- Admin-defined custom prefix commands
- Tags system
- Reaction roles

### 6. **Logging Enhancements**
- User join/leave logs
- Message deletion logs
- Role change logs
- Channel creation/deletion logs

### 7. **Case System**
- Track moderation cases by ID
- Edit/delete moderation actions
- Case history per user

### 8. **Ticket System**
- Support tickets
- Moderation appeals
- Bug reports

### 9. **Economy System**
- User points/currency
- Shop/store
- Rewards for good behavior

### 10. **Announcements**
- Scheduled announcements
- Pin system
- News channel

---

## 💡 Sample Extension: Case System

### Add Case Tracking
```javascript
// In bot.js, add this at the top
const cases = {};
let caseCounter = 1;

function createCase(guild, user, moderator, action, reason) {
  const caseId = caseCounter++;
  const caseData = {
    id: caseId,
    userId: user.id,
    username: user.tag,
    moderator: moderator.tag,
    action,
    reason,
    timestamp: new Date(),
    guild: guild.id,
  };
  
  cases[caseId] = caseData;
  return caseId;
}

// Then in moderation commands, call:
const caseId = createCase(guild, targetUser, user, 'WARN', reason);
// Include in response: `Case #${caseId}`
```

### View Cases
```javascript
else if (commandName === 'case') {
  const caseId = interaction.options.getInteger('case');
  const caseData = cases[caseId];
  
  if (!caseData) {
    return interaction.reply({ content: '❌ Case not found!', ephemeral: true });
  }
  
  const embed = createEmbed(
    `Case #${caseId}`,
    `**User:** ${caseData.username}\n**Action:** ${caseData.action}\n**Moderator:** ${caseData.moderator}\n**Reason:** ${caseData.reason}\n**Date:** ${caseData.timestamp.toLocaleString()}`,
    0x3498db
  );
  
  await interaction.reply({ embeds: [embed] });
}
```

---

## 💡 Sample Extension: Auto-Moderation

### Add Auto-Spam Filter
```javascript
const spamFilter = {
  enabled: true,
  maxMessages: 5,
  timeframe: 5000, // 5 seconds
  userMessages: {},
};

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  
  const userId = message.author.id;
  const now = Date.now();
  
  if (!spamFilter.userMessages[userId]) {
    spamFilter.userMessages[userId] = [];
  }
  
  spamFilter.userMessages[userId].push(now);
  spamFilter.userMessages[userId] = spamFilter.userMessages[userId].filter(
    (timestamp) => now - timestamp < spamFilter.timeframe
  );
  
  if (spamFilter.userMessages[userId].length > spamFilter.maxMessages) {
    message.delete();
    message.author.send('🚫 Stop spamming!').catch(() => {});
  }
});
```

---

## 💡 Sample Extension: User Stats

### Track User Moderation History
```javascript
const userStats = {};

function addUserStat(userId, guildId, action) {
  const key = `${guildId}-${userId}`;
  if (!userStats[key]) {
    userStats[key] = {
      warns: 0,
      kicks: 0,
      bans: 0,
      mutes: 0,
    };
  }
  userStats[key][action.toLowerCase()]++;
}

// Then in commands:
else if (commandName === 'userstats') {
  const targetUser = interaction.options.getUser('user');
  const key = `${guild.id}-${targetUser.id}`;
  const stats = userStats[key] || { warns: 0, kicks: 0, bans: 0, mutes: 0 };
  
  const embed = createEmbed(
    'User Moderation Stats',
    `**${targetUser.tag}**\n\nWarnings: ${stats.warns}\nKicks: ${stats.kicks}\nBans: ${stats.bans}\nMutes: ${stats.mutes}`,
    0x3498db
  );
  
  await interaction.reply({ embeds: [embed] });
}
```

---

## 📚 Resources

- [discord.js Documentation](https://discord.js.org/)
- [Discord API Docs](https://discord.com/developers/docs)
- [Node.js Documentation](https://nodejs.org/docs/)

---

## 🎯 Implementation Tips

1. **Start Small** - Implement one feature at a time
2. **Test Thoroughly** - Test all edge cases
3. **Error Handling** - Add try-catch blocks
4. **Logging** - Log important events
5. **Database** - Consider using SQLite or MongoDB for persistence
6. **Security** - Never expose tokens or sensitive data

---

Feel free to implement any of these features!
