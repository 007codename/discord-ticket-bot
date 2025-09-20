const { SlashCommandBuilder } = require('discord.js');
const TicketManager = require('../utils/ticketManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close the current ticket'),
    async execute(interaction) {
        const channel = interaction.channel;
        
        // Check if this is a ticket channel
        if (!channel.name.startsWith('ticket-')) {
            return await interaction.reply({
                content: 'This command can only be used in ticket channels!',
                flags: 64
            });
        }

        // Close the ticket
        await TicketManager.closeTicket(interaction);
    }
};