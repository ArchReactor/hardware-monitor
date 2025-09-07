import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
	.setName('machine-ping')
	.setDescription('Replies with Pong!');
export async function execute(interaction) {
	await interaction.reply('Pong!');
}