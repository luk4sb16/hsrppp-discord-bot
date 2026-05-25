const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Load configuration
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// In-memory storage for warnings and moderation data
const warnings = {};
const muteData = {};
let erlcAnnouncementIndex = 0;
let erlcAnnouncementTimer = null;
let presenceIndex = 0;
let presenceTimer = null;
let cachedPlayerCount = null;
const dashboardSessions = new Set();
const dashboardPort = Number(process.env.PORT || process.env.DASHBOARD_PORT || 3000);
const dashboardPassword = process.env.DASHBOARD_PASSWORD || 'change-me';
const startedAt = new Date();

const erlcAnnouncements = [
  ':h 🛑If you require assistance please call !mod or !help and If you are reporting somebody please remember to provide evidence!',
  ':M →Houston RP is a immersive RP server which requires you to join the comms! Code is: v6-V5-Np-xd-yG',
  ':h ⛔ You are required to join communications to continue roleplaying code is: v6-V5-Np-xd-yG',
  ':h 😮GTAD Is strictly not allowed and will result in a 30 minute kick! If you rejoin within that period of time when being kicked for GTAD you will be banned.',
  ':M ⛔ You are required to join communications to continue roleplaying code is: v6-V5-Np-xd-yG',
];

// ==================== UTILITY FUNCTIONS ====================

function parseRoleSelectors(value) {
  if (!value) return [];
  return value.split(',').map((token) => token.trim()).filter(Boolean).map((token) => {
    if (token.includes('..')) {
      const [start, end] = token.split('..').map((part) => part.trim());
      return { type: 'range', start, end };
    }
    if (token.includes('-')) {
      const [start, end] = token.split('-').map((part) => part.trim());
      return { type: 'range', start, end };
    }
    return { type: 'id', id: token };
  });
}

function hasRole(member, selectors) {
  const roleCache = member.roles.cache;
  const guildRoles = member.guild.roles.cache;

  return selectors.some((selector) => {
    if (selector.type === 'id') {
      return roleCache.has(selector.id);
    }

    const startRole = guildRoles.get(selector.start);
    const endRole = guildRoles.get(selector.end);
    if (!startRole || !endRole) return false;

    const minPos = Math.min(startRole.position, endRole.position);
    const maxPos = Math.max(startRole.position, endRole.position);
    return roleCache.some((role) => role.position >= minPos && role.position <= maxPos);
  });
}

function hasAdminRole(member) {
  const adminSelectors = parseRoleSelectors(process.env.ADMIN_ROLE_ID);
  const modSelectors = parseRoleSelectors(process.env.MODERATOR_ROLE_ID);
  return hasRole(member, adminSelectors) || hasRole(member, modSelectors) || member.permissions.has('Administrator');
}

function hasOwnerAdminRole(member) {
  const adminSelectors = parseRoleSelectors(process.env.ADMIN_ROLE_ID);
  return hasRole(member, adminSelectors) || member.permissions.has('Administrator');
}

function hasServerAdminRole(member) {
  const serverAdminSelectors = parseRoleSelectors(process.env.SERVER_ADMIN_ROLE_ID);
  return hasRole(member, serverAdminSelectors) || member.permissions.has('Administrator');
}

function createEmbed(title, description, color = 0x3498db) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

function createModerationLog(action, user, moderator, reason) {
  return new EmbedBuilder()
    .setTitle(`⚖️ Moderation Action: ${action}`)
    .addFields(
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Moderator', value: `${moderator.tag}`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: false }
    )
    .setColor(0xff6b6b)
    .setTimestamp();
}

async function logModeration(guild, action, user, moderator, reason) {
  const logChannel = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
  if (!logChannel) return;
  
  const embed = createModerationLog(action, user, moderator, reason);
  await logChannel.send({ embeds: [embed] });
}

async function erlcRequest(path, options = {}) {
  if (!process.env.ERLC_SERVER_KEY) {
    throw new Error('Missing ERLC_SERVER_KEY in .env');
  }

  const response = await fetch(`https://api.erlc.gg/v1${path}`, {
    ...options,
    headers: {
      'server-key': process.env.ERLC_SERVER_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = data.message || data.error || `ERLC API error ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function createErlcStatusEmbed(server) {
  return createEmbed(
    'Houston City Roleplay API Status',
    `API linked successfully.\n\n**Server:** ${server.Name || server.name || 'Unknown'}\n**Owner:** LUK4SB16\n**Players:** ${server.CurrentPlayers ?? server.currentPlayers ?? 'Unknown'}/${server.MaxPlayers ?? server.maxPlayers ?? 'Unknown'}`,
    0x2ecc71
  );
}

function createErlcStatusControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('refresh-erlc-status')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel('Join the ingame Server!')
      .setStyle(ButtonStyle.Link)
      .setURL('https://erlc.gg/join/hsrppp'),
    new ButtonBuilder()
      .setLabel('Join the discord!')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.gg/uyMvmY4gH3')
  );
}

async function sendNextErlcAnnouncement() {
  const command = erlcAnnouncements[erlcAnnouncementIndex];
  erlcAnnouncementIndex = (erlcAnnouncementIndex + 1) % erlcAnnouncements.length;

  try {
    await erlcRequest('/server/command', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
    console.log(`Sent ERLC announcement: ${command}`);
  } catch (error) {
    console.error('Failed to send ERLC announcement:', error.message);
  }
}

function readPlayerCounts(server) {
  return {
    currentPlayers: server.CurrentPlayers ?? server.currentPlayers ?? server.players ?? null,
    maxPlayers: server.MaxPlayers ?? server.maxPlayers ?? null,
  };
}

async function getPlayerCountsForPresence() {
  try {
    const server = await erlcRequest('/server');
    const { currentPlayers, maxPlayers } = readPlayerCounts(server);

    cachedPlayerCount = currentPlayers !== null && maxPlayers !== null
      ? `${currentPlayers}/${maxPlayers} Players`
      : `${currentPlayers ?? 'Unknown'} Players`;

    return {
      currentPlayers: Number(currentPlayers),
      playerCountStatus: cachedPlayerCount,
    };
  } catch (error) {
    console.error('Failed to fetch ERLC player count for presence:', error.message);
  }

  return {
    currentPlayers: null,
    playerCountStatus: cachedPlayerCount || 'Unknown Players',
  };
}

async function updatePresence() {
  const playerCounts = await getPlayerCountsForPresence();

  if (playerCounts.currentPlayers >= 3) {
    client.user.setPresence({
      activities: [{ name: 'Houston City Roleplay', type: ActivityType.Playing }],
      status: 'online',
    });
    return;
  }

  const statuses = [
    () => ({ name: 'Owned by LUK4SB16.', type: ActivityType.Custom }),
    () => ({ name: 'Houston Chat.', type: ActivityType.Watching }),
    () => ({ name: playerCounts.playerCountStatus, type: ActivityType.Watching }),
  ];

  const status = await statuses[presenceIndex]();
  presenceIndex = (presenceIndex + 1) % statuses.length;

  client.user.setPresence({
    activities: [status],
    status: 'online',
  });
}

function getDashboardGuild() {
  const guildId = (process.env.GUILD_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)[0];
  return guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();
}

function getDashboardCookie(req) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((cookie) => {
    const [key, ...value] = cookie.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }));
  return cookies.dashboard_session;
}

function isDashboardAuthed(req) {
  return dashboardSessions.has(getDashboardCookie(req));
}

function sendDashboardJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readDashboardBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function getHealthStatus() {
  const guild = getDashboardGuild();
  return {
    ok: true,
    service: 'houston-city-roleplay-bot',
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: startedAt.toISOString(),
    botReady: client.isReady(),
    botTag: client.user?.tag || null,
    guildConnected: Boolean(guild),
    guildName: guild?.name || null,
  };
}

function getTextChannel(guild, channelId) {
  const channel = guild?.channels.cache.get(channelId);
  if (!channel?.isTextBased?.()) {
    throw new Error('Pick a valid text channel.');
  }
  return channel;
}

async function sendDashboardStartup(channel, actor = 'Dashboard') {
  const embed = createEmbed(
    'Server Startup',
    `Server startup sequence initiated from **${actor}**.\n\nInitializing systems...\nAll systems online`,
    0x3498db
  );
  await channel.send({ embeds: [embed] });
}

async function sendDashboardShutdown(channel, actor = 'Dashboard') {
  const embed = createEmbed(
    'Server Shutdown',
    `Server shutdown sequence initiated from **${actor}**.\n\nSaving data...\nShutdown complete`,
    0xe74c3c
  );
  await channel.send({ embeds: [embed] });
}

async function sendDashboardVote(channel, requiredVotes, pingRoleId) {
  const pingContent = pingRoleId ? `<@&${pingRoleId}>` : undefined;
  const embed = createEmbed(
    'SESSION VOTE',
    `A session vote has been started from the dashboard.\n\nRequired votes: **${requiredVotes}** yes votes.\n\nReact with YES if you want a session.\nReact with NO if you do not want a session.`,
    0x2ecc71
  );

  const voteMessage = await channel.send({
    content: pingContent,
    embeds: [embed],
    allowedMentions: pingRoleId ? { roles: [pingRoleId] } : undefined,
  });
  await voteMessage.react('✅').catch(() => {});
  await voteMessage.react('❌').catch(() => {});
}

function dashboardPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Houston City Roleplay Dashboard</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #111318;
      --panel: #1b2028;
      --panel-2: #242b35;
      --line: #343c49;
      --text: #f2f5f8;
      --muted: #aeb8c4;
      --green: #40d98f;
      --red: #ff6f7d;
      --blue: #55a7ff;
      --yellow: #ffd166;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.45 Arial, Helvetica, sans-serif;
    }
    header {
      border-bottom: 1px solid var(--line);
      background: #171b22;
    }
    .wrap { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; }
    .topbar {
      min-height: 74px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
    }
    h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
    h2 { margin: 0 0 14px; font-size: 16px; letter-spacing: 0; }
    .sub { margin-top: 3px; color: var(--muted); }
    main { padding: 24px 0 42px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .wide { grid-column: 1 / -1; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
    }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .stat {
      min-height: 86px;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
    }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; }
    .value { margin-top: 8px; font-size: 22px; font-weight: 700; overflow-wrap: anywhere; }
    label { display: block; margin: 12px 0 6px; color: var(--muted); font-size: 13px; }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #12161d;
      color: var(--text);
      padding: 11px 12px;
      font: inherit;
    }
    textarea { min-height: 110px; resize: vertical; }
    button, .link-button {
      min-height: 40px;
      border: 0;
      border-radius: 6px;
      padding: 10px 14px;
      background: var(--blue);
      color: #07111d;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    button.secondary { background: var(--panel-2); color: var(--text); border: 1px solid var(--line); }
    button.danger { background: var(--red); color: #23070b; }
    button.success { background: var(--green); color: #052014; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .login {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .login .panel { width: min(420px, 100%); }
    .hidden { display: none !important; }
    .toast {
      position: fixed;
      right: 18px;
      bottom: 18px;
      max-width: min(420px, calc(100vw - 36px));
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: #11161f;
      color: var(--text);
      box-shadow: 0 12px 40px rgba(0,0,0,.34);
    }
    .toast.ok { border-color: rgba(64,217,143,.75); }
    .toast.bad { border-color: rgba(255,111,125,.75); }
    @media (max-width: 820px) {
      .grid, .stats { grid-template-columns: 1fr; }
      .topbar { align-items: flex-start; flex-direction: column; padding: 18px 0; }
    }
  </style>
</head>
<body>
  <section id="login" class="login">
    <div class="panel">
      <h1>Houston Dashboard</h1>
      <p class="sub">Sign in to control Discord and the in-game server.</p>
      <label for="password">Dashboard Password</label>
      <input id="password" type="password" autocomplete="current-password">
      <div class="actions">
        <button id="loginBtn">Sign In</button>
      </div>
    </div>
  </section>

  <section id="app" class="hidden">
    <header>
      <div class="wrap topbar">
        <div>
          <h1>Houston City Roleplay</h1>
          <div class="sub">Discord and in-game server dashboard</div>
        </div>
        <div class="actions">
          <a class="link-button" href="https://erlc.gg/join/hsrppp" target="_blank" rel="noreferrer">Join Game</a>
          <a class="link-button" href="https://discord.gg/uyMvmY4gH3" target="_blank" rel="noreferrer">Join Discord</a>
          <button class="secondary" id="refreshBtn">Refresh</button>
        </div>
      </div>
    </header>

    <main class="wrap">
      <section class="stats wide">
        <div class="stat"><div class="label">Discord Server</div><div class="value" id="guildName">Loading</div></div>
        <div class="stat"><div class="label">Discord Members</div><div class="value" id="memberCount">-</div></div>
        <div class="stat"><div class="label">ERLC Players</div><div class="value" id="playerCount">-</div></div>
        <div class="stat"><div class="label">Bot</div><div class="value" id="botName">-</div></div>
      </section>

      <div class="grid">
        <section class="panel">
          <h2>In-Game Command</h2>
          <label for="erlcCommand">Command</label>
          <input id="erlcCommand" placeholder=":h Server message, :kick username reason, etc.">
          <div class="actions">
            <button class="success" data-action="erlc-command">Run In-Game Command</button>
          </div>
        </section>

        <section class="panel">
          <h2>Discord Message</h2>
          <label for="sayChannel">Channel</label>
          <select id="sayChannel"></select>
          <label for="sayMessage">Message</label>
          <textarea id="sayMessage" placeholder="Message to send as the bot"></textarea>
          <div class="actions">
            <button data-action="discord-say">Send Message</button>
          </div>
        </section>

        <section class="panel">
          <h2>Discord Embed</h2>
          <label for="embedChannel">Channel</label>
          <select id="embedChannel"></select>
          <label for="embedTitle">Title</label>
          <input id="embedTitle" placeholder="Announcement">
          <label for="embedDescription">Description</label>
          <textarea id="embedDescription" placeholder="Embed text"></textarea>
          <div class="actions">
            <button data-action="discord-embed">Send Embed</button>
            <button class="secondary" data-action="erlc-status">Post ERLC Status</button>
          </div>
        </section>

        <section class="panel">
          <h2>Session Controls</h2>
          <label for="controlChannel">Channel</label>
          <select id="controlChannel"></select>
          <label for="voteCount">Required Yes Votes</label>
          <input id="voteCount" type="number" min="1" value="5">
          <label for="pingRole">Ping Role</label>
          <select id="pingRole"></select>
          <div class="actions">
            <button class="success" data-action="startup">Startup</button>
            <button class="danger" data-action="shutdown">Shutdown</button>
            <button data-action="vote">Start Vote</button>
          </div>
        </section>
      </div>
    </main>
  </section>

  <div id="toast" class="toast hidden"></div>

  <script>
    const $ = (id) => document.getElementById(id);

    function toast(message, ok = true) {
      const box = $('toast');
      box.textContent = message;
      box.className = 'toast ' + (ok ? 'ok' : 'bad');
      setTimeout(() => box.classList.add('hidden'), 4500);
    }

    async function api(path, options = {}) {
      const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    function fillSelect(select, items, emptyLabel) {
      select.innerHTML = '';
      if (emptyLabel) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = emptyLabel;
        select.appendChild(option);
      }
      for (const item of items) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
      }
    }

    async function loadStatus() {
      const data = await api('/api/status');
      $('login').classList.add('hidden');
      $('app').classList.remove('hidden');
      $('guildName').textContent = data.guild?.name || 'Unknown';
      $('memberCount').textContent = data.guild?.memberCount ?? '-';
      $('playerCount').textContent = data.erlc?.players || 'Unknown';
      $('botName').textContent = data.bot?.tag || '-';
      fillSelect($('sayChannel'), data.channels || []);
      fillSelect($('embedChannel'), data.channels || []);
      fillSelect($('controlChannel'), data.channels || []);
      fillSelect($('pingRole'), data.roles || [], 'No ping role');
    }

    $('loginBtn').addEventListener('click', async () => {
      try {
        await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({ password: $('password').value }),
        });
        await loadStatus();
        toast('Signed in');
      } catch (error) {
        toast(error.message, false);
      }
    });

    $('refreshBtn').addEventListener('click', () => loadStatus().then(() => toast('Dashboard refreshed')).catch((error) => toast(error.message, false)));

    document.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      button.disabled = true;
      try {
        if (action === 'erlc-command') {
          await api('/api/erlc-command', { method: 'POST', body: JSON.stringify({ command: $('erlcCommand').value }) });
        }
        if (action === 'discord-say') {
          await api('/api/discord/say', { method: 'POST', body: JSON.stringify({ channelId: $('sayChannel').value, message: $('sayMessage').value }) });
        }
        if (action === 'discord-embed') {
          await api('/api/discord/embed', { method: 'POST', body: JSON.stringify({ channelId: $('embedChannel').value, title: $('embedTitle').value, description: $('embedDescription').value }) });
        }
        if (action === 'erlc-status') {
          await api('/api/discord/erlc-status', { method: 'POST', body: JSON.stringify({ channelId: $('embedChannel').value }) });
        }
        if (action === 'startup') {
          await api('/api/discord/startup', { method: 'POST', body: JSON.stringify({ channelId: $('controlChannel').value }) });
        }
        if (action === 'shutdown') {
          await api('/api/discord/shutdown', { method: 'POST', body: JSON.stringify({ channelId: $('controlChannel').value }) });
        }
        if (action === 'vote') {
          await api('/api/discord/vote', { method: 'POST', body: JSON.stringify({ channelId: $('controlChannel').value, requiredVotes: Number($('voteCount').value), pingRoleId: $('pingRole').value }) });
        }
        toast('Command sent');
        await loadStatus();
      } catch (error) {
        toast(error.message, false);
      } finally {
        button.disabled = false;
      }
    });

    loadStatus().catch(() => {});
  </script>
</body>
</html>`;
}

async function handleDashboardApi(req, res, path) {
  if ((path === '/api/health' || path === '/health') && req.method === 'GET') {
    return sendDashboardJson(res, 200, getHealthStatus());
  }

  if (path === '/api/login' && req.method === 'POST') {
    const body = await readDashboardBody(req);
    if (body.password !== dashboardPassword) {
      return sendDashboardJson(res, 401, { error: 'Incorrect dashboard password.' });
    }

    const sessionId = crypto.randomBytes(24).toString('hex');
    dashboardSessions.add(sessionId);
    res.setHeader('Set-Cookie', `dashboard_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);
    return sendDashboardJson(res, 200, { ok: true });
  }

  if (!isDashboardAuthed(req)) {
    return sendDashboardJson(res, 401, { error: 'Sign in first.' });
  }

  const guild = getDashboardGuild();
  if (!guild) {
    return sendDashboardJson(res, 503, { error: 'Bot is not connected to a guild yet.' });
  }

  if (path === '/api/status' && req.method === 'GET') {
    let erlc = { players: 'Unknown' };
    try {
      const server = await erlcRequest('/server');
      const { currentPlayers, maxPlayers } = readPlayerCounts(server);
      erlc = {
        name: server.Name || server.name || 'Unknown',
        players: currentPlayers !== null && maxPlayers !== null ? `${currentPlayers}/${maxPlayers}` : `${currentPlayers ?? 'Unknown'}`,
      };
    } catch (error) {
      erlc = { players: cachedPlayerCount || 'Unknown', error: error.message };
    }

    const channels = guild.channels.cache
      .filter((channel) => channel.isTextBased?.() && !channel.isDMBased?.())
      .map((channel) => ({ id: channel.id, name: `#${channel.name}` }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const roles = guild.roles.cache
      .filter((role) => role.id !== guild.id)
      .map((role) => ({ id: role.id, name: role.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return sendDashboardJson(res, 200, {
      bot: { tag: client.user.tag },
      guild: { id: guild.id, name: guild.name, memberCount: guild.memberCount },
      erlc,
      channels,
      roles,
    });
  }

  const body = await readDashboardBody(req);

  if (path === '/api/erlc-command' && req.method === 'POST') {
    if (!body.command?.trim()) throw new Error('Enter an in-game command.');
    const result = await erlcRequest('/server/command', {
      method: 'POST',
      body: JSON.stringify({ command: body.command.trim() }),
    });
    return sendDashboardJson(res, 200, { ok: true, result: result.message || 'Success' });
  }

  if (path === '/api/discord/say' && req.method === 'POST') {
    if (!body.message?.trim()) throw new Error('Enter a Discord message.');
    await getTextChannel(guild, body.channelId).send(body.message.trim());
    return sendDashboardJson(res, 200, { ok: true });
  }

  if (path === '/api/discord/embed' && req.method === 'POST') {
    if (!body.description?.trim()) throw new Error('Enter embed text.');
    const embed = createEmbed(body.title?.trim() || 'Announcement', body.description.trim(), 0x55a7ff);
    await getTextChannel(guild, body.channelId).send({ embeds: [embed] });
    return sendDashboardJson(res, 200, { ok: true });
  }

  if (path === '/api/discord/erlc-status' && req.method === 'POST') {
    const server = await erlcRequest('/server');
    await getTextChannel(guild, body.channelId).send({
      embeds: [createErlcStatusEmbed(server)],
      components: [createErlcStatusControls()],
    });
    return sendDashboardJson(res, 200, { ok: true });
  }

  if (path === '/api/discord/startup' && req.method === 'POST') {
    await sendDashboardStartup(getTextChannel(guild, body.channelId));
    return sendDashboardJson(res, 200, { ok: true });
  }

  if (path === '/api/discord/shutdown' && req.method === 'POST') {
    await sendDashboardShutdown(getTextChannel(guild, body.channelId));
    return sendDashboardJson(res, 200, { ok: true });
  }

  if (path === '/api/discord/vote' && req.method === 'POST') {
    const requiredVotes = Number(body.requiredVotes || 1);
    if (!Number.isFinite(requiredVotes) || requiredVotes < 1) throw new Error('Required votes must be at least 1.');
    await sendDashboardVote(getTextChannel(guild, body.channelId), requiredVotes, body.pingRoleId || null);
    return sendDashboardJson(res, 200, { ok: true });
  }

  return sendDashboardJson(res, 404, { error: 'Dashboard route not found.' });
}

function startDashboard() {
  if (dashboardPassword === 'change-me') {
    console.warn('Dashboard password is still "change-me". Set DASHBOARD_PASSWORD in .env before sharing this dashboard.');
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
      if (url.pathname === '/' && req.method === 'GET') {
        res.writeHead(302, { Location: '/Dashboard?StaffOnly' });
        return res.end();
      }

      if (url.pathname === '/Dashboard' && req.method === 'GET') {
        const body = dashboardPage();
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
        });
        return res.end(body);
      }

      if (url.pathname === '/health' && req.method === 'GET') {
        return sendDashboardJson(res, 200, getHealthStatus());
      }

      if (url.pathname.startsWith('/api/')) {
        return await handleDashboardApi(req, res, url.pathname);
      }

      return sendDashboardJson(res, 404, { error: 'Not found.' });
    } catch (error) {
      console.error('Dashboard error:', error);
      return sendDashboardJson(res, 500, { error: error.message || 'Dashboard error.' });
    }
  });

  server.listen(dashboardPort, '0.0.0.0', () => {
    console.log(`Dashboard running on port ${dashboardPort}`);
    console.log(`Local dashboard: http://localhost:${dashboardPort}/Dashboard?StaffOnly`);
    console.log(`Health endpoint: http://localhost:${dashboardPort}/health`);
  });
}

function addWarning(userId, guildId) {
  const key = `${guildId}-${userId}`;
  warnings[key] = (warnings[key] || 0) + 1;
  return warnings[key];
}

function getWarnings(userId, guildId) {
  const key = `${guildId}-${userId}`;
  return warnings[key] || 0;
}

function clearWarnings(userId, guildId) {
  const key = `${guildId}-${userId}`;
  delete warnings[key];
}

// ==================== BOT EVENTS ====================

client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`📝 Configuration loaded from config.json`);
  if (!presenceTimer) {
    updatePresence().catch((error) => console.error('Failed to update presence:', error.message));
    presenceTimer = setInterval(() => {
      updatePresence().catch((error) => console.error('Failed to update presence:', error.message));
    }, 10 * 1000);
    console.log('Rotating bot status enabled every 10 seconds.');
  }

  if (!erlcAnnouncementTimer) {
    sendNextErlcAnnouncement();
    erlcAnnouncementTimer = setInterval(sendNextErlcAnnouncement, 5 * 60 * 1000);
    console.log('ERLC automatic announcements enabled every 5 minutes.');
  }

  startDashboard();
});

client.on('interactionCreate', handleInteraction);

async function handleInteraction(interaction) {
  if (interaction.isButton()) {
    if (interaction.customId !== 'refresh-erlc-status') return;

    try {
      await interaction.deferUpdate();
      const server = await erlcRequest('/server');
      await interaction.editReply({
        embeds: [createErlcStatusEmbed(server)],
        components: [createErlcStatusControls()],
      });
    } catch (error) {
      console.error('Refresh error:', error);
      await interaction.followUp({ content: `Could not refresh ERLC status: ${error.message}`, ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, user, member, guild } = interaction;

  try {
    // ==================== MODERATION COMMANDS ====================

    if (commandName === 'warn') {
      if (!hasAdminRole(member)) {
        return interaction.reply({ content: '❌ You need admin/moderator role!', ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason', true);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ User not found!', ephemeral: true });
      }

      const warnings = addWarning(targetUser.id, guild.id);
      const maxWarnings = parseInt(process.env.MAX_WARNINGS) || 3;

      const embed = createEmbed(
        '⚠️ User Warned',
        `**${targetUser.tag}** has been warned!\n\n**Warnings: ${warnings}/${maxWarnings}**\n**Reason:** ${reason}`,
        0xf39c12
      );

      await interaction.reply({ embeds: [embed] });
      await logModeration(guild, 'WARN', targetUser, user, reason);

      // Auto-kick after max warnings
      if (warnings >= maxWarnings) {
        try {
          await targetMember.kick(`Auto-kicked after ${maxWarnings} warnings`);
          const kickEmbed = createEmbed(
            '🔨 Auto-Kicked',
            `${targetUser.tag} was auto-kicked after reaching ${maxWarnings} warnings.`,
            0xff6b6b
          );
          const channel = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
          if (channel) await channel.send({ embeds: [kickEmbed] });
          clearWarnings(targetUser.id, guild.id);
        } catch (err) {
          console.error('Failed to auto-kick:', err);
        }
      }
    }

    else if (commandName === 'kick') {
      if (!hasAdminRole(member)) {
        return interaction.reply({ content: '❌ You need admin/moderator role!', ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason', true);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ User not found!', ephemeral: true });
      }

      if (targetMember.roles.highest.position >= member.roles.highest.position) {
        return interaction.reply({ content: '❌ Cannot kick user with higher or equal role!', ephemeral: true });
      }

      await targetMember.kick(reason);
      const embed = createEmbed('🔨 User Kicked', `**${targetUser.tag}** has been kicked.\n**Reason:** ${reason}`, 0xff6b6b);
      await interaction.reply({ embeds: [embed] });
      await logModeration(guild, 'KICK', targetUser, user, reason);
      clearWarnings(targetUser.id, guild.id);
    }

    else if (commandName === 'ban') {
      if (!hasOwnerAdminRole(member)) {
        return interaction.reply({ content: '❌ You need admin role!', ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason', true);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (targetMember && targetMember.roles.highest.position >= member.roles.highest.position) {
        return interaction.reply({ content: '❌ Cannot ban user with higher or equal role!', ephemeral: true });
      }

      await guild.bans.create(targetUser.id, { reason });
      const embed = createEmbed('🚫 User Banned', `**${targetUser.tag}** has been banned.\n**Reason:** ${reason}`, 0xff0000);
      await interaction.reply({ embeds: [embed] });
      await logModeration(guild, 'BAN', targetUser, user, reason);
      clearWarnings(targetUser.id, guild.id);
    }

    else if (commandName === 'mute') {
      if (!hasAdminRole(member)) {
        return interaction.reply({ content: '❌ You need admin/moderator role!', ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      const duration = interaction.options.getInteger('duration') || parseInt(process.env.MUTE_DURATION) || 15;
      const reason = interaction.options.getString('reason', true);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ User not found!', ephemeral: true });
      }

      await targetMember.timeout(duration * 60 * 1000, reason);
      const embed = createEmbed(
        '🔇 User Muted',
        `**${targetUser.tag}** has been muted for ${duration} minutes.\n**Reason:** ${reason}`,
        0x9b59b6
      );
      await interaction.reply({ embeds: [embed] });
      await logModeration(guild, 'MUTE', targetUser, user, reason);
    }

    else if (commandName === 'remove-warning') {
      if (!hasAdminRole(member)) {
        return interaction.reply({ content: '❌ You need admin/moderator role!', ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount') || 1;
      const reason = interaction.options.getString('reason', true);

      const key = `${guild.id}-${targetUser.id}`;
      const currentWarnings = warnings[key] || 0;
      const newWarnings = Math.max(0, currentWarnings - amount);
      warnings[key] = newWarnings;

      const embed = createEmbed(
        '✅ Warnings Removed',
        `**${targetUser.tag}** now has **${newWarnings}** warnings.\n**Reason:** ${reason}`,
        0x27ae60
      );
      await interaction.reply({ embeds: [embed] });
      await logModeration(guild, 'UNWARN', targetUser, user, reason);
    }

    else if (commandName === 'nickname') {
      if (!hasAdminRole(member)) {
        return interaction.reply({ content: 'You need admin/moderator role!', ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      const nickname = interaction.options.getString('nickname');
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: 'User not found!', ephemeral: true });
      }

      if (targetMember.roles.highest.position >= member.roles.highest.position && targetMember.id !== member.id) {
        return interaction.reply({ content: 'Cannot change the nickname of a user with higher or equal role!', ephemeral: true });
      }

      if (!targetMember.manageable) {
        return interaction.reply({ content: 'I cannot change this user nickname. Move my bot role above their highest role and give me Manage Nicknames.', ephemeral: true });
      }

      await targetMember.setNickname(nickname, `Nickname changed by ${user.tag}`);
      const embed = createEmbed(
        'Nickname Updated',
        `**${targetUser.tag}** nickname was changed to **${nickname}**.`,
        0x3498db
      );
      await interaction.reply({ embeds: [embed] });
      await logModeration(guild, 'NICKNAME', targetUser, user, `Changed nickname to ${nickname}`);
    }

    else if (commandName === 'warnings') {
      const targetUser = interaction.options.getUser('user');
      const userWarnings = getWarnings(targetUser.id, guild.id);
      const maxWarnings = parseInt(process.env.MAX_WARNINGS) || 3;

      const embed = createEmbed(
        '⚠️ Warning Count',
        `**${targetUser.tag}** has **${userWarnings}/${maxWarnings}** warnings.`,
        0xf39c12
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    else if (commandName === 'say') {
      if (!hasAdminRole(member)) {
        return interaction.reply({ content: 'You need admin/moderator role!', ephemeral: true });
      }

      const message = interaction.options.getString('message', true);
      await interaction.reply({ content: 'Message sent.', ephemeral: true });
      await interaction.channel.send({ content: message });
    }

    // ==================== PROMOTIONS COMMANDS ====================

    else if (commandName === 'promote') {
      if (!hasOwnerAdminRole(member)) {
        return interaction.reply({ content: '❌ You need admin role!', ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      const roleId = interaction.options.getRole('role').id;
      const reason = interaction.options.getString('reason', true);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ User not found!', ephemeral: true });
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        return interaction.reply({ content: '❌ Role not found!', ephemeral: true });
      }

      await targetMember.roles.add(role);
      const embed = createEmbed(
        '🎖️ User Promoted',
        `**${targetUser.tag}** has been promoted to **${role.name}**!\n**Reason:** ${reason}`,
        0x1abc9c
      );
      await interaction.reply({ embeds: [embed] });
      await logModeration(guild, 'PROMOTE', targetUser, user, `Added ${role.name}: ${reason}`);
    }

    else if (commandName === 'demote') {
      if (!hasOwnerAdminRole(member)) {
        return interaction.reply({ content: '❌ You need admin role!', ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      const roleId = interaction.options.getRole('role').id;
      const reason = interaction.options.getString('reason', true);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ User not found!', ephemeral: true });
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        return interaction.reply({ content: '❌ Role not found!', ephemeral: true });
      }

      await targetMember.roles.remove(role);
      const embed = createEmbed(
        '📉 User Demoted',
        `**${targetUser.tag}** has been removed from **${role.name}**.\n**Reason:** ${reason}`,
        0xe74c3c
      );
      await interaction.reply({ embeds: [embed] });
      await logModeration(guild, 'DEMOTE', targetUser, user, `Removed ${role.name}: ${reason}`);
    }

    // ==================== SERVER COMMANDS ====================

    else if (commandName === 'serverstatus') {
      const embed = createEmbed(
        '🖥️ Server Status',
        `**Server Name:** ${guild.name}\n**Members:** ${guild.memberCount}\n**Channels:** ${guild.channels.cache.size}\n**Status:** 🟢 Online`,
        0x27ae60
      );
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'erlc-status') {
      if (!hasAdminRole(member)) {
        return interaction.reply({ content: 'You need admin/moderator role!', ephemeral: true });
      }

      await interaction.deferReply();

      const server = await erlcRequest('/server');
      const embed = createErlcStatusEmbed(server);

      await interaction.editReply({ embeds: [embed], components: [createErlcStatusControls()] });
    }

    else if (commandName === 'erlc-command') {
      if (!hasServerAdminRole(member)) {
        return interaction.reply({ content: 'You need server admin role!', ephemeral: true });
      }

      const command = interaction.options.getString('command', true);
      await interaction.deferReply({ ephemeral: true });

      const result = await erlcRequest('/server/command', {
        method: 'POST',
        body: JSON.stringify({ command }),
      });

      const embed = createEmbed(
        'ERLC Command Sent',
        `**Command:** \`${command}\`\n**Result:** ${result.message || 'Success'}`,
        0x2ecc71
      );

      await interaction.editReply({ embeds: [embed] });
      await logModeration(guild, 'ERLC COMMAND', user, user, command);
    }

    else if (commandName === 'vote') {
      if (!hasAdminRole(member)) {
        return interaction.reply({ content: 'You need admin/moderator role!', ephemeral: true });
      }

      const requiredVotes = interaction.options.getInteger('votes', true);
      const defaultPingRoleId = process.env.SESSION_PING_ROLE_ID || '1502351528814579732';
      const pingRole = interaction.options.getRole('ping') || guild.roles.cache.get(defaultPingRoleId) || guild.roles.cache.find((role) => role.name.toLowerCase() === 'session ping');
      const pingRoleId = pingRole?.id || defaultPingRoleId;
      const pingContent = `<@&${pingRoleId}>`;
      const embed = createEmbed(
        'SESSION VOTE',
        `A session vote has been started by **${user.tag}**.\n\nRequired votes: **${requiredVotes}** yes votes.\n\nReact with YES if you want a session.\nReact with NO if you do not want a session.`,
        0x2ecc71
      );

      const voteMessage = await interaction.reply({
        content: pingContent || undefined,
        embeds: [embed],
        fetchReply: true,
        allowedMentions: { roles: [pingRoleId] },
      });
      await voteMessage.react('✅').catch(() => {});
      await voteMessage.react('❌').catch(() => {});
    }

    else if (commandName === 'startup') {
      if (!hasServerAdminRole(member)) {
        return interaction.reply({ content: '❌ You need server admin role!', ephemeral: true });
      }

      const embed = createEmbed(
        '🚀 Server Startup',
        `Server startup sequence initiated by **${user.tag}**.\n\n🔄 *Initializing systems...*\n✅ *All systems online*`,
        0x3498db
      );
      await interaction.reply({ embeds: [embed] });
      
      const logChannel = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = createEmbed(
          '🚀 Server Startup',
          `Server was started by **${user.tag}** (${user.id})`,
          0x3498db
        );
        await logChannel.send({ embeds: [logEmbed] });
      }
    }

    else if (commandName === 'shutdown') {
      if (!hasServerAdminRole(member)) {
        return interaction.reply({ content: '❌ You need server admin role!', ephemeral: true });
      }

      const embed = createEmbed(
        '🛑 Server Shutdown',
        `Server shutdown sequence initiated by **${user.tag}**.\n\n⏳ *Saving data...*\n✅ *Shutdown complete*`,
        0xe74c3c
      );
      await interaction.reply({ embeds: [embed] });

      const logChannel = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = createEmbed(
          '🛑 Server Shutdown',
          `Server was shutdown by **${user.tag}** (${user.id})`,
          0xe74c3c
        );
        await logChannel.send({ embeds: [logEmbed] });
      }
    }

    // ==================== HELP & INFO COMMANDS ====================

    else if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('📚 Houston City Roleplay Bot Help')
        .setDescription('Complete list of available commands')
        .addFields(
          {
            name: '⚖️ Moderation Commands',
            value: '`/warn` - Warn a user\n`/kick` - Kick a user\n`/ban` - Ban a user\n`/mute` - Timeout a user\n`/remove-warning` - Remove warnings\n`/nickname` - Change a nickname\n`/say` - Make the bot send a message\n`/warnings` - Check user warnings'
          },
          {
            name: '🎖️ Promotion Commands',
            value: '`/promote` - Promote a user (add role)\n`/demote` - Demote a user (remove role)'
          },
          {
            name: '🖥️ Server Commands',
            value: '`/erlc-status` - Test ERLC API link\n`/erlc-command` - Run an ERLC command\n`/vote` - Start a session vote with required yes votes\n`/startup` - Start the server\n`/shutdown` - Shutdown the server\n`/serverstatus` - Check server status'
          },
          {
            name: '📋 Info',
            value: '`/help` - Show this message'
          }
        )
        .setColor(0x3498db)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Command error:', error);
    await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
  }
}

// ==================== BOT LOGIN ====================

client.login(process.env.DISCORD_TOKEN);
