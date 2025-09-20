const TicketManager = require('../utils/ticketManager.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (interaction.isCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error('Command execution error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'There was an error executing this command!',
                            ephemeral: true
                        });
                    }
                }
            }

            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'ticket_menu') {
                    await TicketManager.createTicket(interaction, interaction.values[0]);
                }
            }

            if (interaction.isButton()) {
                if (interaction.customId === 'close_ticket') {
                    await TicketManager.closeTicket(interaction);
                }
            }
        } catch (error) {
            console.error('Interaction handling error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while processing your request.',
                    ephemeral: true
                });
            }
        }
    }
};