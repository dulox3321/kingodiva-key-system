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

// ========================================
// CONFIG
// ========================================

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const PORT = process.env.PORT || 3000;

// Discord User ID ของเจ้าของบอท
const OWNER_USER_ID = "842970562900656148";

// ราคาแพ็กเกจ (ยังไม่มีระบบรับชำระเงินจริง)
const KEY_PRICES = {
  "1day": 20,
  "2days": 40,
  "3days": 50
};

// ========================================
// VALIDATE ENVIRONMENT
// ========================================

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "❌ Missing BOT_TOKEN, CLIENT_ID, or GUILD_ID in environment variables."
  );
  process.exit(1);
}

// ========================================
// DISCORD CLIENT
// ========================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ========================================
// EXPRESS API
// ========================================

const app = express();

app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.status(200).json({
    status: "online",
    name: "KingODiva Key System",
    message: "API is running"
  });
});

// ========================================
// KEY STORAGE
// NOTE: In-memory only. Restarting the service
// clears all keys and free-claim records.
// ========================================

const keys = new Map();
const freeClaims = new Set();

// ========================================
// KEY UTILITIES
// ========================================

function createKey() {
  return (
    "KOD-" +
    crypto.randomBytes(12).toString("hex").toUpperCase()
  );
}

function getKeyStatus(key) {
  const data = keys.get(key);

  if (!data) {
    return {
      valid: false,
      reason: "invalid"
    };
  }

  if (data.expiresAt !== null && Date.now() >= data.expiresAt) {
    keys.delete(key);

    return {
      valid: false,
      reason: "expired"
    };
  }

  return {
    valid: true,
    data
  };
}

function formatExpiry(expiresAt) {
  if (expiresAt === null) {
    return "ไม่มีวันหมดอายุ";
  }

  return `<t:${Math.floor(expiresAt / 1000)}:F>`;
}

// ========================================
// SLASH COMMANDS
// ========================================

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("เปิดแผงควบคุม KingODiva Key System"),

  new SlashCommandBuilder()
    .setName("mykey")
    .setDescription("ตรวจสอบคีย์ของคุณ")
].map(command => command.toJSON());

// ========================================
// REGISTER SLASH COMMANDS
// ========================================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Slash commands registered");
}

// ========================================
// PANEL EMBED
// ========================================

function createPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("👑 KingODiva Key System")
    .setDescription(
      [
        "ยินดีต้อนรับสู่ระบบคีย์ KingODiva",
        "",
        "🔹 **GET FREE KEY**",
        "รับคีย์ฟรี อายุ 24 ชั่วโมง ส่งผ่าน DM",
        "",
        "🔹 **BUY KEY**",
        "ดูแพ็กเกจและราคาคีย์",
        "",
        "🔹 **CHECK KEY**",
        "ตรวจสอบคีย์ของคุณ",
        "",
        "กดปุ่มด้านล่างเพื่อเริ่มใช้งาน"
      ].join("\n")
    )
    .addFields(
      {
        name: "📦 ราคาแพ็กเกจ",
        value:
          `1 วัน — ฿${KEY_PRICES["1day"]}\n` +
          `2 วัน — ฿${KEY_PRICES["2days"]}\n` +
          `3 วัน — ฿${KEY_PRICES["3days"]}`,
        inline: true
      },
      {
        name: "🔑 ระบบคีย์",
        value: "คีย์ฟรีมีอายุ 24 ชั่วโมง",
        inline: true
      }
    )
    .setColor(0x8A2BE2)
    .setFooter({
      text: "KingODiva Key System"
    })
    .setTimestamp();
}

function createPanelButtons() {
  return new ActionRowBuilder().addComponents(
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
}

// ========================================
// SEND FREE KEY VIA DISCORD DM
// ========================================

async function sendFreeKey(interaction) {
  // จำกัดหนึ่งครั้งต่อผู้ใช้ในระหว่างที่ข้อมูลยังอยู่ในหน่วยความจำ
  if (freeClaims.has(interaction.user.id)) {
    return interaction.reply({
      content:
        "❌ คุณรับ Free Key ไปแล้ว ระบบอนุญาตให้รับได้ 1 ครั้ง",
      ephemeral: true
    });
  }

  const key = createKey();

  // อายุคีย์ 24 ชั่วโมง
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  keys.set(key, {
    userId: interaction.user.id,
    expiresAt,
    type: "free",
    createdAt: Date.now()
  });

  try {
    const dmEmbed = new EmbedBuilder()
      .setTitle("🔑 KINGODIVA FREE KEY")
      .setDescription(
        [
          "คุณได้รับ Free Key เรียบร้อยแล้ว!",
          "",
          "**คีย์ของคุณ**",
          "```",
          key,
          "```",
          `⏳ **อายุคีย์:** 24 ชั่วโมง`,
          `📅 **หมดอายุ:** ${formatExpiry(expiresAt)}`,
          "",
          "⚠️ อย่าแชร์คีย์ให้ผู้อื่น"
        ].join("\n")
      )
      .setColor(0x00FF99)
      .setFooter({
        text: "KingODiva Key System"
      })
      .setTimestamp();

    // ส่งคีย์เข้า DM
    await interaction.user.send({
      embeds: [dmEmbed]
    });

    // บันทึกสิทธิ์หลังส่ง DM สำเร็จ
    freeClaims.add(interaction.user.id);

    return interaction.reply({
      content:
        "✅ ส่งคีย์ให้คุณทาง DM แล้ว! กรุณาตรวจสอบข้อความส่วนตัวจากบอท",
      ephemeral: true
    });
  } catch (error) {
    // ยกเลิกคีย์หากส่ง DM ไม่สำเร็จ
    keys.delete(key);

    console.error("Failed to send free key DM:", error.message);

    return interaction.reply({
      content:
        "❌ ส่ง DM ไม่สำเร็จ กรุณาเปิดรับข้อความส่วนตัวจากสมาชิกเซิร์ฟเวอร์นี้ แล้วกดรับคีย์อีกครั้ง",
      ephemeral: true
    });
  }
}

// ========================================
// BUY KEY INFORMATION
// ========================================

async function showBuyKey(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("💎 KingODiva — Buy Key")
    .setDescription(
      [
        "**แพ็กเกจคีย์**",
        "",
        `🗓️ 1 วัน — ฿${KEY_PRICES["1day"]}`,
        `🗓️ 2 วัน — ฿${KEY_PRICES["2days"]}`,
        `🗓️ 3 วัน — ฿${KEY_PRICES["3days"]}`,
        "",
        "⚠️ ระบบชำระเงินยังไม่ได้เชื่อมต่อ",
        "โปรดติดต่อเจ้าของบอทเพื่อสอบถามวิธีชำระเงิน",
        "บอทยังไม่ออกคีย์แบบชำระเงินโดยอัตโนมัติ"
      ].join("\n")
    )
    .setColor(0x3498DB)
    .setFooter({
      text: "KingODiva Key System"
    });

  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

// ========================================
// CHECK KEY
// ========================================

async function checkMyKey(interaction) {
  const userKeys = [];

  for (const [key, data] of keys.entries()) {
    if (data.userId !== interaction.user.id) {
      continue;
    }

    const status = getKeyStatus(key);

    if (status.valid) {
      userKeys.push({
        key,
        data: status.data
      });
    }
  }

  if (userKeys.length === 0) {
    return interaction.reply({
      content:
        "❌ คุณยังไม่มีคีย์ที่ใช้งานได้ กรุณากด GET FREE KEY ก่อน",
      ephemeral: true
    });
  }

  const description = userKeys
    .map(({ key, data }) => {
      return [
        `🔑 **คีย์:** \`${key}\``,
        `📦 **ประเภท:** ${data.type}`,
        `⏳ **หมดอายุ:** ${formatExpiry(data.expiresAt)}`
      ].join("\n");
    })
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle("🔍 คีย์ของคุณ")
    .setDescription(description)
    .setColor(0x2ECC71);

  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

// ========================================
// INTERACTION HANDLER
// ========================================

client.on(Events.InteractionCreate, async interaction => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "panel") {
        return interaction.reply({
          embeds: [createPanelEmbed()],
          components: [createPanelButtons()]
        });
      }

      if (interaction.commandName === "mykey") {
        return checkMyKey(interaction);
      }
    }

    // Buttons
    if (interaction.isButton()) {
      if (interaction.customId === "get_free_key") {
        return sendFreeKey(interaction);
      }

      if (interaction.customId === "buy_key") {
        return showBuyKey(interaction);
      }

      if (interaction.customId === "check_key") {
        return checkMyKey(interaction);
      }
    }
  } catch (error) {
    console.error("Interaction error:", error);

    const message = {
      content: "❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }
  }
});

// ========================================
// VERIFY API
// POST /api/verify
// JSON body: { "key": "KOD-..." }
// ========================================

app.post("/api/verify", (req, res) => {
  const key = req.body?.key;

  if (typeof key !== "string" || key.length > 100) {
    return res.status(400).json({
      valid: false,
      message: "Invalid request"
    });
  }

  const status = getKeyStatus(key);

  if (!status.valid) {
    return res.status(403).json({
      valid: false,
      message:
        status.reason === "expired"
          ? "Key expired"
          : "Invalid key"
    });
  }

  return res.status(200).json({
    valid: true,
    type: status.data.type,
    expiresAt: status.data.expiresAt
  });
});

// ========================================
// START SERVER
// ========================================

async function start() {
  try {
    await registerCommands();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🌐 API server listening on port ${PORT}`);
    });

    await client.login(TOKEN);

    console.log(`✅ Logged in as ${client.user.tag}`);
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
}

start();
