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
        await interaction.deferReply({ flags: 64 });
        const channel = interaction.channel;
        const user = interaction.options.getUser('user');
        
        if (!channel.name.startsWith('ticket-')) {
            return await interaction.editReply({
                content: '❌ This command can only be used in ticket channels!'
            });
        }
        
        const hasAccess = channel.permissionOverwrites.cache.has(user.id);
        if (hasAccess) {
            return await interaction.editReply({
                content: `❌ ${user} already has access to this ticket!`
            });
        }
        
        try {
            await channel.permissionOverwrites.create(user, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            });
            
            // Use persistent database (survives restarts)
            await client.ticketUsersManager.addUser(channel.id, user.id);
            
            await interaction.editReply({
                content: `✅ ${user} has been added to this ticket!`
            });
            
            await channel.send({
                content: `${user}, you have been added to this ticket by ${interaction.user}.`
            });
        } catch (error) {
            console.error('Error adding user to ticket:', error);
            await interaction.editReply({
                content: '❌ Failed to add user to this ticket. Please try again.'
            });
        }
    }
};