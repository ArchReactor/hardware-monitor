import { BambuClient } from "bambu-node";

export default {
    create: (printerConfig) => {
        return {
            name: printerConfig.name,
            bambu: new BambuClient({
                host: printerConfig.host,
                accessToken: printerConfig.accessToken,
                serialNumber: printerConfig.serialNumber,
            }),
            status: "OFFLINE",
            statusMessage: "Unknown",
            remainingTimeInSeconds: 0,
            remainingTimeFormatted: "N/A",
        };
    },

    attachEvents: (printer, bot, config) => {
        printer.bambu.on("printer:statusUpdate", (oldStatus, newStatus) => {
            //"OFFLINE" | "FINISH" | "FAILED" | "RUNNING" | "IDLE" | "PAUSE" | "PREPARE" | "SLICING"
            console.log(`${printer.name} status has changed from ${oldStatus} to ${newStatus}!`)
            if(oldStatus !== "OFFLINE") {
                const guild = bot.guilds.cache.get(config.guildId);
                const channel = guild.channels.cache.get(config.channelId); 
                if(newStatus === "RUNNING") {
                    printer.statusMessage = `${printer.name} has started a new print job! Estimated time: ${printer.remainingTimeFormatted}`;
                } else if(newStatus === "FINISH") {
                    printer.statusMessage = `${printer.name} has finished the print job!`;
                } else if(newStatus === "FAILED") {
                    printer.statusMessage = `${printer.name} has encountered an error and the print job has failed!`;
                } else if(newStatus === "PAUSE") {
                    printer.statusMessage = `${printer.name} has been paused. Estimated time: ${printer.remainingTimeFormatted}`;
                } else if(newStatus === "IDLE") {
                    printer.statusMessage = `${printer.name} is now idle.`;
                } else if(newStatus === "PREPARE") {
                    printer.statusMessage = `${printer.name} is preparing for a new print job.`;
                } else if(newStatus === "SLICING") {
                    printer.statusMessage = `${printer.name} is slicing the model for printing.`;
                } else {
                    printer.statusMessage = `${printer.name} state changed to ${newStatus}`;
                }
                channel.send(printer.statusMessage);
            }
            if(newStatus === "RUNNING" && (oldStatus === "FAILED" || oldStatus === "FINISH" || oldStatus === "IDLE")) {
                printer.remainingTimeInSeconds = 0;
                printer.remainingTimeFormatted = "N/A";
            }
        });

        printer.bambu.on("message", (topic, key, data) => {
            //console.log(`New ${key} message!`, topic, data)
            if (key === "print") {
                if(data.mc_remaining_time) {
                    const remainingTimeInSeconds = data.mc_remaining_time;
                    const hours = Math.floor(remainingTimeInSeconds / 3600);
                    const minutes = Math.floor((remainingTimeInSeconds % 3600) / 60);
                    const seconds = remainingTimeInSeconds % 60;
                    printer.remainingTimeInSeconds = remainingTimeInSeconds;
                    printer.remainingTimeFormatted = `${hours}h ${minutes}m ${seconds}s`;
                    console.log(`${printer.name} Remaining time: ${printer.remainingTimeFormatted}`);
                }
            }
        });
    }
};

// update the speed of the auxiliary fan to 100%
//await bambo001.executeCommand(new UpdateFanCommand({ fan: Fan.AUXILIARY_FAN, speed: 100 }))

// we don't want to do anything else => we close the connection
// (can be kept open indefinitely if needed)
//await bambo001.disconnect()
