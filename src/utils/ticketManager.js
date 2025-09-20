const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');

class TicketManager {
    static async setupTicketSystem(channel) {
        const embed = new EmbedBuilder()
            .setTitle(' 🎟️ Open a Ticket')
            .setDescription('Need help, want to report something, or looking to partner with us? Select a category below and we’ll get back to you shortly. Your request stays private between you and our team.')
            .setThumbnail('https://media.discordapp.net/attachments/1287451518244753489/1396835161269604442/Bot_Market_Circle_Cropped_Logo.png?ex=687f879e&is=687e361e&hm=34768b247082b5fd02c5ecc8d2b684f2ef9eef9bfe010f04ee9765fb8615a6d5&=&format=webp&quality=lossless&width=989&height=989') // Replace with your icon UR
            .setColor('#0099ff');

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_menu')
            .setPlaceholder('Select ticket type')
            .addOptions([
                {
                    label: 'General Support',
                    description: 'Get help with general issues',
                    value: 'support',
                    emoji: '❓'
                },
                {
                    label: 'Report',
                    description: 'Report a user or issue',
                    value: 'report',
                    emoji: '🚨'
                },
                {
                    label: 'Partnership',
                    description: 'Discuss partnership opportunities',
                    value: 'partnership',
                    emoji: '🤝'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        // Delete all previous messages in the channel
        await channel.bulkDelete(100);
        
        // Send new ticket message
        await channel.send({
            embeds: [embed],
            components: [row]
        });
    }

    static async createTicket(interaction, type) {
        try {
            await interaction.deferReply({ flags: 64 });
            const guild = interaction.guild;
            const user = interaction.user;

            // Check if user already has a ticket
            const existingTicket = guild.channels.cache.find(channel => 
                channel.name === `ticket-${user.username.toLowerCase()}`
            );

            if (existingTicket) {
                return await interaction.editReply({
                    content: `You already have an open ticket: ${existingTicket}`
                });
            }

            // Determine which role should have access
            const staffRoleId = process.env.STAFF_ROLE_ID;
            const partnershipRoleId = process.env.PARTNERSHIP_ROLE_ID;
            
            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
                {
                    id: interaction.client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                }
            ];

            // Add role-specific permissions
            if (type === 'partnership') {
                permissionOverwrites.push({
                    id: partnershipRoleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                });
            } else {
                permissionOverwrites.push({
                    id: staffRoleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                });
            }

            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.username.toLowerCase()}`,
                type: 0,
                parent: process.env.TICKET_CATEGORY_ID,
                permissionOverwrites: permissionOverwrites
            });

            const embed = new EmbedBuilder()
                .setTitle(`${type.toUpperCase()} Ticket`)
                .setDescription(`Support will be with you shortly.\n\nType: ${type}\nCreated by: ${user.tag}`)
                .setColor('#0099ff')
                .setTimestamp();

            const closeButton = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(closeButton);

            // Create role mention based on ticket type
            const roleMention = type === 'partnership' 
                ? `<@&${partnershipRoleId}>`
                : `<@&${staffRoleId}>`;

            await ticketChannel.send({
                content: `${user} ${roleMention}\n\n**New ${type} ticket created!**`,
                embeds: [embed],
                components: [row]
            });

            await interaction.editReply({
                content: `Your ticket has been created: ${ticketChannel}`
            });

        } catch (error) {
            console.error('Error creating ticket:', error);
            const response = {
                content: 'There was an error creating your ticket. Please try again later.',
                flags: 64
            };

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply(response);
            } else {
                await interaction.editReply(response);
            }
        }
    }

    static async closeTicket(interaction) {
        try {
            const channel = interaction.channel;
            
            // Check if ticket is already being closed
            if (channel.deletable === false) {
                return await interaction.reply({
                    content: 'This ticket is already being closed!',
                    flags: 64
                });
            }

            // Lock the channel immediately
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: false,
                ViewChannel: false
            });

            // Initial response
            await interaction.reply({
                content: '🔒 Closing ticket...',
                flags: 64
            });

            const logChannel = interaction.guild.channels.cache.get(process.env.TICKET_LOGS_CHANNEL_ID);

            // Create transcript with progress update
            await interaction.editReply({ 
                content: '📝 Creating transcript...', 
                flags: 64 
            });

            const messages = await channel.messages.fetch({ limit: 100 });
            const transcript = messages.reverse().map(msg => {
                return `${msg.author.tag} (${msg.createdAt.toLocaleString()}): ${msg.content}`;
            }).join('\n');

            // Save transcript with progress update
            await interaction.editReply({ 
                content: '💾 Saving transcript...', 
                flags: 64 
            });

            const logEmbed = new EmbedBuilder()
                .setTitle('Ticket Closed')
                .setDescription(`**Ticket:** ${channel.name}\n**Closed by:** ${interaction.user.tag}`)
                .setColor('#ff0000')
                .setTimestamp();

            await logChannel.send({
                embeds: [logEmbed],
                files: [{
                    attachment: Buffer.from(transcript),
                    name: `${channel.name}-transcript.txt`
                }]
            });

            // Final countdown with deletion
            for (let i = 3; i > 0; i--) {
                await interaction.editReply({
                    content: `⏳ Channel deleting in ${i} seconds...`,
                    flags: 64
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await interaction.editReply({
                content: '🗑️ Deleting channel...',
                flags: 64
            });

            // Delete the channel immediately after the countdown
            await channel.delete();

        } catch (error) {
            console.error('Error closing ticket:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ An error occurred while closing the ticket.',
                    flags: 64
                });
            }
        }
    }
}

module.exports = TicketManager;
