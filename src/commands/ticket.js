const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a support ticket')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Select the type of ticket you want to create')
                .setRequired(true)
                .addChoices(
                    { name: '❓ General Support', value: 'support' },
                    { name: '🚨 Report', value: 'report' },
                    { name: '🤝 Partnership', value: 'partnership' },
                    { name: '⭐ Dev Points Request', value: 'devpoints' },
                    { name: '✅ Developer Verification', value: 'verification' },
                    { name: '💼 Apply for Position', value: 'hiring' }
                )),

    async execute(interaction, client) {
        const ticketType = interaction.options.getString('type');
        await client.ticketManager.createTicket(interaction, ticketType);
    }
};