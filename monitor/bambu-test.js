import { BambuClient } from "bambu-node";

const printer = {
    bambu: new BambuClient({
        host: "10.42.30.174",
        accessToken: "21952516",
        serialNumber: "01S00C432300571",
    }),
    status: "OFFLINE",
    remainingTimeInSeconds: 0,
    remainingTimeFormatted: "N/A",
};

printer.bambu.on("printer:statusUpdate", (oldStatus, newStatus) => {
    console.log(`The printer's status has changed from ${oldStatus} to ${newStatus}!`)
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
            console.log(`Remaining time: ${printer.remainingTimeFormatted}`);
        }
    }
});

printer.bambu.connect();
