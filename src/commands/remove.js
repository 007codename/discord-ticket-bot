const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a user from the current ticket')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove from this ticket')
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
        
        // Prevent removing the bot
        if (user.id === client.user.id) {
            return await interaction.reply({
                content: '❌ You cannot remove the bot from this ticket!',
                flags: 64
            });
        }
        
        // Prevent removing the ticket creator
        // Extract user ID from ticket name (ticket-username format)
        const ticketOwnerName = channel.name.replace('ticket-', '');
        const ticketOwner = channel.guild.members.cache.find(
            member => member.user.username.toLowerCase() === ticketOwnerName
        );
        
        if (ticketOwner && user.id === ticketOwner.id) {
            return await interaction.reply({
                content: '❌ You cannot remove the ticket creator!',
                flags: 64
            });
        }
        
        // Check if user has access to the ticket
        const hasAccess = channel.permissionOverwrites.cache.has(user.id);
        if (!hasAccess) {
            return await interaction.reply({
                content: `❌ ${user} doesn't have access to this ticket!`,
                flags: 64
            });
        }
        
        try {
            // Delete the permission overwrite completely
            await channel.permissionOverwrites.delete(user);
            
            // Remove user from tracked added users in channel topic
            const currentTopic = channel.topic || '';
            const addedUsers = currentTopic ? currentTopic.split(',') : [];
            const filteredUsers = addedUsers.filter(id => id !== user.id);
            
            if (filteredUsers.length > 0) {
                await channel.setTopic(filteredUsers.join(','));
            } else {
                await channel.setTopic('');
            }
            
            await interaction.reply({
                content: `✅ ${user} has been removed from this ticket!`,
                flags: 64
            });
            
            // Notify about the removal
            await channel.send({
                content: `${user} has been removed from this ticket by ${interaction.user}.`
            });
        } catch (error) {
            console.error('Error removing user from ticket:', error);
            await interaction.reply({
                content: '❌ Failed to remove user from this ticket. Please try again.',
                flags: 64
            });
        }
    }
};