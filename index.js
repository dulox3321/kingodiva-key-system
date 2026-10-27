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

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("KingODiva Key System is running.");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "Missing BOT_TOKEN, CLIENT_ID, or GUILD_ID."
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Show the KingODiva Key System panel")
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Slash commands registered.");
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("Command registration failed:", error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== "panel") return;

      const embed = new EmbedBuilder()
        .setColor(0x171717)
        .setTitle("KingODiva. | KEY SYSTEM")
        .setDescription(
          [
            "Welcome to KingODiva Key System.",
            "",
            "🎁 **FREE KEY**",
            "First-time users can claim one 24-hour key.",
            "",
            "💎 **BUY KEY**",
            "1 Day — ฿20",
            "2 Days — ฿40",
            "3 Days — ฿50",
            "",
            "Select an option below to continue.",
            "Key issuance and payment verification are being configured."
          ].join("\n")
        )
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
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row]
      });

      return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === "get_free_key") {
      await interaction.reply({
        content:
          "🎁 Free Key System is being configured. No key has been issued yet.",
        ephemeral: true
      });
      return;
    }

    if (interaction.customId === "buy_key") {
      await interaction.reply({
        content:
          "💎 Purchase System is being configured. No payment has been requested or verified.",
        ephemeral: true
      });
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
