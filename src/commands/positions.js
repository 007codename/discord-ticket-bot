const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('positions')
        .setDescription('Manage hiring positions (HR only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new hiring position (interactive)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a hiring position (interactive)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Update an existing position (interactive)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all current hiring positions')),

    async execute(interaction, client) {
        // Check if user has HR role
        const hrRoleId = client.getRole('hr');
        if (!interaction.member.roles.cache.has(hrRoleId)) {
            return await interaction.reply({
                content: '❌ You need the HR role to use this command!',
                flags: 64
            });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add':
                await this.handleAddInteractive(interaction, client);
                break;
            case 'remove':
                await this.handleRemoveInteractive(interaction, client);
                break;
            case 'update':
                await this.handleUpdateInteractive(interaction, client);
                break;
            case 'list':
                await this.handleList(interaction, client);
                break;
        }
    },

    async handleAddInteractive(interaction, client) {
        await interaction.deferReply({ flags: 64 });

        // Step 1: Select Department
        const departmentMenu = new StringSelectMenuBuilder()
            .setCustomId('select_department_add')
            .setPlaceholder('Select a department')
            .addOptions(
                Object.entries(client.config.hiring.departments).map(([dept, config]) => ({
                    label: dept,
                    value: dept,
                    emoji: config.emoji
                }))
            );

        const row = new ActionRowBuilder().addComponents(departmentMenu);

        const msg = await interaction.editReply({
            content: '**Step 1/4:** Select the department for this position:',
            components: [row]
        });

        try {
            const deptResponse = await msg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === 'select_department_add'
            });

            const selectedDept = deptResponse.values[0];
            await deptResponse.deferUpdate();

            // Step 2: Select Role
            const roles = client.positionsManager.getRolesForDepartment(selectedDept);
            
            if (roles.length === 0) {
                return await interaction.editReply({
                    content: '❌ No roles configured for this department in config.json',
                    components: []
                });
            }

            const roleMenu = new StringSelectMenuBuilder()
                .setCustomId('select_role_add')
                .setPlaceholder('Select a role')
                .addOptions(
                    roles.map(role => ({
                        label: role.name,
                        value: role.id,
                        description: `Role ID: ${role.id}`
                    }))
                );

            const roleRow = new ActionRowBuilder().addComponents(roleMenu);

            await interaction.editReply({
                content: `**Step 2/4:** Select the role:\n*Department: ${selectedDept}*`,
                components: [roleRow]
            });

            const roleResponse = await msg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === 'select_role_add'
            });

            const selectedRoleId = roleResponse.values[0];
            await roleResponse.deferUpdate();

            // Step 3: Select Status
            const statusMenu = new StringSelectMenuBuilder()
                .setCustomId('select_status_add')
                .setPlaceholder('Select hiring status')
                .addOptions([
                    {
                        label: 'Available (Urgent)',
                        value: 'online',
                        emoji: '🟢',
                        description: 'Position needs to be filled urgently'
                    },
                    {
                        label: 'Open (Moderate)',
                        value: 'idle',
                        emoji: '🟡',
                        description: 'Position is open but not urgent'
                    },
                    {
                        label: 'Filled',
                        value: 'offline',
                        emoji: '🔴',
                        description: 'Position is currently filled'
                    }
                ]);

            const statusRow = new ActionRowBuilder().addComponents(statusMenu);

            await interaction.editReply({
                content: `**Step 3/4:** Select the hiring status:\n*Department: ${selectedDept}*\n*Role: <@&${selectedRoleId}>*`,
                components: [statusRow]
            });

            const statusResponse = await msg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === 'select_status_add'
            });

            const selectedStatus = statusResponse.values[0];
            await statusResponse.deferUpdate();

            // Step 4: Ask for note (optional)
            await interaction.editReply({
                content: `**Step 4/4:** Reply with a note (optional) or type \`skip\` to finish:\n*Department: ${selectedDept}*\n*Role: <@&${selectedRoleId}>*\n*Status: ${this.getStatusDisplay(selectedStatus, client)}*\n\n*Example notes: "Unpaid", "Part-time", "Remote"*`,
                components: []
            });

            const noteResponse = await interaction.channel.awaitMessages({
                max: 1,
                time: 60000,
                filter: m => m.author.id === interaction.user.id,
                errors: ['time']
            });

            const noteMsg = noteResponse.first();
            const note = noteMsg.content.toLowerCase() === 'skip' ? null : noteMsg.content;
            
            // Delete the user's message to keep channel clean
            try {
                await noteMsg.delete();
                console.log(`✅ Deleted note message from ${noteMsg.author.tag}`);
            } catch (error) {
                console.log(`⚠️ Could not delete note message: ${error.message}`);
            }

            // Save position
            await client.positionsManager.addPosition(selectedDept, selectedRoleId, selectedStatus, note);

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Position Added Successfully')
                .addFields(
                    { name: '📂 Department', value: selectedDept, inline: true },
                    { name: '👤 Role', value: `<@&${selectedRoleId}>`, inline: true },
                    { name: '📊 Status', value: this.getStatusDisplay(selectedStatus, client), inline: true }
                )
                .setColor('#00ff00')
                .setTimestamp();

            if (note) {
                successEmbed.addFields({ name: '📝 Note', value: note, inline: false });
            }

            await interaction.editReply({
                content: null,
                embeds: [successEmbed],
                components: []
            });

        } catch (error) {
            if (error.message.includes('time')) {
                return await interaction.editReply({
                    content: '❌ Position creation timed out.',
                    components: []
                }).catch(() => {});
            }
            console.error('Error in interactive add:', error);
            await interaction.editReply({
                content: '❌ An error occurred. Please try again.',
                components: []
            }).catch(() => {});
        }
    },

    async handleRemoveInteractive(interaction, client) {
        await interaction.deferReply({ flags: 64 });

        if (!client.positionsManager.hasPositions()) {
            return await interaction.editReply({
                content: '❌ No positions available to remove. Add some first with `/positions add`'
            });
        }

        const departments = client.positionsManager.getPositionsByDepartment();
        
        const deptOptions = Array.from(departments.keys()).map(dept => ({
            label: dept,
            value: dept,
            emoji: client.positionsManager.getDepartmentEmoji(dept)
        }));

        const departmentMenu = new StringSelectMenuBuilder()
            .setCustomId('select_department_remove')
            .setPlaceholder('Select a department')
            .addOptions(deptOptions);

        const row = new ActionRowBuilder().addComponents(departmentMenu);

        const msg = await interaction.editReply({
            content: '**Step 1/2:** Select the department:',
            components: [row]
        });

        try {
            const deptResponse = await msg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === 'select_department_remove'
            });

            const selectedDept = deptResponse.values[0];
            await deptResponse.deferUpdate();

            const positions = departments.get(selectedDept);
            
            const roleMenu = new StringSelectMenuBuilder()
                .setCustomId('select_role_remove')
                .setPlaceholder('Select a role to remove')
                .addOptions(
                    positions.map(pos => {
                        const guild = interaction.guild;
                        const role = guild.roles.cache.get(pos.roleId);
                        const roleName = role ? role.name : `Unknown Role`;
                        return {
                            label: roleName,
                            value: pos.roleId,
                            description: pos.note || 'No note'
                        };
                    })
                );

            const roleRow = new ActionRowBuilder().addComponents(roleMenu);

            await interaction.editReply({
                content: `**Step 2/2:** Select the role to remove:\n*Department: ${selectedDept}*`,
                components: [roleRow]
            });

            const roleResponse = await msg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === 'select_role_remove'
            });

            const selectedRoleId = roleResponse.values[0];
            await roleResponse.deferUpdate();

            const success = await client.positionsManager.removePosition(selectedDept, selectedRoleId);

            if (success) {
                const successEmbed = new EmbedBuilder()
                    .setTitle('🗑️ Position Removed')
                    .setDescription(`Successfully removed position from **${selectedDept}**`)
                    .addFields(
                        { name: '👤 Role', value: `<@&${selectedRoleId}>`, inline: true }
                    )
                    .setColor('#ff0000')
                    .setTimestamp();

                await interaction.editReply({
                    content: null,
                    embeds: [successEmbed],
                    components: []
                });
            } else {
                await interaction.editReply({
                    content: '❌ Failed to remove position.',
                    components: []
                });
            }

        } catch (error) {
            if (error.message.includes('time')) {
                return await interaction.editReply({
                    content: '❌ Position removal timed out.',
                    components: []
                }).catch(() => {});
            }
            console.error('Error in interactive remove:', error);
            await interaction.editReply({
                content: '❌ An error occurred. Please try again.',
                components: []
            }).catch(() => {});
        }
    },

    async handleUpdateInteractive(interaction, client) {
        await interaction.deferReply({ flags: 64 });

        if (!client.positionsManager.hasPositions()) {
            return await interaction.editReply({
                content: '❌ No positions available to update. Add some first with `/positions add`'
            });
        }

        const departments = client.positionsManager.getPositionsByDepartment();
        
        const deptOptions = Array.from(departments.keys()).map(dept => ({
            label: dept,
            value: dept,
            emoji: client.positionsManager.getDepartmentEmoji(dept)
        }));

        const departmentMenu = new StringSelectMenuBuilder()
            .setCustomId('select_department_update')
            .setPlaceholder('Select a department')
            .addOptions(deptOptions);

        const row = new ActionRowBuilder().addComponents(departmentMenu);

        const msg = await interaction.editReply({
            content: '**Step 1/3:** Select the department:',
            components: [row]
        });

        try {
            const deptResponse = await msg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === 'select_department_update'
            });

            const selectedDept = deptResponse.values[0];
            await deptResponse.deferUpdate();

            const positions = departments.get(selectedDept);
            
            const roleMenu = new StringSelectMenuBuilder()
                .setCustomId('select_role_update')
                .setPlaceholder('Select a role to update')
                .addOptions(
                    positions.map(pos => {
                        const guild = interaction.guild;
                        const role = guild.roles.cache.get(pos.roleId);
                        const roleName = role ? role.name : `Unknown Role`;
                        return {
                            label: roleName,
                            value: pos.roleId,
                            description: pos.note || 'No note'
                        };
                    })
                );

            const roleRow = new ActionRowBuilder().addComponents(roleMenu);

            await interaction.editReply({
                content: `**Step 2/3:** Select the role to update:\n*Department: ${selectedDept}*`,
                components: [roleRow]
            });

            const roleResponse = await msg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === 'select_role_update'
            });

            const selectedRoleId = roleResponse.values[0];
            await roleResponse.deferUpdate();

            const statusMenu = new StringSelectMenuBuilder()
                .setCustomId('select_status_update')
                .setPlaceholder('Select new hiring status')
                .addOptions([
                    {
                        label: 'Available (Urgent)',
                        value: 'online',
                        emoji: '🟢'
                    },
                    {
                        label: 'Open (Moderate)',
                        value: 'idle',
                        emoji: '🟡'
                    },
                    {
                        label: 'Filled',
                        value: 'offline',
                        emoji: '🔴'
                    },
                    {
                        label: 'Keep current status',
                        value: 'skip_status',
                        emoji: '⏭️'
                    }
                ]);

            const statusRow = new ActionRowBuilder().addComponents(statusMenu);

            await interaction.editReply({
                content: `**Step 3/3:** Select new status or update note:\n*Department: ${selectedDept}*\n*Role: <@&${selectedRoleId}>*`,
                components: [statusRow]
            });

            const statusResponse = await msg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === 'select_status_update'
            });

            const selectedStatus = statusResponse.values[0];
            await statusResponse.deferUpdate();

            await interaction.editReply({
                content: `Reply with a new note, type \`remove\` to remove the note, or \`skip\` to keep current note:\n*Department: ${selectedDept}*\n*Role: <@&${selectedRoleId}>*`,
                components: []
            });

            const noteResponse = await interaction.channel.awaitMessages({
                max: 1,
                time: 60000,
                filter: m => m.author.id === interaction.user.id,
                errors: ['time']
            });

            const noteMsg = noteResponse.first();
            const noteInput = noteMsg.content.toLowerCase();
            let note = undefined;
            
            if (noteInput === 'remove') {
                note = null;
            } else if (noteInput !== 'skip') {
                note = noteMsg.content;
            }

            // Delete the user's message to keep channel clean
            try {
                await noteMsg.delete();
                console.log(`✅ Deleted note message from ${noteMsg.author.tag}`);
            } catch (error) {
                console.log(`⚠️ Could not delete note message: ${error.message}`);
            }

            const updates = {};
            if (selectedStatus !== 'skip_status') {
                updates.status = selectedStatus;
            }
            if (note !== undefined) {
                updates.note = note;
            }

            if (Object.keys(updates).length === 0) {
                return await interaction.editReply({
                    content: '❌ No changes were made.',
                    components: []
                });
            }

            const success = await client.positionsManager.updatePosition(selectedDept, selectedRoleId, updates);

            if (success) {
                const successEmbed = new EmbedBuilder()
                    .setTitle('🔄 Position Updated')
                    .setDescription(`Successfully updated position in **${selectedDept}**`)
                    .addFields(
                        { name: '👤 Role', value: `<@&${selectedRoleId}>`, inline: true }
                    )
                    .setColor('#ffaa00')
                    .setTimestamp();

                if (updates.status) {
                    successEmbed.addFields({
                        name: '📊 New Status',
                        value: this.getStatusDisplay(updates.status, client),
                        inline: true
                    });
                }

                if (note !== undefined) {
                    successEmbed.addFields({
                        name: '📝 New Note',
                        value: note || '*Note removed*',
                        inline: false
                    });
                }

                await interaction.editReply({
                    content: null,
                    embeds: [successEmbed],
                    components: []
                });
            } else {
                await interaction.editReply({
                    content: '❌ Failed to update position.',
                    components: []
                });
            }

        } catch (error) {
            if (error.message.includes('time')) {
                return await interaction.editReply({
                    content: '❌ Position update timed out.',
                    components: []
                }).catch(() => {});
            }
            console.error('Error in interactive update:', error);
            await interaction.editReply({
                content: '❌ An error occurred. Please try again.',
                components: []
            }).catch(() => {});
        }
    },

    async handleList(interaction, client) {
        await interaction.deferReply({ flags: 64 });

        try {
            if (!client.positionsManager.hasPositions()) {
                return await interaction.editReply({
                    content: '📋 No positions have been added yet. Use `/positions add` to add your first position!'
                });
            }

            const departments = client.positionsManager.getPositionsByDepartment();
            const embed = new EmbedBuilder()
                .setTitle('📋 Current Hiring Positions')
                .setDescription('All positions currently listed for hiring.')
                .setColor(client.config.tickets.embed.color)
                .setTimestamp();

            const emojis = client.config.hiring.emojis;

            for (const [department, positions] of departments) {
                const positionsList = positions.map(pos => {
                    const statusEmoji = emojis[pos.status] || '❓';
                    const noteText = pos.note ? ` - ${pos.note}` : '';
                    return `${statusEmoji} <@&${pos.roleId}>${noteText}`;
                }).join('\n');

                embed.addFields({
                    name: `${client.positionsManager.getDepartmentEmoji(department)} ${department}`,
                    value: positionsList,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error listing positions:', error);
            await interaction.editReply({
                content: '❌ Failed to list positions. Please try again.'
            });
        }
    },

    getStatusDisplay(status, client) {
        const emojis = client.config.hiring.emojis;
        const statusMap = {
            'online': `${emojis.online} Available (Urgent)`,
            'idle': `${emojis.idle} Open (Moderate)`,
            'offline': `${emojis.offline} Filled`
        };
        return statusMap[status] || status;
    }
};