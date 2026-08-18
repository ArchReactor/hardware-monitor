import { EmbedBuilder } from "discord.js";

const ONE_DAY = 24 * 60 * 60 * 1000;
const REPOST_AFTER = 4; //other messages before the card gets moved back to the bottom

export function formatTimeSeconds(seconds) {
    if (seconds === 0) return "N/A";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
}

export async function updateStatus(printer, bot) {
    if(bot.globalConfig.disableDiscord) {
        console.log(`[INFO] Discord updates are disabled in config.json`, JSON.stringify({
            name: printer.name,
            status: printer.status,
            remainingTimeFormatted: printer.remainingTimeFormatted,
			finishedAt: printer.finishedAt,
        }));
        return;
    }; //log only if disabled
    const guild = bot.guilds.cache.get(bot.globalConfig.guildId);
    const channel = guild?.channels.cache.get(bot.globalConfig.channelId);
    if(!channel) {
        console.error(`[ERROR] Discord channel ${bot.globalConfig.channelId} not found, skipping update for ${printer.name}`);
        return;
    }
    //first check for past embeds
    if(!printer.embed) {
        const messages = await channel.messages.fetch({ limit: 100 });
        printer.embed = messages.filter(msg => 
            msg.createdTimestamp > Date.now() - ONE_DAY && //only check last 1 days
            msg.author.username === bot.user.username && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title === `Printer Status ${printer.name}` &&
            msg.embeds[0].description?.includes('Active print task') //only grab if still in printing
        ).first();
    }
    //then add or update embed, if currently completed make a new one
    if(!printer.embed || printer.embed.createdTimestamp < Date.now() - ONE_DAY) { //create new embed if not found or older than 1 day
        if(printer.status === "Printing") { //don't create unless printing
            printer.embed = await channel.send({embeds: [{ 
                title: `Printer Status ${printer.name}`, 
                description: 'Active print task' + (printer.currentFile ? `: ${printer.currentFile}` : ''),
                fields: [
                    { name: 'Status', value: `${printer.status} (${printer.printProgress}%)`, inline: true },
                    { name: 'Estimated Time', value: printer.remainingTimeFormatted, inline: true },
                ]
            }]}); 
            printer.messagesSince = 0;
        }
    } else { //do an edit
        const newEmb = EmbedBuilder.from(printer.embed.embeds[0]);
        newEmb.setFields([
            { name: 'Status', value: `${printer.status} (${printer.printProgress}%)`, inline: true },
            { name: 'Estimated Time', value: printer.remainingTimeFormatted, inline: true },
        ]);
        const finished = printer.status === "Completed" || printer.status === "Error" || printer.status === "Cancelled";
        if(finished) {
            newEmb.setDescription('Print task finished at ' + printer.finishedAt);
        }
        if(printer.messagesSince >= REPOST_AFTER) { //card has scrolled up, put it back at the bottom
            await printer.embed.delete().catch(() => {}); //might already be gone
            printer.embed = await channel.send({ embeds: [newEmb] });
            printer.messagesSince = 0;
        } else {
            await printer.embed.edit({ embeds: [newEmb]});
        }
        console.log(`[INFO] Updated Discord embed for printer ${printer.name}`, JSON.stringify({
            name: printer.name,
            editedTimestamp: printer.embed.editedTimestamp,
        }));
        if(finished) {
            printer.embed = null; //let the next print start its own card
        }
    }

}