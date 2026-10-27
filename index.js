const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events
} = require("discord.js");

const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.status(200).send("KingODiva Key System is running.");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// Environment Variables
const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Owner Discord User ID
const OWNER_USER_ID = "842970562900656148";

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing BOT_TOKEN, CLIENT_ID, or GUILD_ID.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/*
 * TEMPORARY STORAGE
 * Keys are stored in memory and will be lost when
 * the process restarts. Persistent database storage
 * is required for a production key system.
 */
const keys = new Map();
const freeClaims = new Set();

// Key generation
function createKey() {
  return "KOD-" + crypto.randomBytes(12).toString("hex").toUpperCase();
}

// Owner access is permanent and does not depend on memory.
function getKeyForUser(userId) {
  if (userId === OWNER_USER_ID) {
    return {
      key: "KINGODIVA-OWNER-PERMANENT",
      userId: OWNER_USER_ID,
      permanent: true,
      expiresAt: null,
      type: "owner"
    };
  }

  for (const [key, data] of keys.entries()) {
    if (data.userId === userId) {
      return { key, ...data };
    }
  }

  return null;
}

function isKeyValid(data) {
  return Boolean(data && (data.permanent || data.expiresAt > Date.now()));
}

function formatExpiry(data) {
  if (data.permanent) return "♾️ Never expires";

  return `<t:${Math.floor(data.expiresAt / 1000)}:F>`;
}

// Register Discord slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Show the KingODiva Key System panel"),

  new SlashCommandBuilder()
    .setName("mykey")
    .setDescription("Check your current key")
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Slash commands registered.");
}

// Main panel
async function showPanel(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x171717)
    .setTitle("KingODiva. | KEY SYSTEM")
    .setDescription([
      "Welcome to KingODiva Key System.",
      "",
      "👑 **OWNER KEY**",
      "Permanent access for the system owner.",
      "",
      "🎁 **FREE KEY**",
      "First-time users can claim one 24-hour key.",
      "",
      "💎 **BUY KEY**",
      "1 Day — ฿20",
      "2 Days — ฿40",
      "3 Days — ฿50",
      "",
      "🔍 **CHECK KEY**",
      "Check your key and expiration time.",
      "",
      "Paid keys are issued only after payment is verified."
    ].join("\n"))
    .setFooter({
      text: "KingODiva. • Official Key System"
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("get_free_key")
      .setLabel("GET FREE KEY")
      .setEmoji("🎁")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("buy_key")
      .setLabel("BUY KEY")
      .setEmoji("💎")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("check_key")
      .setLabel("CHECK KEY")
      .setEmoji("🔍")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row]
  });
}

// Bot startup
client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("Command registration failed:", error);
  }
});

// Interactions
client.on(Events.InteractionCreate, async interaction => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "panel") {
        await showPanel(interaction);
        return;
      }

      if (interaction.commandName === "mykey") {
        const data = getKeyForUser(interaction.user.id);

        if (!data || !isKeyValid(data)) {
          await interaction.reply({
            content: "❌ You don't have an active key.",
            ephemeral: true
          });
          return;
        }

        await interaction.reply({
          content: [
            "🔑 **Your Key Information**",
            `Key: \`${data.key}\``,
            `Type: **${data.type.toUpperCase()}**`,
            `Expires: ${formatExpiry(data)}`
          ].join("\n"),
          ephemeral: true
        });
        return;
      }
    }

    if (!interaction.isButton()) return;

    // Owner receives permanent access automatically.
    if (interaction.user.id === OWNER_USER_ID) {
      if (
        interaction.customId === "get_free_key" ||
        interaction.customId === "check_key"
      ) {
        const ownerData = getKeyForUser(OWNER_USER_ID);

        await interaction.reply({
          content: [
            "👑 **KINGODIVA OWNER ACCESS**",
            "",
            `🔑 Key: \`${ownerData.key}\``,
            "♾️ Expiration: Never expires",
            "✅ Your owner access is permanent."
          ].join("\n"),
          ephemeral: true
        });
        return;
      }
    }

    // Free key
    if (interaction.customId === "get_free_key") {
      const userId = interaction.user.id;

      if (freeClaims.has(userId)) {
        await interaction.reply({
          content: "❌ You have already claimed your free key during this session.",
          ephemeral: true
        });
        return;
      }

      const existing = getKeyForUser(userId);

      if (existing && isKeyValid(existing)) {
        await interaction.reply({
          content: "You already have an active key. Use `/mykey` to check it.",
          ephemeral: true
        });
        return;
      }

      const key = createKey();

      const data = {
        userId,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        permanent: false,
        type: "free"
      };

      keys.set(key, data);
      freeClaims.add(userId);

      await interaction.reply({
        content: [
          "🎉 **Your Free Key has been issued!**",
          "",
          `🔑 Key: \`${key}\``,
          "⏳ Valid for: **24 hours**",
          `📅 Expires: ${formatExpiry(data)}`,
          "",
          "⚠️ Keep your key private."
        ].join("\n"),
        ephemeral: true
      });

      return;
    }

    // Check key
    if (interaction.customId === "check_key") {
      const data = getKeyForUser(interaction.user.id);

      if (!data || !isKeyValid(data)) {
        await interaction.reply({
          content: "❌ You don't have an active key.",
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        content: [
          "✅ **Your key is active!**",
          `🔑 Key: \`${data.key}\``,
          `Type: **${data.type.toUpperCase()}**`,
          `⏳ Expires: ${formatExpiry(data)}`
        ].join("\n"),
        ephemeral: true
      });

      return;
    }

    // Paid key information
    if (interaction.customId === "buy_key") {
      await interaction.reply({
        content: [
          "💎 **KingODiva Key Packages**",
          "",
          "• 1 Day — ฿20",
          "• 2 Days — ฿40",
          "• 3 Days — ฿50",
          "",
          "⚠️ Automated payment verification is not configured.",
          "No paid key will be issued until payment is verified."
        ].join("\n"),
        ephemeral: true
      });

      return;
    }
  } catch (error) {
    console.error("Interaction error:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "An error occurred. Please try again later.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);
