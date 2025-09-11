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
            const guild = bot.guilds.cache.get(config.guildId);
            const channel = guild.channels.cache.get(config.channelId); 
            if(oldStatus === newStatus) {
                //skip
            } else if(newStatus === "RUNNING") {
                printer.statusMessage = `${printer.name} has started a new print job! Estimated time: ${printer.remainingTimeFormatted}`;
                if(oldStatus !== "OFFLINE"){ channel.send(printer.statusMessage); }                
            } else if(newStatus === "FINISH") {
                printer.statusMessage = `${printer.name} has finished the print job!`;
                if(oldStatus !== "OFFLINE"){ channel.send(printer.statusMessage); }                
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
                //printer.statusMessage = `${printer.name} state changed to ${newStatus}`;
                printer.statusMessage = "Unknown";
            }
            // if(oldStatus !== "OFFLINE" && printer.statusMessage !== "Unknown") { //only annouce if it wasn't offline before and is known
            //     channel.send(printer.statusMessage);
            // }
            if(newStatus === "RUNNING" && (oldStatus === "FAILED" || oldStatus === "FINISH" || oldStatus === "IDLE")) {
                printer.remainingTimeInSeconds = 0;
                printer.remainingTimeFormatted = "N/A";
            }
        });

        printer.bambu.on("message", (topic, key, data) => {
            //console.log(`New ${key} message!`, topic, data)
            if (key === "print") {
                if(data.mc_remaining_time) {
                    const remainingTimeInMinutes = data.mc_remaining_time;
                    const hours = Math.floor(remainingTimeInMinutes / 60);
                    const minutes = Math.floor((remainingTimeInMinutes % 60));
                    printer.remainingTimeInMinutes = remainingTimeInMinutes;
                    printer.remainingTimeFormatted = `${hours}h ${minutes}m`;
                    console.log(`${printer.name} Remaining time: ${printer.remainingTimeFormatted}`, {
                        remainingTimeInMinutes: printer.remainingTimeInMinutes,
                        mc_remaining_time: data.mc_remaining_time
                    });
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
