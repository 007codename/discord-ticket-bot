const { SlashCommandBuilder } = require('discord.js');
const TicketManager = require('../utils/ticketManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a support ticket')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of ticket you want to create')
                .setRequired(true)
                .addChoices(
                    { name: 'General Support', value: 'support' },
                    { name: 'Report', value: 'report' },
                    { name: 'Partnership', value: 'partnership' }
                )),
    async execute(interaction) {
        const type = interaction.options.getString('type');
        await TicketManager.createTicket(interaction, type);
    }
};