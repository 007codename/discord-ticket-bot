const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const config = require('./config.json');

class TicketBot extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent
            ]
        });
        
        // Set max listeners to prevent warnings
        this.setMaxListeners(0);
        
        this.commands = new Collection();
        this.tickets = new Collection();
        this.config = config;
        
        this.init();
    }

    async init() {
        this.loadCommands();
        this.loadEvents();
        await this.login(process.env.TOKEN);
    }

    loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        const commandFolders = fs.readdirSync(commandsPath);
        
        for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            if (!fs.statSync(folderPath).isDirectory()) continue;
            
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);
                
                if (command.data && command.execute) {
                    this.commands.set(command.data.name, command);
                }
            }
        }
        
        console.log(`🎟️ Loaded ${this.commands.size} commands`);
    }

    loadEvents() {
        const eventsPath = path.join(__dirname, 'events');
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
        
        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);
            
            if (event.once) {
                this.once(event.name, (...args) => event.execute(...args, this));
            } else {
                this.on(event.name, (...args) => event.execute(...args, this));
            }
        }
        
        console.log(`🎟️ Loaded ${eventFiles.length} events`);
    }

    async deployCommands() {
        const commands = [];
        
        this.commands.forEach(command => {
            commands.push(command.data.toJSON());
        });

        const rest = new REST().setToken(process.env.TOKEN);
        
        try {
            console.log(`🎟️ Refreshing ${commands.length} global commands...`);
            
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            
            console.log(`🎟️ Successfully loaded ${data.length} global commands`);
        } catch (error) {
            console.error('❌ Error deploying commands:', error);
        }
    }

    getRole(roleKey) {
        return this.config.roles[roleKey];
    }

    getChannel(channelKey) {
        return this.config.channels[channelKey];
    }
}

// Create and start the bot
const bot = new TicketBot();

// Graceful shutdown handlers
process.on('SIGTERM', () => {
    console.log('TicketBot: Received SIGTERM, shutting down gracefully...');
    bot.destroy();
});

process.on('SIGINT', () => {
    console.log('TicketBot: Received SIGINT, shutting down gracefully...');
    bot.destroy();
});

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

module.exports = bot;