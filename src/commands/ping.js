const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot\'s latency and API response time'),
    
    async execute(interaction, client) {
        const sent = Date.now();
        
        await interaction.deferReply();
        
        const latency = Date.now() - sent;
        const apiLatency = client.ws.ping;
        
        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .setColor('#006AD7')
            .addFields(
                { name: '📡 Bot Latency', value: `${latency}ms`, inline: true },
                { name: '🔗 API Latency', value: `${apiLatency}ms`, inline: true },
                { name: '⏱️ Uptime', value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: client.config.bot.name });

        await interaction.editReply({ embeds: [embed] });
    }
};