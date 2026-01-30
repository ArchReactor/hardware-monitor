import { Printer } from "./printerBase.js";
import { PrinterController, P1SCommands } from 'bambu-js';
import { formatTimeSeconds } from "./helpers.js";

export class HardwareBambu extends Printer {
    constructor(printerConfig) {
        super(printerConfig);
        this.bambu = PrinterController.create({
            model: printerConfig.model,
            host: printerConfig.host,
            accessCode: printerConfig.accessToken,
            serial: printerConfig.serialNumber,
            options: { autoReconnect: true, reconnectDelay: 30000  },
        });

        // Connection events
        this.bambu.on("connect", () => {
            console.log("Printer connected");
            this.connected = true;
            this.bambu.sendCommand(P1SCommands.pushAllCommand());
        });

        this.bambu.on("disconnect", () => {
            console.log("Printer disconnected");
            this.connected = false;
        });

        this.bambu.on("end", () => {
            console.log("Connection ended");
            this.connected = false;
        });

        // State updates
        this.bambu.on("report", (state) => {
            // Handle printer state updates
            //all values: https://github.com/Doridian/OpenBambuAPI/blob/main/mqtt.md#pushingpushall
            //interesting items
            //state.print.gcode_state "OFFLINE" | "FINISH" | "FAILED" | "RUNNING" | "IDLE" | "PAUSE" | "PREPARE" | "SLICING"
            //state.print.mc_remaining_time
            //state.print.mc_percent
            let stateUpdated = false;
            const oldStatus = this.status;
            if(state.print && state.print.command && state.print.command === 'push_status'){ 
                if(state.print.gcode_state){
                    this.status = normaliseStatus(state.print.gcode_state);
                    if(this.status !== oldStatus){
                        stateUpdated = true;
                        if(oldStatus === "Printing" && (this.status === "Failed" || this.status === "Completed" || this.status === "Idle")) {
                            this.remainingTimeInSeconds = 0;
                            this.remainingTimeFormatted = "N/A";
                            this.printProgress = 100;
                            this.finishedAt = new Date().toLocaleString();
                        } else {
                            this.finishedAt = "";
                        }
                    }
                }
                if(state.print.mc_remaining_time){
                    if(this.remainingTimeInSeconds !== state.print.mc_remaining_time){
                        stateUpdated = true;
                        this.remainingTimeInSeconds = state.print.mc_remaining_time * 60; //minutes to seconds
                        this.remainingTimeFormatted = formatTimeSeconds(this.remainingTimeInSeconds);
                        console.log(`Remaining time: ${this.remainingTimeFormatted}`);
                    }
                }
                if(state.print.mc_percent){
                    if(this.printProgress !== state.print.mc_percent){
                        stateUpdated = true;
                        this.printProgress = state.print.mc_percent;
                    }
                }
            }
            if(stateUpdated){
                this.emit("statusUpdate", {
                    oldStatus: oldStatus,
                    status: this.status,
                    remainingTimeInSeconds: this.remainingTimeInSeconds,
                    remainingTimeFormatted: this.remainingTimeFormatted
                });
            }
            //console.log("Current state:", state);
        });

        // Error handling
        this.bambu.on("error", (error) => {
            this.emit("error", error);
        });

        this.bambu.connect().then(() => {
            console.log(`Connected to Bambu printer ${this.name}`);
        }).catch((error) => {
            console.error(`Failed to connect to Bambu printer ${this.name}:`, error);
        });
    }


    async updateToken(accessToken) {        
        await this.bambu.disconnect();
        this.bambu.setAccessCode(accessToken);
        await this.bambu.connect();
    }
};

function normaliseStatus(status) {
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

