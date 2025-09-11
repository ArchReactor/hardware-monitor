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

export function normaliseStatusBambu(status) {
    switch (status) {
        case "OFFLINE":
            return "Offline";
        case "FINISH":
            return "Completed";
        case "FAILED":
            return "Error";
        case "RUNNING":
            return "Printing";
        case "IDLE":
            return "Idle";
        case "PAUSE":
            return "Paused";
        case "PREPARE":
            return "Preparing";
        case "SLICING":
            return "Slicing";
        default:
            return status;
    }
}

export function normaliseStatusMoonraker(status) {
    switch (status) {
        case "standby":
            return "Idle";
        case "printing":
            return "Printing";
        case "paused":
            return "Paused";
        case "complete":
            return "Completed";
        case "error":
            return "Error";
        case "cancelled":
            return "Cancelled";
        default:
            return status;
    }
}

export async function updateStatus(printer, bot, config) {
    const guild = bot.guilds.cache.get(config.guildId);
    const channel = guild.channels.cache.get(config.channelId); 
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
    //then add or update embed
    if(!printer.embed) {
        if(printer.status === "printing") { //don't create unless printing
            printer.embed = await channel.send({embeds: [{ 
                title: `Printer Status ${printer.name}`, 
                description: 'Active print task',
                fields: [
                    { name: 'Status', value: printer.status, inline: true },
                    { name: 'Estimated Time', value: printer.remainingTimeFormatted, inline: true },
                ]
            }]}); 
        }
    } else {
        const newEmb = EmbedBuilder.from(printer.embed.embeds[0]);
        newEmb.setFields([
            { name: 'Status', value: printer.status, inline: true },
            { name: 'Estimated Time', value: printer.remainingTimeFormatted, inline: true },
        ]);
        if(printer.status === "Completed" || printer.status === "Error") {
            newEmb.setDescription('Print task finished at ' + new Date().toLocaleString());
        }
        printer.embed.edit({ embeds: [newEmb]});
    }

}