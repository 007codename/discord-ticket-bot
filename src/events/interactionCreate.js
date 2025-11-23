module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Simple cooldown to prevent spam
        if (!client.interactionCooldowns) client.interactionCooldowns = new Map();
       
        const cooldownKey = `${interaction.user.id}-${interaction.customId || interaction.commandName}`;
        const now = Date.now();
        const cooldownTime = 2000; // 2 seconds
       
        if (client.interactionCooldowns.has(cooldownKey)) {
            const expirationTime = client.interactionCooldowns.get(cooldownKey) + cooldownTime;
            if (now < expirationTime) {
                return;
            }
        }
       
        client.interactionCooldowns.set(cooldownKey, now);
       
        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
               
                if (!command) {
                    console.warn(`❌ Unknown command: ${interaction.commandName}`);
                    return;
                }
                
                try {
                    await command.execute(interaction, client);
                } catch (error) {
                    console.error(`❌ Command error (${interaction.commandName}):`, error);
                   
                    const errorResponse = {
                        content: '❌ Something went wrong while executing this command!',
                        flags: 64
                    };
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply(errorResponse);
                    } else {
                        await interaction.editReply(errorResponse);
                    }
                }
            }
            
            // Handle select menus
            if (interaction.isStringSelectMenu()) {
                // Check if it's a positions command select menu
                if (interaction.customId.startsWith('select_')) {
                    // These are handled by the positions command itself via awaitMessageComponent
                    return;
                }

                switch (interaction.customId) {
                    case 'ticket_menu':
                        const ticketType = interaction.values[0];
                        await client.ticketManager.createTicket(interaction, ticketType);
                        break;
                   
                    default:
                        console.warn(`❌ Unknown select menu: ${interaction.customId}`);
                        break;
                }
            }
            
            // Handle buttons
            if (interaction.isButton()) {
                switch (interaction.customId) {
                    case 'close_ticket':
                        await client.ticketManager.closeTicket(interaction);
                        break;
                   
                    default:
                        console.warn(`❌ Unknown button: ${interaction.customId}`);
                        break;
                }
            }
        } catch (error) {
            console.error('❌ Interaction handling error:', error);
           
            try {
                const errorResponse = {
                    content: '❌ An unexpected error occurred!',
                    flags: 64
                };
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply(errorResponse);
                } else {
                    await interaction.editReply(errorResponse);
                }
            } catch (replyError) {
                console.error('❌ Failed to send error response:', replyError);
            }
        }
    }
};