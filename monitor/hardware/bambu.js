import { BambuClient } from "bambu-node";
import { formatTimeMinutes, normaliseStatusBambu, updateStatus } from "./helpers.js";

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
            remainingTimeInSeconds: 0,
            remainingTimeFormatted: "N/A",
        };
    },

    attachEvents: (printer, bot, config) => {
        printer.bambu.on("printer:statusUpdate", async (oldStatus, newStatus) => {
            //"OFFLINE" | "FINISH" | "FAILED" | "RUNNING" | "IDLE" | "PAUSE" | "PREPARE" | "SLICING"
            
            printer.status = normaliseStatusBambu(newStatus);
            console.log(`${printer.name} status has changed from ${oldStatus} to ${newStatus}!`)
            if(oldStatus === "RUNNING" && (newStatus === "FAILED" || newStatus === "FINISH" || newStatus === "IDLE")) {
                printer.remainingTimeInSeconds = 0;
                printer.remainingTimeFormatted = "N/A";
            }
            updateStatus(printer, bot, config);
        });

        printer.bambu.on("message", (topic, key, data) => {
            //console.log(`New ${key} message!`, topic, data)
            if (key === "print") {
                if(data.mc_remaining_time) {
                    printer.remainingTimeInMinutes = data.mc_remaining_time;
                    printer.remainingTimeFormatted = formatTimeMinutes(printer.remainingTimeInMinutes);
                    console.log(`${printer.name} Remaining time: ${printer.remainingTimeFormatted}`, {
                        remainingTimeInMinutes: printer.remainingTimeInMinutes,
                        mc_remaining_time: data.mc_remaining_time
                    });
                    updateStatus(printer, bot, config);
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
