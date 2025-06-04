require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  StringSelectMenuBuilder,
  ActivityType,
  EmbedBuilder,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel],
});

const prefix = '!';
const WELCOME_CHANNEL_ID = '';

const statuses = [
  { name: 'DON', type: ActivityType.Watching },
  { name: 'DON', type: ActivityType.Playing },
  { name: 'DON', type: ActivityType.Watching }
];

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  let i = 0;
  client.user.setPresence({
    activities: [{ name: statuses[i].name, type: statuses[i].type }],
    status: 'online',
  });

  setInterval(() => {
    i = (i + 1) % statuses.length;
    client.user.setPresence({
      activities: [{ name: statuses[i].name, type: statuses[i].type }],
      status: 'online',
    });
  }, 10000);
});

// Welcome Embed
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return console.error('❌ Welcome channel not found!');

  const welcomeEmbed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle(`🎉 Welcome to ${member.guild.name}!`)
    .setDescription(`Hey ${member}, we're glad to have you here!\nMake sure to check out the rules.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage('https://cdn.discordapp.com/attachments/1375330445926989970/1378258664233898051/360_F_411821271_HXEiuyPkjAhOo6c8igT0i9WC26lhyfN5.png')
    .setTimestamp()
    .setFooter({ text: 'Powered By Sentic Store', iconURL: client.user.displayAvatarURL() });

  channel.send({ content: `${member}`, embeds: [welcomeEmbed] });
});

// Command handlers
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  const [cmd] = message.content.slice(prefix.length).split(/\s+/);

  if (cmd === 'setupverify') {
    const verifyBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify')
        .setLabel('✅ Verify')
        .setStyle(ButtonStyle.Success)
    );
    await message.channel.send({ content: 'Click to verify:', components: [verifyBtn] });
  }

  if (cmd === 'setupticket') {
    const ticketBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket')
        .setLabel('🎫 Create Ticket')
        .setStyle(ButtonStyle.Primary)
    );
    await message.channel.send({ content: 'Click to open a support ticket:', components: [ticketBtn] });
  }
});

// Interaction handlers
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === 'verify') {
        const role = interaction.guild.roles.cache.get(process.env.VERIFY_ROLE_ID);
        if (!role) return interaction.reply({ content: 'Verify role not found!', ephemeral: true });

        if (interaction.member.roles.cache.has(role.id)) {
          return interaction.reply({ content: 'You are already verified!', ephemeral: true });
        }

        await interaction.member.roles.add(role);
        await interaction.reply({ content: '✅ You have been verified!', ephemeral: true });
      }

      if (interaction.customId === 'ticket') {
        const topicMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_topic')
            .setPlaceholder('Select a ticket topic...')
            .addOptions([
              { label: '🧑Staff Support', value: 'Staff Support' },
              { label: '🛠️Technical Support', value: 'Technical Support' },
              { label: '👥Character Issue', value: 'Character Issue' },
              { label: '🌐Other', value: 'other' },
            ])
        );
        await interaction.reply({ content: 'Please select the topic of your ticket:', components: [topicMenu], ephemeral: true });
      }

      if (interaction.customId === 'close_ticket') {
        if (!interaction.channel.name.startsWith('ticket-')) {
          return interaction.reply({ content: 'This can only be used inside ticket channels.', ephemeral: true });
        }

        await interaction.reply('Closing ticket in 3 seconds...');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_topic') {
      const topic = interaction.values[0];
      const category = process.env.TICKET_CATEGORY_ID;
      const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/gi, '');
      const channelName = `ticket-${username}-${topic}`.slice(0, 100);

      const existing = interaction.guild.channels.cache.find(c => c.name.startsWith(`ticket-${username}`));
      if (existing) {
        return interaction.reply({ content: `You already have a ticket open: ${existing}`, ephemeral: true });
      }

      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category,
        topic: `Ticket for ${interaction.user.tag} | Topic: ${topic}`,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
        ],
      });

      const closeBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `Hello <@${interaction.user.id}>! Ticket Topic: **${topic}**\nPlease describe your issue.`,
        components: [closeBtn],
      });

      await interaction.update({ content: `✅ Ticket created: ${channel}`, components: [] });
    }
  } catch (err) {
    console.error('Interaction Error:', err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ Something went wrong.', ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
