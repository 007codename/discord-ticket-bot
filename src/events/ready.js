const { ActivityType } = require('discord.js');
const TicketManager = require('../managers/TicketManager');
const PositionsManager = require('../managers/PositionsManager');
const TicketUsersManager = require('../managers/TicketUsersManager');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`🎟️ ${client.user.tag} is online!`);
        
        let hasErrors = false;
        
        try {
            // Deploy global commands
            await client.deployCommands();
            console.log('🎟️  Commands deployed successfully');
        } catch (error) {
            console.error('🎟️ ❌ Error deploying commands:', error);
            hasErrors = true;
        }

        try {
            // Initialize ticket users manager
            client.ticketUsersManager = new TicketUsersManager(client);
            await client.ticketUsersManager.initialize();
            console.log('🎟️  Ticket users manager initialized');
        } catch (error) {
            console.error('🎟️ ❌ Error initializing ticket users manager:', error);
            hasErrors = true;
        }

        try {
            // Initialize positions manager
            client.positionsManager = new PositionsManager(client);
            await client.positionsManager.initialize();
            console.log('🎟️  Positions manager initialized');
        } catch (error) {
            console.error('🎟️ ❌ Error initializing positions manager:', error);
            hasErrors = true;
        }

        try {
            // Initialize ticket manager
            client.ticketManager = new TicketManager(client);
            console.log('🎟️  Ticket manager initialized');
        } catch (error) {
            console.error('🎟️ ❌ Error initializing ticket manager:', error);
            hasErrors = true;
        }

        // Setup presence rotation
        setupPresence(client);
        
        // Setup ticket system
        const ticketSetupSuccess = await setupTicketSystem(client);
        if (!ticketSetupSuccess) {
            hasErrors = true;
        }
        
        // Restore ticket cache after restart
        try {
            await client.ticketManager.restoreTicketCache();
        } catch (error) {
            console.error('🎟️ ❌ Error restoring ticket cache:', error);
        }
        
        console.log('🎟️  Bot initialization complete!');
    }
};

function setupPresence(client) {
    try {
        const activities = client.config.presence.activities;
        let currentIndex = 0;
        
        // Set initial presence
        client.user.setPresence({
            activities: [{
                name: activities[0].text,
                type: ActivityType[activities[0].type]
            }],
            status: 'online'
        });
        
        // Rotate presence with error handling
        const presenceInterval = setInterval(() => {
            try {
                currentIndex = (currentIndex + 1) % activities.length;
                const activity = activities[currentIndex];
               
                client.user.setPresence({
                    activities: [{
                        name: activity.text,
                        type: ActivityType[activity.type]
                    }],
                    status: 'online'
                });
            } catch (error) {
                console.error('🎟️ ❌ Error updating presence:', error);
            }
        }, client.config.presence.interval);

        // Clean up interval on client destroy
        client.once('destroy', () => {
            clearInterval(presenceInterval);
        });
        
        console.log('🎟️ Presence rotation started');
    } catch (error) {
        console.error('🎟️ ❌ Error setting up presence:', error);
    }
}

async function setupTicketSystem(client) {
    try {
        // Verify all required channels and roles exist
        const supportChannelId = client.getChannel('support');
        const categoryId = client.getChannel('ticketCategory');
        const logsChannelId = client.getChannel('ticketLogs');
        
        // Fetch channels with better error handling
        const [supportChannel, category, logsChannel] = await Promise.allSettled([
            client.channels.fetch(supportChannelId),
            client.channels.fetch(categoryId),
            client.channels.fetch(logsChannelId)
        ]);

        // Check if channels were fetched successfully
        if (supportChannel.status !== 'fulfilled' || !supportChannel.value) {
            console.error('🎟️ ❌ Support channel not found or inaccessible');
            return false;
        }

        if (category.status !== 'fulfilled' || !category.value) {
            console.error('🎟️ ❌ Ticket category not found or inaccessible');
            return false;
        }

        if (logsChannel.status !== 'fulfilled' || !logsChannel.value) {
            console.error('🎟️ ❌ Logs channel not found or inaccessible');
            return false;
        }

        // Verify roles exist
        const guild = supportChannel.value.guild;
        const requiredRoles = ['staff', 'partnership', 'devPointsManager', 'verificationTeam'];
       
        for (const roleKey of requiredRoles) {
            try {
                const roleId = client.getRole(roleKey);
                const role = guild.roles.cache.get(roleId);
               
                if (!role) {
                    console.warn(`🎟️ ⚠️ Role ${roleKey} (${roleId}) not found`);
                } else {
                    console.log(`🎟️  Role ${roleKey} verified`);
                }
            } catch (error) {
                console.error(`🎟️ ❌ Error checking role ${roleKey}:`, error);
            }
        }

        // Setup ticket system
        await client.ticketManager.setupTicketSystem(supportChannel.value);
        console.log('🎟️ Ticket system setup complete');
        return true;
        
    } catch (error) {
        console.error('🎟️ ❌ Failed to setup ticket system:', error);
        return false;
    }
}