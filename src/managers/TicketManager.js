const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require('discord.js');
const { version } = require('../../package.json');

class TicketManager {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.ticketCache = new Map(); // Cache for ticket metadata
    }

    // ==================== SETUP ====================
    
    async setupTicketSystem(channel) {
        try {
            const existingMessage = await this.findExistingTicketMessage(channel);
            
            if (existingMessage) {
                console.log('🎫 Ticket message already exists, skipping setup');
                return existingMessage;
            }

            const embed = this.createSetupEmbed(channel.guild);
            const selectMenu = this.createTicketSelectMenu();
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

    async findExistingTicketMessage(channel) {
        const messages = await channel.messages.fetch({ limit: 10 });
        return messages.find(msg => 
            msg.author.id === this.client.user.id && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title === this.config.tickets.embed.title
        );
    }

    createSetupEmbed(guild) {
        const embed = new EmbedBuilder()
            .setTitle(this.config.tickets.embed.title)
            .setDescription(this.config.tickets.embed.description)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }) || this.config.tickets.embed.thumbnail)
            .setColor(this.config.tickets.embed.color)
            .setFooter({ text: `${this.config.bot.name} v${version}` });

        return embed;
    }

    createTicketSelectMenu() {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_menu')
            .setPlaceholder('🎫 Select ticket type...')
            .setMinValues(1)
            .setMaxValues(1);

        Object.entries(this.config.tickets.types).forEach(([key, ticket]) => {
            selectMenu.addOptions({
                label: ticket.label,
                description: ticket.description,
                value: key,
                emoji: ticket.emoji
            });
        });

        return selectMenu;
    }

    // ==================== TICKET CREATION ====================
    
    async createTicket(interaction, ticketType) {
        try {
            await interaction.deferReply({ flags: 64 });

            const ticketConfig = this.config.tickets.types[ticketType];
            if (!ticketConfig) {
                return await interaction.editReply({
                    content: '❌ Invalid ticket type!'
                });
            }

            // Check for existing tickets
            const existingTicket = this.findExistingUserTicket(interaction.guild, interaction.user);
            if (existingTicket) {
                return await interaction.editReply({
                    content: `❌ You already have an open ticket: ${existingTicket}`
                });
            }

            // Create the ticket channel
            const ticketChannel = await this.createTicketChannel(
                interaction.guild, 
                interaction.user, 
                ticketConfig
            );

            // Setup ticket content
            await this.setupTicketContent(ticketChannel, ticketType, interaction.user, ticketConfig);

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

    findExistingUserTicket(guild, user) {
        return guild.channels.cache.find(channel => 
            channel.name === `ticket-${user.username.toLowerCase()}`
        );
    }

    async createTicketChannel(guild, user, ticketConfig) {
        const channelName = `ticket-${user.username.toLowerCase()}`;
        const permissionOverwrites = this.buildTicketPermissions(guild, user, ticketConfig);

        return await guild.channels.create({
            name: channelName,
            type: 0,
            parent: this.client.getChannel('ticketCategory'),
            permissionOverwrites
        });
    }

    buildTicketPermissions(guild, user, ticketConfig) {
        const permissions = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel, 
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ]
            },
            {
                id: this.client.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel, 
                    PermissionFlagsBits.SendMessages, 
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.ManageChannels
                ]
            }
        ];

        // Add role permissions
        const roleId = this.client.getRole(ticketConfig.role);
        if (roleId) {
            permissions.push({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel, 
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            });
        }

        return permissions;
    }

    async setupTicketContent(ticketChannel, ticketType, user, ticketConfig) {
        const ticketEmbed = this.createTicketEmbed(ticketType, user);
        const closeButton = this.createCloseButton();
        const row = new ActionRowBuilder().addComponents(closeButton);

        const roleId = this.client.getRole(ticketConfig.role);
        const roleMention = roleId ? `<@&${roleId}>` : '';

        await ticketChannel.send({
            content: `${user} ${roleMention}`,
            embeds: [ticketEmbed],
            components: [row]
        });

        // Cache ticket metadata
        this.ticketCache.set(ticketChannel.id, {
            type: ticketType,
            creatorId: user.id,
            createdAt: Date.now()
        });
    }

    createCloseButton() {
        return new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('🗑️ Close Ticket')
            .setStyle(ButtonStyle.Danger);
    }

    // ==================== TICKET EMBEDS ====================
    
    createTicketEmbed(ticketType, user) {
        const ticketConfig = this.config.tickets.types[ticketType];

        const embed = new EmbedBuilder()
            .setTitle(`${ticketConfig.emoji} ${ticketConfig.label}`)
            .setDescription(`Support will be with you shortly.\n\n**Created by:** ${user.tag}\n**Type:** ${ticketConfig.label}`)
            .setColor(this.config.tickets.embed.color)
            .setTimestamp()
            .setFooter({ text: `Ticket ID: ${user.id}` });

        // Add type-specific fields (pass the guild for thumbnail)
        this.addTicketTypeFields(embed, ticketType, user);

        return embed;
    }

    addTicketTypeFields(embed, ticketType, user) {
        const fieldConfigs = {
            partnership: {
                name: '📋 Before we proceed, please:',
                value: '• Check our partnership requirements in <#1399133673290465390>\n• If your server meets the requirements, find our ad in <#1395417037966409771>\n• Post our ad in your server and send a screenshot as proof\n• After providing proof, please send your server ad\n\nOur team will review your request and post your ad on the <#1395330304301990021> channel.'
            },
            devpoints: {
                name: '📋 Please provide:',
                value: '• What development work did you complete?\n• When did you complete it?\n• Any relevant links or proof\n• How many points do you think you deserve?\n\nOur team will review your request and allocate points accordingly.'
            },
            verification: {
                name: '📋 To get verified, please provide:',
                value: '• Links to your development work\n• GitHub profile & portfolio\n• Previous projects or contributions\n• Why you deserve verification status?\n\nOur verification team will review your application.'
            },
            hiring: null // Special handling below
        };

        if (ticketType === 'hiring') {
            this.addHiringFields(embed, user);
        } else if (fieldConfigs[ticketType]) {
            embed.addFields(fieldConfigs[ticketType]);
        }
    }

    addHiringFields(embed, user) {
        // Get guild from user's client (more reliable)
        const guild = this.client.guilds.cache.first();
        
        if (guild && guild.iconURL()) {
            embed.setThumbnail(guild.iconURL({ dynamic: true, size: 512 }));
        } else {
            embed.setThumbnail(this.config.tickets.embed.thumbnail);
        }
        
        embed.addFields({
            name: '📋 Application Requirements:',
            value: '• Which position are you applying for?\n• Tell us about your relevant experience\n• Why do you want to join our team?\n• What can you bring to this role?\n• Your availability and timezone\n\n*Please be detailed in your application. Our HR team will review it carefully.*',
            inline: false
        });

        // Add status legend
        if (this.config.hiring?.emojis) {
            const emojis = this.config.hiring.emojis;
            embed.addFields({
                name: '📊 Status Legend:',
                value: `${emojis.online} Available (Urgent) • ${emojis.idle} Open (Moderate) • ${emojis.offline} Filled`,
                inline: false
            });
        }

        // Add available positions from database
        this.addPositionFields(embed);
    }

    addPositionFields(embed) {
        const positionsManager = this.client.positionsManager;
        
        if (!positionsManager || !positionsManager.hasPositions()) {
            embed.addFields({
                name: '💼 Available Positions',
                value: '*No positions currently available. Check back later!*',
                inline: false
            });
            return;
        }

        const departments = positionsManager.getPositionsByDepartment();
        const emojis = this.config.hiring.emojis;

        const departmentEmojis = {
            'Leadership': '👑',
            'Management': '🛡️',
            'Marketing': '📢',
            'Operations': '⚙️',
            'Developer Relations': '💻'
        };

        for (const [department, positions] of departments) {
            const positionsList = positions.map(pos => {
                const statusEmoji = emojis[pos.status] || '❓';
                const noteText = pos.note ? ` - ${pos.note}` : '';
                return `${statusEmoji} <@&${pos.roleId}>${noteText}`;
            }).join('\n');

            const deptEmoji = departmentEmojis[department] || '📁';

            embed.addFields({
                name: `${deptEmoji} ${department}`,
                value: positionsList,
                inline: false
            });
        }
    }

    // ==================== TICKET CLOSURE ====================
    
    async closeTicket(interaction) {
        try {
            const channel = interaction.channel;

            if (!this.isTicketChannel(channel)) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels!',
                    flags: 64
                });
            }

            if (!channel.deletable) {
                return await interaction.reply({
                    content: '⏳ This ticket is already being closed!',
                    flags: 64
                });
            }

            await interaction.reply({
                content: '🔒 Closing ticket...',
                flags: 64
            });

            // Lock the channel
            await this.lockChannel(channel);

            // Get ticket metadata
            const metadata = await this.getTicketMetadata(channel);

            // Get added users
            const addedUserIds = this.getAddedUsers(channel.id);

            // Create and distribute transcript
            const transcript = await this.createTranscript(channel);
            await this.distributeTranscript(channel, metadata, transcript, addedUserIds);

            // Log closure
            await this.logTicketClosure(channel, interaction.user, transcript, metadata.ticketType);

            // Cleanup
            this.cleanup(channel.id);

            // Delete channel with countdown
            await this.deleteChannelWithCountdown(interaction, channel);

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

    isTicketChannel(channel) {
        return channel.name.startsWith('ticket-');
    }

    async lockChannel(channel) {
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            SendMessages: false,
            ViewChannel: false
        });
    }

    async getTicketMetadata(channel) {
        // Try cache first
        if (this.ticketCache.has(channel.id)) {
            const cached = this.ticketCache.get(channel.id);
            const creator = await this.client.users.fetch(cached.creatorId).catch(() => null);
            const ticketConfig = this.config.tickets.types[cached.type];
            return {
                ticketType: `${ticketConfig.emoji} ${ticketConfig.label}`,
                ticketCreator: creator
            };
        }

        // Fallback to fetching from messages and cache it for next time
        const metadata = await this.getTicketMetadataFromMessages(channel);
        
        // Try to cache it if we successfully extracted metadata
        if (metadata.ticketCreator && metadata.ticketType !== 'Unknown') {
            // Find the matching ticket type key
            for (const [key, config] of Object.entries(this.config.tickets.types)) {
                const expectedTitle = `${config.emoji} ${config.label}`;
                if (metadata.ticketType === expectedTitle) {
                    this.ticketCache.set(channel.id, {
                        type: key,
                        creatorId: metadata.ticketCreator.id,
                        createdAt: Date.now()
                    });
                    break;
                }
            }
        }
        
        return metadata;
    }

    async getTicketMetadataFromMessages(channel) {
        let ticketType = 'Unknown';
        let ticketCreator = null;

        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const ticketMessage = messages.find(msg => 
                msg.embeds.length > 0 && 
                msg.embeds[0].footer?.text.includes('Ticket ID:')
            );

            if (ticketMessage?.embeds[0]) {
                ticketType = ticketMessage.embeds[0].title || 'Unknown';
                
                const footerText = ticketMessage.embeds[0].footer.text;
                const userIdMatch = footerText.match(/Ticket ID: (\d+)/);
                
                if (userIdMatch) {
                    ticketCreator = await this.client.users.fetch(userIdMatch[1]).catch(() => null);
                }
            }
        } catch (error) {
            console.error('Error fetching ticket metadata:', error);
        }

        return { ticketType, ticketCreator };
    }

    // ==================== CACHE RESTORATION ====================
    
    async restoreTicketCache() {
        try {
            const categoryId = this.client.getChannel('ticketCategory');
            if (!categoryId) return;

            const category = await this.client.channels.fetch(categoryId).catch(() => null);
            if (!category) return;

            const ticketChannels = category.children.cache.filter(
                channel => channel.name.startsWith('ticket-')
            );

            console.log(`🔄 Restoring cache for ${ticketChannels.size} tickets...`);

            for (const [channelId, channel] of ticketChannels) {
                try {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    const ticketMessage = messages.find(msg => 
                        msg.embeds.length > 0 && 
                        msg.embeds[0].footer?.text.includes('Ticket ID:')
                    );

                    if (ticketMessage?.embeds[0]) {
                        const embed = ticketMessage.embeds[0];
                        const footerText = embed.footer.text;
                        const userIdMatch = footerText.match(/Ticket ID: (\d+)/);
                        
                        if (userIdMatch && embed.title) {
                            // Extract ticket type from emoji
                            let ticketTypeKey = 'support'; // default
                            
                            for (const [key, config] of Object.entries(this.config.tickets.types)) {
                                const expectedTitle = `${config.emoji} ${config.label}`;
                                if (embed.title === expectedTitle) {
                                    ticketTypeKey = key;
                                    break;
                                }
                            }

                            // Restore to cache
                            this.ticketCache.set(channelId, {
                                type: ticketTypeKey,
                                creatorId: userIdMatch[1],
                                createdAt: ticketMessage.createdTimestamp
                            });

                            console.log(`✅ Restored: ${channel.name} (${ticketTypeKey})`);
                        }
                    }
                } catch (error) {
                    console.error(`Error restoring cache for ${channel.name}:`, error);
                }
            }

            console.log(`✅ Ticket cache restoration complete`);
        } catch (error) {
            console.error('Error during ticket cache restoration:', error);
        }
    }

    getAddedUsers(channelId) {
        return this.client.ticketUsersManager.getAddedUsers(channelId);
    }

    async distributeTranscript(channel, metadata, transcript, addedUserIds) {
        // Send to ticket creator
        if (metadata.ticketCreator) {
            await this.sendTranscriptToDM(
                metadata.ticketCreator, 
                channel, 
                transcript, 
                metadata.ticketType
            );
        }

        // Send to added users
        for (const userId of addedUserIds) {
            if (userId === metadata.ticketCreator?.id) continue;
            
            try {
                const user = await this.client.users.fetch(userId);
                await this.sendTranscriptToDM(user, channel, transcript, metadata.ticketType);
            } catch (error) {
                console.error(`Error sending transcript to user ${userId}:`, error);
            }
        }
    }

    cleanup(channelId) {
        this.client.ticketUsersManager.clearTicket(channelId);
        this.ticketCache.delete(channelId);
    }

    async deleteChannelWithCountdown(interaction, channel) {
        for (let i = 3; i > 0; i--) {
            await interaction.editReply({
                content: `⏳ Deleting channel in ${i} seconds...`
            });
            await this.delay(1000);
        }

        await channel.delete('Ticket closed');
    }

    // ==================== TRANSCRIPT HANDLING ====================
    
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

    async sendTranscriptToDM(user, channel, transcript, ticketType) {
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('📋 Your Ticket Transcript')
                .setDescription(`**Channel:** ${channel.name}\n**Type:** ${ticketType}\n**Closed at:** <t:${Math.floor(Date.now() / 1000)}:F>\n\nThank you for using our ticket system!`)
                .setColor(this.config.tickets.embed.color)
                .setTimestamp()
                .setFooter({ text: this.config.bot.name });

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
        }
    }

    async logTicketClosure(channel, closedBy, transcript, ticketType = 'Unknown') {
        try {
            const logsChannel = this.client.channels.cache.get(
                this.client.getChannel('ticketLogs')
            );
            
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

    // ==================== UTILITIES ====================
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = TicketManager;