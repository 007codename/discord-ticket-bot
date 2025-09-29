const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close the current ticket channel'),
   
    async execute(interaction, client) {
        const channel = interaction.channel;
       
        // Check if this is in the ticket category
        const ticketCategoryId = client.getChannel('ticketCategory');
        const isInTicketCategory = channel.parentId === ticketCategoryId;
       
        // Simplified channel name check - only look for ticket- prefix
        const isTicketChannel = channel.name.startsWith('ticket-');
       
        if (!isInTicketCategory && !isTicketChannel) {
            return await interaction.reply({
                content: '❌ This command can only be used in ticket channels!',
                flags: 64
            });
        }
       
        await client.ticketManager.closeTicket(interaction);
    }
};