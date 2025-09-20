const { ActivityType } = require('discord.js');
const TicketManager = require('../utils/ticketManager.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Logged in as ${client.user.tag}`);

        // setInterval(() => {
        //    console.log(`Heartbeat: ${Date.now()} | API Ping: ${client.ws.ping}ms`);
        // }, 10000);
        
        // Status messages array
        const statusMessages = [
            { text: '📩 your tickets', type: ActivityType.Watching },
            { text: '🎫 /ticket', type: ActivityType.Listening },
            { text: 'over the server', type: ActivityType.Watching },
            { text: 'DEV: 007codename', type: ActivityType.Custom },
            { text: '💬 support requests', type: ActivityType.Watching }
        ];
        
        let currentIndex = 0;

        // Set initial presence
        client.user.setPresence({
            activities: [{
                name: statusMessages[0].text,
                type: statusMessages[0].type,
            }],
            status: 'online'
        });

        // Rotate status every 15 seconds
        setInterval(() => {
            currentIndex = (currentIndex + 1) % statusMessages.length;
            client.user.setPresence({
                activities: [{
                    name: statusMessages[currentIndex].text,
                    type: statusMessages[currentIndex].type,
                }],
                status: 'online'
            });
        }, 15000);

        try {
            // Try to fetch support channel
            const supportChannel = await client.channels.fetch(process.env.SUPPORT_CHANNEL_ID)
                .catch(error => {
                    if (error.code === 50001) {
                        console.error('❌ Bot does not have access to the support channel!');
                        console.error('Please make sure:');
                        console.error('1. The channel ID is correct');
                        console.error('2. The bot has been invited with correct permissions');
                        console.error('3. The bot has "View Channel" permission in the channel');
                    }
                    return null;
                });

            if (!supportChannel) {
                console.error('Could not set up ticket system - Support channel not accessible');
                return;
            }

            // Try to fetch ticket category
            const ticketCategory = await client.channels.fetch(process.env.TICKET_CATEGORY_ID)
                .catch(error => {
                    if (error.code === 50001) {
                        console.error('❌ Bot does not have access to the ticket category!');
                        console.error('Please make sure:');
                        console.error('1. The category ID is correct');
                        console.error('2. The bot has "View Channel" permission in the category');
                    }
                    return null;
                });

            if (!ticketCategory) {
                console.error('Could not set up ticket system - Ticket category not accessible');
                return;
            }

            // Try to fetch logs channel
            const logsChannel = await client.channels.fetch(process.env.TICKET_LOGS_CHANNEL_ID)
                .catch(error => {
                    if (error.code === 50001) {
                        console.error('❌ Bot does not have access to the logs channel!');
                        console.error('Please make sure:');
                        console.error('1. The logs channel ID is correct');
                        console.error('2. The bot has "View Channel" and "Send Messages" permissions');
                    }
                    return null;
                });

            if (!logsChannel) {
                console.error('Could not set up ticket system - Logs channel not accessible');
                return;
            }

            // If all channels are accessible, set up the ticket system
            await TicketManager.setupTicketSystem(supportChannel);
            console.log('✅ Ticket system successfully initialized!');

        } catch (error) {
            console.error('An error occurred while setting up the ticket system:', error);
        }
    }
};