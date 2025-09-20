const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Shows the bot\'s latency and API ping'),
    async execute(interaction) {
        const sent = Date.now();
        const apiLatency = interaction.client.ws.ping;
        const latency = sent - interaction.createdTimestamp;

        await interaction.reply(`\`\`\`xl
Latency: ${latency}ms
API Latency: ${apiLatency}ms
\`\`\``);
    }
};
