import { Client, Collection, EmbedBuilder, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import config from './config.json' with { type: "json" };
// Create a new client instance
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
bot.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
bot.login(config.token);

setTimeout(async () => {
    const guild = bot.guilds.cache.get(config.guildId);
    const channel = guild.channels.cache.get(config.channelId); 

    const messages = await channel.messages.fetch({ limit: 10 });

    console.log("fetched messages", messages);

    console.log('current user', bot.user);

    messages.forEach(msg => {
        console.log("author", msg.author);
    });    
}, 5000);
