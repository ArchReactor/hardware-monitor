import { MoonrakerClient } from "moonraker-client";

export default {
    create: (printerConfig) => {
        return {
            name: printerConfig.name,
            moonraker: new MoonrakerClient({
                moonrakerUrl: printerConfig.url,
            }),
            status: "OFFLINE",
            statusMessage: "Unknown",
            remainingTimeInSeconds: 0,
            remainingTimeFormatted: "N/A",
        };
    },
    attachEvents: (printer, bot, config) => {
        printer.moonraker.subscribeToPrinterObjectStatusWithListener({"display_status": ["progress"], print_stats: ["state", "print_duration"]}, (data) => {
            //standby, printing, paused, complete, error, cancelled
            const guild = bot.guilds.cache.get(config.guildId);
            const channel = guild.channels.cache.get(config.channelId); 
            
            if("display_status" in data.objectNotification) {
                printer.print_progress = data.objectNotification.display_status.progress;
                setTimeRemaining({printer});
            }
            if("print_stats" in data.objectNotification){
                printer.print_duration = data.objectNotification.print_stats.print_duration;
                //setTimeRemaining({printer});
                if(data.objectNotification.print_stats.state === "printing") {
                    printer.status = "printing";
                    printer.statusMessage = `${printer.name} has started a new print job! Estimated time: ${printer.remainingTimeFormatted}`;
                    channel.send(printer.statusMessage);
                } else if(data.objectNotification.print_stats.state === "complete") {
                    printer.status = "complete";
                    printer.statusMessage = `${printer.name} has finished the print job!`;
                    channel.send(printer.statusMessage);
                }
            }
        });
    }
};

function setTimeRemaining({printer}) {
    if(printer.print_duration && printer.print_progress) {
        const remainingTimeInSeconds = Math.max(0, ((printer.print_duration / printer.print_progress) - printer.print_duration));
        const hours = Math.floor(remainingTimeInSeconds / 3600);
        const minutes = Math.floor((remainingTimeInSeconds % 3600) / 60);
        const seconds = remainingTimeInSeconds % 60;

        printer.remainingTimeInSeconds = remainingTimeInSeconds;
        printer.remainingTimeFormatted = `${hours}h ${minutes}m ${seconds}s`;
        console.log(`${printer.name} Remaining time: ${printer.remainingTimeFormatted}`, {
            print_progress: printer.print_progress,
            print_duration: printer.print_duration,
            remainingTimeInSeconds: printer.remainingTimeInSeconds
        });
    }

}