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
        await interaction.deferReply({ flags: 64 });

        const channel = interaction.channel;
        const user = interaction.options.getUser('user');
        
        if (!channel.name.startsWith('ticket-')) {
            return await interaction.editReply({
                content: '❌ This command can only be used in ticket channels!'
            });
        }
        
        if (user.id === client.user.id) {
            return await interaction.editReply({
                content: '❌ You cannot remove the bot from this ticket!'
            });
        }
        
        const ticketOwnerName = channel.name.replace('ticket-', '');
        const ticketOwner = channel.guild.members.cache.find(
            member => member.user.username.toLowerCase() === ticketOwnerName
        );
        
        if (ticketOwner && user.id === ticketOwner.id) {
            return await interaction.editReply({
                content: '❌ You cannot remove the ticket creator!'
            });
        }
        
        const hasAccess = channel.permissionOverwrites.cache.has(user.id);
        if (!hasAccess) {
            return await interaction.editReply({
                content: `❌ ${user} doesn't have access to this ticket!`
            });
        }
        
        try {
            await channel.permissionOverwrites.delete(user);
            
            // Remove from in-memory cache (INSTANT)
            if (client.ticketAddedUsers.has(channel.id)) {
                client.ticketAddedUsers.get(channel.id).delete(user.id);
                
                // Clean up empty sets
                if (client.ticketAddedUsers.get(channel.id).size === 0) {
                    client.ticketAddedUsers.delete(channel.id);
                }
            }
            
            console.log(`✅ User ${user.tag} removed from ticket ${channel.name}`);
            console.log(`📋 Remaining added users: ${client.ticketAddedUsers.has(channel.id) ? Array.from(client.ticketAddedUsers.get(channel.id)).join(', ') : 'none'}`);
            
            await interaction.editReply({
                content: `✅ ${user} has been removed from this ticket!`
            });
            
            await channel.send({
                content: `${user} has been removed from this ticket by ${interaction.user}.`
            });
        } catch (error) {
            console.error('Error removing user from ticket:', error);
            await interaction.editReply({
                content: '❌ Failed to remove user from this ticket. Please try again.'
            });
        }
    }
};