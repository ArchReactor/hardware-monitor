import { EmbedBuilder, AttachmentBuilder } from "discord.js";

const ONE_DAY = 24 * 60 * 60 * 1000;
const REPOST_AFTER = 4; //other messages before the card gets moved back to the bottom
const ACTIVE_TASK = 'Active print task'; //card description while the print is running

function photoFile(printer) {
    return printer.photo ? [new AttachmentBuilder(printer.photo, { name: 'snapshot.jpg' })] : [];
}

function getChannel(bot) {
    const guild = bot.guilds.cache.get(bot.globalConfig.guildId);
    return guild?.channels.cache.get(bot.globalConfig.channelId);
}

export function formatTimeSeconds(seconds) {
    if (seconds === 0) return "N/A";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
}

export async function updateStatus(printer, bot, oldStatus) {
    if(bot.globalConfig.disableDiscord) {
        console.log(`[INFO] Discord updates are disabled in config.json`, JSON.stringify({
            name: printer.name,
            status: printer.status,
            remainingTimeFormatted: printer.remainingTimeFormatted,
			finishedAt: printer.finishedAt,
        }));
        return;
    }; //log only if disabled
    const channel = getChannel(bot);
    if(!channel) {
        console.error(`[ERROR] Discord channel ${bot.globalConfig.channelId} not found, skipping update for ${printer.name}`);
        return;
    }
    const statusChanged = oldStatus !== printer.status;
    //first check for past embeds
    if(!printer.embed) {
        const messages = await channel.messages.fetch({ limit: 100 });
        printer.embed = messages.filter(msg => 
            msg.createdTimestamp >= Date.now() - ONE_DAY && //only check last 1 days
            msg.author.username === bot.user.username && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title === `Printer Status ${printer.name}` &&
            msg.embeds[0].description?.includes(ACTIVE_TASK) //only grab if still in printing
        ).first();
    }
    //then add or update embed, if currently completed make a new one
    if(!printer.embed || printer.embed.createdTimestamp < Date.now() - ONE_DAY) { //create new embed if not found or older than 1 day
        if(printer.status === "Printing") { //don't create unless printing
            printer.embed = await channel.send({embeds: [{ 
                title: `Printer Status ${printer.name}`, 
                description: ACTIVE_TASK + (printer.currentFile ? `: ${printer.currentFile}` : ''),
                fields: [
                    { name: 'Status', value: `${printer.status} (${printer.printProgress}%)`, inline: true },
                    { name: 'Estimated Time', value: printer.remainingTimeFormatted, inline: true },
                ]
            }]});
            printer.messagesSince = 0;
            printer.photo = null; //a new card starts clean, the last print's photo is not ours
        }
    } else { //do an edit
        if(statusChanged) { //progress ticks reuse the last photo, a status change earns a new one
            try {
                printer.photo = await printer.getSnapshot();
            } catch (error) {
                printer.photo = null;
                console.error(`[ERROR] No photo from ${printer.name}:`, error.message); //the update is still worth sending
            }
        }
        const newEmb = EmbedBuilder.from(printer.embed.embeds[0]);
        const finished = printer.status === "Completed" || printer.status === "Error" || printer.status === "Cancelled";
        newEmb.setFields([
            { name: 'Status', value: finished ? printer.status : `${printer.status} (${printer.printProgress}%)`, inline: true },
            finished
                ? { name: 'Time Elapsed', value: printer.elapsedFormatted, inline: true }
                : { name: 'Estimated Time', value: printer.remainingTimeFormatted, inline: true },
        ]);
        if(finished) {
            const file = newEmb.data.description?.split(`${ACTIVE_TASK}: `)[1] || 'Print task'; //keep the file name on the finished card
            newEmb.setDescription(`${file} finished at ${printer.finishedAt}`);
        } else {
            newEmb.setDescription(ACTIVE_TASK + (printer.currentFile ? `: ${printer.currentFile}` : '')); //the file name can arrive after the card
        }
        const reposting = printer.messagesSince >= REPOST_AFTER || finished; //a finish moves down too, an edit in place is too easy to miss
        if(statusChanged || reposting) { //both of these upload the photo again, so point the thumbnail at the new copy
            newEmb.setThumbnail(printer.photo ? 'attachment://snapshot.jpg' : null);
        }
        if(reposting) { //card has scrolled up, put it back at the bottom
            await printer.embed.delete().catch(() => {}); //might already be gone
            printer.embed = await channel.send({ embeds: [newEmb], files: photoFile(printer) });
            printer.messagesSince = 0;
        } else if(statusChanged) {
            await printer.embed.edit({ embeds: [newEmb], files: photoFile(printer), attachments: []}); //attachments: [] drops the previous photo
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