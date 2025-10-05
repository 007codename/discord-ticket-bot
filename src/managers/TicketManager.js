const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ComponentType
} = require('discord.js');

class TicketManager {
    constructor(client) {
        this.client = client;
        this.config = client.config;
    }

    async setupTicketSystem(channel) {
        try {
            // Check if ticket message already exists
            const messages = await channel.messages.fetch({ limit: 10 });
            const existingMessage = messages.find(msg => 
                msg.author.id === this.client.user.id && 
                msg.embeds.length > 0 && 
                msg.embeds[0].title === this.config.tickets.embed.title
            );

            if (existingMessage) {
                console.log('🎫 Ticket message already exists, skipping setup');
                return existingMessage;
            }

            const embed = new EmbedBuilder()
                .setTitle(this.config.tickets.embed.title)
                .setDescription(this.config.tickets.embed.description)
                .setThumbnail(this.config.tickets.embed.thumbnail)
                .setColor(this.config.tickets.embed.color)
                .setFooter({ text: `${this.config.bot.name} v${this.config.bot.version}` });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_menu')
                .setPlaceholder('🎫 Select ticket type...')
                .setMinValues(1)
                .setMaxValues(1);

            // Add options from config
            Object.entries(this.config.tickets.types).forEach(([key, ticket]) => {
                selectMenu.addOptions({
                    label: ticket.label,
                    description: ticket.description,
                    value: key,
                    emoji: ticket.emoji
                });
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const message = await channel.send({
                embeds: [embed],
                components: [row]
            });

            console.log('✅ Ticket system setup complete');
            return message;

        } catch (error) {
            console.error('❌ Error setting up ticket system:', error);
            throw error;
        }
    }

    async createTicket(interaction, ticketType) {
        try {
            await interaction.deferReply({ flags: 64 });

            const guild = interaction.guild;
            const user = interaction.user;
            const ticketConfig = this.config.tickets.types[ticketType];

            if (!ticketConfig) {
                return await interaction.editReply({
                    content: '❌ Invalid ticket type!'
                });
            }

            // Check for existing ticket - now only checking for ticket-username format
            const existingTicket = guild.channels.cache.find(channel => 
                channel.name === `ticket-${user.username.toLowerCase()}`
            );

            if (existingTicket) {
                return await interaction.editReply({
                    content: `❌ You already have an open ticket: ${existingTicket}`
                });
            }

            // Always use ticket-username format
            const channelName = `ticket-${user.username.toLowerCase()}`;

            // Setup permissions
            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                },
                {
                    id: this.client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
                }
            ];

            // Add role-specific permissions
            const roleId = this.client.getRole(ticketConfig.role);
            if (roleId) {
                permissionOverwrites.push({
                    id: roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                });
            }

            // Create ticket channel
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: 0,
                parent: this.client.getChannel('ticketCategory'),
                permissionOverwrites
            });

            // Create ticket embed
            const ticketEmbed = this.createTicketEmbed(ticketType, user);

            const closeButton = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('🗑️ Close Ticket')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(closeButton);

            // Send ticket message
            const roleMention = roleId ? `<@&${roleId}>` : '';

            await ticketChannel.send({
                content: `${user} ${roleMention}`,
                embeds: [ticketEmbed],
                components: [row]
            });

            await interaction.editReply({
                content: `✅ Your ticket has been created: ${ticketChannel}`
            });

        } catch (error) {
            console.error('❌ Error creating ticket:', error);
            await interaction.editReply({
                content: '❌ Failed to create ticket. Please try again later.'
            });
        }
    }

    createTicketEmbed(ticketType, user) {
        const ticketConfig = this.config.tickets.types[ticketType];

        const embed = new EmbedBuilder()
            .setTitle(`${ticketConfig.emoji} ${ticketConfig.label}`)
            .setDescription(`Support will be with you shortly.\n\n**Created by:** ${user.tag}\n**Type:** ${ticketConfig.label}`)
            .setColor(this.config.tickets.embed.color)
            .setTimestamp()
            .setFooter({ text: `Ticket ID: ${user.id}` });

        // Add specific instructions based on ticket type
        switch (ticketType) {
            case 'partnership':
                embed.addFields({
                    name: '📋 Before we proceed, please:',
                    value: '• Check our partnership requirements in <#1399133673290465390>\n• If your server meets the requirements, find our ad in <#1395417037966409771>\n• Post our ad in your server and send a screenshot as proof\n• After providing proof, please send your server ad\n\nOur team will review your request and post your ad on the <#1395330304301990021> channel.',
                    inline: false
                });
                break;

            case 'devpoints':
                embed.addFields({
                    name: '📋 Please provide:',
                    value: '• What development work did you complete?\n• When did you complete it?\n• Any relevant links or proof\n• How many points do you think you deserve?\n\nOur team will review your request and allocate points accordingly.',
                    inline: false
                });
                break;

            case 'verification':
                embed.addFields({
                    name: '📋 To get verified, please provide:',
                    value: '• Links to your development work\n• GitHub profile & portfolio\n• Previous projects or contributions\n• Why you deserve verification status?\n\nOur verification team will review your application.',
                    inline: false
                });
                break;

            case 'hiring':
                // Create the hiring embed with available positions
                embed.setThumbnail(this.config.tickets.embed.thumbnail);
                
                embed.addFields({
                    name: '📋 Application Requirements:',
                    value: '• Which position are you applying for?\n• Tell us about your relevant experience\n• Why do you want to join our team?\n• What can you bring to this role?\n• Your availability and timezone\n\n*Please be detailed in your application. Our HR team will review it carefully.*',
                    inline: false
                });

                // Add status legend
                if (this.config.hiring && this.config.hiring.emojis) {
                    const emojis = this.config.hiring.emojis;
                    embed.addFields({
                        name: '📊 Status Legend:',
                        value: `${emojis.online} Available (Urgent) • ${emojis.idle} Open (Moderate) • ${emojis.offline} Filled`,
                        inline: false
                    });
                }

                // Add available positions (split by category to avoid character limit)
                if (this.config.hiring && this.config.hiring.positions) {
                    this.addPositionFields(embed);
                }
                break;
        }

        return embed;
    }

    addPositionFields(embed) {
        const positions = this.config.hiring.positions;
        const emojis = this.config.hiring.emojis;

        Object.entries(positions).forEach(([category, roles]) => {
            let categoryText = '';
            
            roles.forEach(role => {
                const statusEmoji = emojis[role.status] || '❓';
                let roleMention = role.role;
                if (role.role.startsWith('@') && role.roleId) {
                    roleMention = `<@&${role.roleId}>`;
                }
                categoryText += `${statusEmoji} ${roleMention} - ${role.description}\n`;
            });

            // Add each category as a separate field to avoid character limit
            embed.addFields({
                name: `💼 ${category}:`,
                value: categoryText.trim(),
                inline: false
            });
        });
    }

    async closeTicket(interaction) {
        try {
            const channel = interaction.channel;

            // Simplified check - only look for ticket- prefix
            if (!channel.name.startsWith('ticket-')) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels!',
                    flags: 64
                });
            }

            // Check if already being closed
            if (channel.deletable === false) {
                return await interaction.reply({
                    content: '⏳ This ticket is already being closed!',
                    flags: 64
                });
            }

            await interaction.reply({
                content: '🔒 Closing ticket...',
                flags: 64
            });

            // Lock channel immediately
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: false,
                ViewChannel: false
            });

            // Get ticket creator and type from the first embed in the channel
            let ticketType = 'Unknown';
            let ticketCreator = null;
            try {
                const messages = await channel.messages.fetch({ limit: 50 });
                const ticketMessage = messages.find(msg => 
                    msg.embeds.length > 0 && 
                    msg.embeds[0].footer && 
                    msg.embeds[0].footer.text.includes('Ticket ID:')
                );
                if (ticketMessage && ticketMessage.embeds[0]) {
                    if (ticketMessage.embeds[0].title) {
                        // Keep the full title with emojis (e.g., "🤝 Partnership")
                        ticketType = ticketMessage.embeds[0].title;
                    }
                    // Extract user ID from footer
                    const footerText = ticketMessage.embeds[0].footer.text;
                    const userIdMatch = footerText.match(/Ticket ID: (\d+)/);
                    if (userIdMatch) {
                        try {
                            ticketCreator = await this.client.users.fetch(userIdMatch[1]);
                        } catch (error) {
                            console.error('Error fetching ticket creator:', error);
                        }
                    }
                }
            } catch (error) {
                console.error('Error determining ticket details:', error);
            }

            // Get added users from channel topic
            const addedUserIds = channel.topic ? channel.topic.split(',').filter(id => id.trim()) : [];

            // Create transcript
            const transcript = await this.createTranscript(channel);

            // Send transcript to ticket creator
            if (ticketCreator) {
                await this.sendTranscriptToDM(ticketCreator, channel, transcript, ticketType);
            }

            // Send transcript to all added users
            for (const userId of addedUserIds) {
                try {
                    const addedUser = await this.client.users.fetch(userId);
                    if (addedUser && addedUser.id !== ticketCreator?.id) {
                        await this.sendTranscriptToDM(addedUser, channel, transcript, ticketType);
                    }
                } catch (error) {
                    console.error(`Error sending transcript to added user ${userId}:`, error);
                }
            }

            // Log to logs channel
            await this.logTicketClosure(channel, interaction.user, transcript, ticketType);

            // Countdown and delete
            for (let i = 3; i > 0; i--) {
                await interaction.editReply({
                    content: `⏳ Deleting channel in ${i} seconds...`
                });
                await this.delay(1000);
            }

            await channel.delete('Ticket closed');

        } catch (error) {
            console.error('❌ Error closing ticket:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Failed to close ticket.',
                    flags: 64
                });
            }
        }
    }

    async sendTranscriptToDM(user, channel, transcript, ticketType) {
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('📋 Your Ticket Transcript')
                .setDescription(`**Channel:** ${channel.name}\n**Type:** ${ticketType}\n**Closed at:** <t:${Math.floor(Date.now() / 1000)}:F>\n\nThank you for using our ticket system!`)
                .setColor(this.config.tickets.embed.color)
                .setTimestamp()
                .setFooter({ text: `${this.config.bot.name}` });

            await user.send({
                embeds: [dmEmbed],
                files: [{
                    attachment: Buffer.from(transcript),
                    name: `${channel.name}-transcript.txt`
                }]
            });

            console.log(`✅ Transcript sent to ${user.tag}'s DM`);
        } catch (error) {
            console.error(`❌ Failed to send transcript to ${user.tag}'s DM:`, error);
            // Don't throw error here so ticket closure continues even if DM fails
        }
    }

    async createTranscript(channel) {
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            return messages.reverse().map(msg => {
                const timestamp = new Date(msg.createdTimestamp).toLocaleString();
                return `[${timestamp}] ${msg.author.tag}: ${msg.content}`;
            }).join('\n');
        } catch (error) {
            console.error('Error creating transcript:', error);
            return 'Failed to create transcript';
        }
    }

    async logTicketClosure(channel, closedBy, transcript, ticketType = 'Unknown') {
        try {
            const logsChannel = this.client.channels.cache.get(this.client.getChannel('ticketLogs'));
            if (!logsChannel) return;

            const logEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket Closed')
                .setDescription(`**Channel:** ${channel.name}\n**Type:** ${ticketType}\n**Closed by:** ${closedBy.tag}\n**Closed at:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                .setColor(this.config.tickets.embed.color)
                .setTimestamp();

            await logsChannel.send({
                embeds: [logEmbed],
                files: [{
                    attachment: Buffer.from(transcript),
                    name: `${channel.name}-transcript.txt`
                }]
            });
        } catch (error) {
            console.error('Error logging ticket closure:', error);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = TicketManager;