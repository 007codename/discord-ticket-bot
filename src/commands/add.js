const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a user to the current ticket')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add to this ticket')
                .setRequired(true)),
    async execute(interaction, client) {
        const channel = interaction.channel;
        const user = interaction.options.getUser('user');

        // Check if command is used in a ticket channel
        if (!channel.name.startsWith('ticket-')) {
            return await interaction.reply({
                content: '❌ This command can only be used in ticket channels!',
                flags: 64
            });
        }

        // Check if user is already in the ticket
        const hasAccess = channel.permissionOverwrites.cache.has(user.id);
        if (hasAccess) {
            return await interaction.reply({
                content: `❌ ${user} already has access to this ticket!`,
                flags: 64
            });
        }

        try {
            // Add user to ticket with view and send permissions
            await channel.permissionOverwrites.create(user, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            });

            // Track added users in channel topic
            const currentTopic = channel.topic || '';
            const addedUsers = currentTopic ? currentTopic.split(',') : [];
            if (!addedUsers.includes(user.id)) {
                addedUsers.push(user.id);
                await channel.setTopic(addedUsers.join(','));
            }

            await interaction.reply({
                content: `✅ ${user} has been added to this ticket!`,
                flags: 64
            });

            // Notify the added user
            await channel.send({
                content: `${user}, you have been added to this ticket by ${interaction.user}.`
            });

        } catch (error) {
            console.error('Error adding user to ticket:', error);
            await interaction.reply({
                content: '❌ Failed to add user to this ticket. Please try again.',
                flags: 64
            });
        }
    }
};