import { MoonrakerClient } from "moonraker-client";
import { formatTimeSeconds, updateStatus } from "./helpers.js";

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
            
            if("display_status" in data.objectNotification) {
                printer.print_progress = data.objectNotification.display_status.progress;
                setTimeRemaining({printer});
                updateStatus(printer, bot, config);
            }
            if("print_stats" in data.objectNotification){
                printer.print_duration = data.objectNotification.print_stats.print_duration;
                //setTimeRemaining({printer}); don't udpates on runtime change, only percentage
                var newstatus = normaliseStatusMoonraker(data.objectNotification.display_status.state);
                if(printer.status !== newstatus) {
                    printer.status = newstatus;
                    updateStatus(printer, bot, config);
                }
                console.log(`${printer.name} status has changed to ${printer.status}!`, data);
            }
        });
    }
};

function setTimeRemaining({printer}) {
    if(printer.print_duration && printer.print_progress) {
        printer.remainingTimeInSeconds = Math.max(0, ((printer.print_duration / printer.print_progress) - printer.print_duration));
        printer.remainingTimeFormatted = formatTimeSeconds(printer.remainingTimeInSeconds);
        console.log(`${printer.name} Remaining time: ${printer.remainingTimeFormatted}`, {
            print_progress: printer.print_progress,
            print_duration: printer.print_duration,
            remainingTimeInSeconds: printer.remainingTimeInSeconds
        });
    }

}