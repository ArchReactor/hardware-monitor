import { EmbedBuilder } from "discord.js";

export function formatTimeSeconds(seconds) {
    if (seconds === 0) return "N/A";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
}

export function formatTimeMinutes(minutes) {
    if (minutes === 0) return "N/A";
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor((minutes % 60));
    return `${hrs}h ${mins}m`;
}

export async function updateStatus(printer, bot) {
    if(bot.globalConfig.disableDiscord) {
        console.log(`[INFO] Discord updates are disabled in config.json`, JSON.stringify({
            name: printer.name,
            status: printer.status,
            remainingTimeFormatted: printer.remainingTimeFormatted,
			accessToken: printer.bambu?.getAccessCode() || null,
        }));
        return;
    }; //log only if disabled
    const guild = bot.guilds.cache.get(bot.globalConfig.guildId);
    const channel = guild.channels.cache.get(bot.globalConfig.channelId); 
    //first check for past embeds
    if(!printer.embed) {
        const messages = await channel.messages.fetch({ limit: 100 });
        printer.embed = messages.filter(msg => 
            msg.author.username === bot.user.username && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title.includes(printer.name) &&
            msg.embeds[0].fields.some(field => field.name === "Status" && field.value !== "Completed" && field.value !== "Error") //only grab if last status isn't completed
        ).first();
    }
    //then add or update embed, if currently completed make a new one
    if(!printer.embed || (printer.embed.embeds[0].fields.some(field => field.name === "Status" && (field.value === "Completed" || field.value === "Error")))) {
        if(printer.status === "Printing") { //don't create unless printing
            printer.embed = await channel.send({embeds: [{ 
                title: `Printer Status ${printer.name}`, 
                description: 'Active print task',
                fields: [
                    { name: 'Status', value: `${printer.status} (${printer.print_progress}%)`, inline: true },
                    { name: 'Estimated Time', value: printer.remainingTimeFormatted, inline: true },
                ]
            }]}); 
        }
    } else {
        const newEmb = EmbedBuilder.from(printer.embed.embeds[0]);
        newEmb.setFields([
            { name: 'Status', value: `${printer.status} (${printer.print_progress}%)`, inline: true },
            { name: 'Estimated Time', value: printer.remainingTimeFormatted, inline: true },
        ]);
        if(printer.status === "Completed" || printer.status === "Error") {
            newEmb.setDescription('Print task finished at ' + new Date().toLocaleString());
        }
        printer.embed.edit({ embeds: [newEmb]});
    }

}