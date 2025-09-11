process.on('uncaughtException', (err) => {
  console.error('Caught uncaught exception, continuing:', err);
  // Perform cleanup operations if necessary
  // Log the error for later analysis
  //process.exit(1); // Exit with a non-zero code to indicate an error
});

import { readdirSync } from 'fs';
import { join } from 'path';
import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import hardwareBambu from './hardware/bambu.js';
import hardwareMoonraker from './hardware/moonraker.js';
import config from './config.json' with { type: "json" };

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
		const printer = hardwareBambu.create(printerConfig);
		hardwareBambu.attachEvents(printer, bot, config);
		printer.bambu.connect();
		bot.devices.set(printer.name, printer);
	} else if('url' in printerConfig) { //moonraker
		const printer = hardwareMoonraker.create(printerConfig);
		hardwareMoonraker.attachEvents(printer, bot, config);
		bot.devices.set(printer.name, printer);
	}
});

