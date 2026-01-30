process.on('uncaughtException', (err) => {
	if(err.message.includes("connack timeout") && err.stack.includes("mqtt")) {
		return; //ignore mqtt connection timeouts, for some reason they don't get swollowed in the try catch
	}
	console.error('Caught uncaught exception, continuing:', err);
	// Perform cleanup operations if necessary
	// Log the error for later analysis
	//process.exit(1); // Exit with a non-zero code to indicate an error
});

import express from 'express';
import { readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { HardwareBambu } from './hardware/bambu.js';
import { HardwareMoonraker } from './hardware/moonraker.js';
import config from './config.json' with { type: "json" };
import { updateStatus } from './hardware/helpers.js';

//start web server
const app = express();
const port = 3043;

const publicDirectoryPath = join(process.cwd(), 'public');
app.use(express.static(publicDirectoryPath));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

app.get('/status', (req, res) => {
    const printersStatus = {};
    bot.devices.forEach((device, name) => {
        printersStatus[name] = {
            name: device.name,
            status: device.status,
            remainingTimeFormatted: device.remainingTimeFormatted,
			printProgress: device.printProgress,
			accessToken: device.bambu?.getAccessCode() || "",
			finishedAt: device.finishedAt,
			currentFile: device.currentFile,
        };
    });
    res.json({ printers: printersStatus });
});

app.post('/update-token', async (req, res) => {
	const { printerName, accessToken } = req.body;
	const printer = bot.devices.get(printerName);
	if(printer) {
		if(printer.bambu) {
			printer.updateToken(accessToken).then(() => {
				config.printers[printerName].accessToken = accessToken;
				writeFileSync(join(process.cwd(), 'config.json'), JSON.stringify(config, null, 4));
				res.json({ success: true, message: `Access token for printer ${printerName} updated.` });
			}).catch((error) => {
				res.status(400).json({ success: false, message: `Failed to update access token for printer ${printerName}: ${error.message}` });
			});
		} else {
			res.status(400).json({ success: false, message: `Printer ${printerName} is not a Bambu printer.` });
		}
	} else {
		res.status(404).json({ success: false, message: `Printer ${printerName} not found.` });
	}
});

// Create a new client instance
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
bot.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
bot.login(config.token);

bot.commands = new Collection();
bot.devices = new Collection();
bot.globalConfig = config;

const foldersPath = join(import.meta.dirname, 'commands');
const commandFolders = readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = join(foldersPath, folder);
	const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = join(commandsPath, file);
		const command = await import(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			bot.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

bot.on(Events.InteractionCreate, async interaction => {
	if (interaction.isChatInputCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			if(command.needsDevice) {
				await command.execute(interaction, bot.devices);
			} else {
				await command.execute(interaction);
			}
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
			}
		}
	} else if (interaction.isAutocomplete()) {
		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}
		try {
			if(command.needsDevice) {
				await command.autocomplete(interaction, bot.devices);
			} else {
				await command.autocomplete(interaction);
			}
		} catch (error) {
			console.error(error);
		}
	}
});

Object.entries(config.printers).forEach(([key, printerConfig]) => {
	if('serialNumber' in printerConfig) { //bambu
		const printer = new HardwareBambu(printerConfig);
		printer.on("statusUpdate", (payload) => {
			//console.log(`Printer ${printer.name} status updated:`, payload);
			updateStatus(printer, bot);
		});
		printer.on("error", (error) => {
			if(error.message.includes("EHOSTUNREACH")) {
				console.warn(`Printer ${printer.name} is unreachable. Retrying in 30s`);
			} else {
				console.error(`Printer ${printer.name} error:`, error);
			}
		});
		bot.devices.set(printer.name, printer);
	} else if('url' in printerConfig) { //moonraker
		const printer = new HardwareMoonraker(printerConfig);
		printer.on("statusUpdate", (payload) => {
			console.log(`Printer ${printer.name} status updated:`, payload);
			updateStatus(printer, bot);
		});
		bot.devices.set(printer.name, printer);
	}
});

