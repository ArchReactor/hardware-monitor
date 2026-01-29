import { SlashCommandBuilder } from 'discord.js';

export const needsDevice = true;
export const data = new SlashCommandBuilder()
	.setName('printstatus')
	.setDescription('Replies with the printer status!')
	.addStringOption(option =>
		option.setName('printer')
			.setDescription('The printer name to check')
			.setRequired(true)
			.setAutocomplete(true)
	);
export async function autocomplete(interaction, devices) {
	const focusedValue = interaction.options.getFocused();
	const choices = devices.map(d => d.name);
	const filtered = choices.filter(choice => choice.startsWith(focusedValue));
	console.log(`Autocomplete ${focusedValue}`, choices, filtered);
	await interaction.respond(
		filtered.map(choice => ({ name: choice, value: choice })),
	);
}
export async function execute(interaction, devices) {
	const devicename = interaction.options.getString('printer');
	const printer = devices.get(devicename);
	if (!printer) {
		await interaction.reply(`Device ${devicename} not found.`);
	} else if('bambu' in printer || 'moonraker' in printer) {
		if(printer.status === "Printing") {
			await interaction.reply(`${printer.name} is ${printer.status}! Progress: ${printer.print_progress}% Estimated time: ${printer.remainingTimeFormatted}`);
		} else {
			await interaction.reply(`${printer.name} is ${printer.status}`);
		}
	} else {
		await interaction.reply(`Device ${devicename} is not a printer.`);
	}
}
