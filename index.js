const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration du bot
const config = {
    token: 'MTM5MzE5NDQ3NDgzODE2MzUzNw.G3UX1o.ldqvO6i4KwegUbeJDo6sQl7A4QdBRO5oqz6V8w',
    clientId: '1393194474838163537',
    guildId: 'YOUR_GUILD_ID_HERE', // Optionnel pour les commandes globales
    prefix: '!',
    adminRole: 'Admin',
    modRole: 'Modérateur'
};

// Initialisation du client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Collections pour stocker les commandes et les données
client.commands = new Collection();
const cooldowns = new Collection();
const warnings = new Collection();
const mutedUsers = new Collection();
const autoModSettings = new Collection();

// Système de niveaux et XP
const userLevels = new Collection();

// Mots interdits pour l'auto-modération
const bannedWords = ['spam', 'toxic', 'insulte']; // Ajoutez vos mots interdits ici

// ===============================
// COMMANDES SLASH
// ===============================

const commands = [
    // Commandes de modération
    {
        name: 'ban',
        description: 'Bannir un utilisateur',
        options: [
            {
                name: 'utilisateur',
                type: 6, // USER
                description: 'Utilisateur à bannir',
                required: true
            },
            {
                name: 'raison',
                type: 3, // STRING
                description: 'Raison du bannissement',
                required: false
            }
        ]
    },
    {
        name: 'kick',
        description: 'Expulser un utilisateur',
        options: [
            {
                name: 'utilisateur',
                type: 6,
                description: 'Utilisateur à expulser',
                required: true
            },
            {
                name: 'raison',
                type: 3,
                description: 'Raison de l\'expulsion',
                required: false
            }
        ]
    },
    {
        name: 'mute',
        description: 'Rendre muet un utilisateur',
        options: [
            {
                name: 'utilisateur',
                type: 6,
                description: 'Utilisateur à rendre muet',
                required: true
            },
            {
                name: 'duree',
                type: 3,
                description: 'Durée (ex: 10m, 1h, 1d)',
                required: true
            },
            {
                name: 'raison',
                type: 3,
                description: 'Raison du mute',
                required: false
            }
        ]
    },
    {
        name: 'warn',
        description: 'Avertir un utilisateur',
        options: [
            {
                name: 'utilisateur',
                type: 6,
                description: 'Utilisateur à avertir',
                required: true
            },
            {
                name: 'raison',
                type: 3,
                description: 'Raison de l\'avertissement',
                required: true
            }
        ]
    },
    {
        name: 'warnings',
        description: 'Voir les avertissements d\'un utilisateur',
        options: [
            {
                name: 'utilisateur',
                type: 6,
                description: 'Utilisateur à vérifier',
                required: false
            }
        ]
    },
    {
        name: 'clear',
        description: 'Supprimer des messages',
        options: [
            {
                name: 'nombre',
                type: 4, // INTEGER
                description: 'Nombre de messages à supprimer (1-100)',
                required: true
            }
        ]
    },
    // Commandes fun
    {
        name: 'avatar',
        description: 'Afficher l\'avatar d\'un utilisateur',
        options: [
            {
                name: 'utilisateur',
                type: 6,
                description: 'Utilisateur dont afficher l\'avatar',
                required: false
            }
        ]
    },
    {
        name: 'meme',
        description: 'Générer un mème aléatoire'
    },
    {
        name: 'joke',
        description: 'Raconter une blague'
    },
    {
        name: 'poll',
        description: 'Créer un sondage',
        options: [
            {
                name: 'question',
                type: 3,
                description: 'Question du sondage',
                required: true
            },
            {
                name: 'option1',
                type: 3,
                description: 'Première option',
                required: true
            },
            {
                name: 'option2',
                type: 3,
                description: 'Deuxième option',
                required: true
            },
            {
                name: 'option3',
                type: 3,
                description: 'Troisième option',
                required: false
            },
            {
                name: 'option4',
                type: 3,
                description: 'Quatrième option',
                required: false
            }
        ]
    },
    // Commandes utilitaires
    {
        name: 'userinfo',
        description: 'Informations sur un utilisateur',
        options: [
            {
                name: 'utilisateur',
                type: 6,
                description: 'Utilisateur à vérifier',
                required: false
            }
        ]
    },
    {
        name: 'serverinfo',
        description: 'Informations sur le serveur'
    },
    {
        name: 'level',
        description: 'Voir votre niveau ou celui d\'un autre utilisateur',
        options: [
            {
                name: 'utilisateur',
                type: 6,
                description: 'Utilisateur à vérifier',
                required: false
            }
        ]
    },
    {
        name: 'automod',
        description: 'Configurer la modération automatique',
        options: [
            {
                name: 'action',
                type: 3,
                description: 'Action à effectuer',
                required: true,
                choices: [
                    { name: 'activer', value: 'enable' },
                    { name: 'désactiver', value: 'disable' },
                    { name: 'configurer', value: 'config' }
                ]
            }
        ]
    }
];

// ===============================
// ÉVÉNEMENTS
// ===============================

client.once('ready', async () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
    
    // Enregistrer les commandes slash
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    try {
        console.log('🔄 Enregistrement des commandes slash...');
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands }
        );
        console.log('✅ Commandes slash enregistrées avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
    }
    
    // Statut du bot
    client.user.setPresence({
        activities: [{ name: 'Modération du serveur', type: 'WATCHING' }],
        status: 'online'
    });
});

// Gestion des commandes slash
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'ban':
                await handleBan(interaction);
                break;
            case 'kick':
                await handleKick(interaction);
                break;
            case 'mute':
                await handleMute(interaction);
                break;
            case 'warn':
                await handleWarn(interaction);
                break;
            case 'warnings':
                await handleWarnings(interaction);
                break;
            case 'clear':
                await handleClear(interaction);
                break;
            case 'avatar':
                await handleAvatar(interaction);
                break;
            case 'meme':
                await handleMeme(interaction);
                break;
            case 'joke':
                await handleJoke(interaction);
                break;
            case 'poll':
                await handlePoll(interaction);
                break;
            case 'userinfo':
                await handleUserInfo(interaction);
                break;
            case 'serverinfo':
                await handleServerInfo(interaction);
                break;
            case 'level':
                await handleLevel(interaction);
                break;
            case 'automod':
                await handleAutoMod(interaction);
                break;
        }
    } catch (error) {
        console.error('Erreur lors de l\'exécution de la commande:', error);
        await interaction.reply({ content: 'Une erreur est survenue lors de l\'exécution de la commande.', ephemeral: true });
    }
});

// Auto-modération et système XP
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Système XP
    addXP(message.author.id, message.guild.id);

    // Auto-modération
    if (autoModSettings.get(message.guild.id)?.enabled) {
        await checkAutoMod(message);
    }
});

// ===============================
// FONCTIONS DE COMMANDES
// ===============================

async function handleBan(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return await interaction.reply({ content: '❌ Vous n\'avez pas la permission de bannir des membres.', ephemeral: true });
    }

    const user = interaction.options.getUser('utilisateur');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

    try {
        await interaction.guild.members.ban(user, { reason });
        
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🔨 Utilisateur banni')
            .setDescription(`**Utilisateur:** ${user.tag}\n**Raison:** ${reason}\n**Modérateur:** ${interaction.user.tag}`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        await interaction.reply({ content: '❌ Erreur lors du bannissement.', ephemeral: true });
    }
}

async function handleKick(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        return await interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'expulser des membres.', ephemeral: true });
    }

    const user = interaction.options.getUser('utilisateur');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
    const member = interaction.guild.members.cache.get(user.id);

    try {
        await member.kick(reason);
        
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('👢 Utilisateur expulsé')
            .setDescription(`**Utilisateur:** ${user.tag}\n**Raison:** ${reason}\n**Modérateur:** ${interaction.user.tag}`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        await interaction.reply({ content: '❌ Erreur lors de l\'expulsion.', ephemeral: true });
    }
}

async function handleMute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return await interaction.reply({ content: '❌ Vous n\'avez pas la permission de rendre muet des membres.', ephemeral: true });
    }

    const user = interaction.options.getUser('utilisateur');
    const duration = interaction.options.getString('duree');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
    const member = interaction.guild.members.cache.get(user.id);

    const time = parseDuration(duration);
    if (!time) {
        return await interaction.reply({ content: '❌ Format de durée invalide. Utilisez: 10m, 1h, 1d', ephemeral: true });
    }

    try {
        await member.timeout(time, reason);
        
        const embed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🔇 Utilisateur rendu muet')
            .setDescription(`**Utilisateur:** ${user.tag}\n**Durée:** ${duration}\n**Raison:** ${reason}\n**Modérateur:** ${interaction.user.tag}`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        await interaction.reply({ content: '❌ Erreur lors du mute.', ephemeral: true });
    }
}

async function handleWarn(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return await interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'avertir des membres.', ephemeral: true });
    }

    const user = interaction.options.getUser('utilisateur');
    const reason = interaction.options.getString('raison');

    if (!warnings.has(user.id)) {
        warnings.set(user.id, []);
    }

    warnings.get(user.id).push({
        reason,
        moderator: interaction.user.tag,
        date: new Date().toISOString()
    });

    const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('⚠️ Avertissement donné')
        .setDescription(`**Utilisateur:** ${user.tag}\n**Raison:** ${reason}\n**Modérateur:** ${interaction.user.tag}`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleWarnings(interaction) {
    const user = interaction.options.getUser('utilisateur') || interaction.user;
    const userWarnings = warnings.get(user.id) || [];

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`⚠️ Avertissements de ${user.tag}`)
        .setDescription(userWarnings.length === 0 ? 'Aucun avertissement.' : 
            userWarnings.map((w, i) => `**${i + 1}.** ${w.reason} - *${w.moderator}*`).join('\n'))
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleClear(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return await interaction.reply({ content: '❌ Vous n\'avez pas la permission de supprimer des messages.', ephemeral: true });
    }

    const amount = interaction.options.getInteger('nombre');
    if (amount < 1 || amount > 100) {
        return await interaction.reply({ content: '❌ Veuillez spécifier un nombre entre 1 et 100.', ephemeral: true });
    }

    try {
        await interaction.channel.bulkDelete(amount, true);
        await interaction.reply({ content: `✅ ${amount} messages supprimés.`, ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: '❌ Erreur lors de la suppression des messages.', ephemeral: true });
    }
}

async function handleAvatar(interaction) {
    const user = interaction.options.getUser('utilisateur') || interaction.user;
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Avatar de ${user.tag}`)
        .setImage(user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleMeme(interaction) {
    const memes = [
        'https://i.imgflip.com/1bij.jpg',
        'https://i.imgflip.com/1bhf.jpg',
        'https://i.imgflip.com/1bgs.jpg'
    ];

    const randomMeme = memes[Math.floor(Math.random() * memes.length)];
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('😂 Mème aléatoire')
        .setImage(randomMeme)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleJoke(interaction) {
    const jokes = [
        'Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? Parce que sinon, ils tombent dans le bateau !',
        'Que dit un escargot quand il croise une limace ? "Regarde, un nudiste !"',
        'Comment appelle-t-on un chat tombé dans un pot de peinture le jour de Noël ? Un chat-mallow !',
        'Que dit un informaticien quand il se noie ? F1 ! F1 ! F1 !',
        'Pourquoi les poissons n\'aiment pas jouer au tennis ? Parce qu\'ils ont peur du filet !'
    ];

    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('😄 Blague du jour')
        .setDescription(randomJoke)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handlePoll(interaction) {
    const question = interaction.options.getString('question');
    const option1 = interaction.options.getString('option1');
    const option2 = interaction.options.getString('option2');
    const option3 = interaction.options.getString('option3');
    const option4 = interaction.options.getString('option4');

    const options = [option1, option2, option3, option4].filter(Boolean);
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

    const embed = new EmbedBuilder()
        .setColor('#9932cc')
        .setTitle('📊 Sondage')
        .setDescription(`**${question}**\n\n${options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n')}`)
        .setFooter({ text: 'Réagissez pour voter !' })
        .setTimestamp();

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    
    for (let i = 0; i < options.length; i++) {
        await message.react(emojis[i]);
    }
}

async function handleUserInfo(interaction) {
    const user = interaction.options.getUser('utilisateur') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📋 Informations de ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'ID', value: user.id, inline: true },
            { name: 'Créé le', value: user.createdAt.toLocaleDateString('fr-FR'), inline: true },
            { name: 'Rejoint le', value: member ? member.joinedAt.toLocaleDateString('fr-FR') : 'N/A', inline: true },
            { name: 'Rôles', value: member ? member.roles.cache.map(r => r.name).join(', ') : 'N/A', inline: false }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleServerInfo(interaction) {
    const guild = interaction.guild;
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📋 Informations du serveur`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
            { name: 'Nom', value: guild.name, inline: true },
            { name: 'ID', value: guild.id, inline: true },
            { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
            { name: 'Membres', value: guild.memberCount.toString(), inline: true },
            { name: 'Créé le', value: guild.createdAt.toLocaleDateString('fr-FR'), inline: true },
            { name: 'Région', value: guild.preferredLocale, inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleLevel(interaction) {
    const user = interaction.options.getUser('utilisateur') || interaction.user;
    const userKey = `${user.id}_${interaction.guild.id}`;
    const userData = userLevels.get(userKey) || { xp: 0, level: 1 };

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`📈 Niveau de ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Niveau', value: userData.level.toString(), inline: true },
            { name: 'XP', value: userData.xp.toString(), inline: true },
            { name: 'XP pour le prochain niveau', value: (userData.level * 100 - userData.xp).toString(), inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleAutoMod(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({ content: '❌ Vous devez être administrateur pour configurer l\'auto-modération.', ephemeral: true });
    }

    const action = interaction.options.getString('action');
    const guildId = interaction.guild.id;

    switch (action) {
        case 'enable':
            autoModSettings.set(guildId, { enabled: true });
            await interaction.reply({ content: '✅ Auto-modération activée.', ephemeral: true });
            break;
        case 'disable':
            autoModSettings.set(guildId, { enabled: false });
            await interaction.reply({ content: '❌ Auto-modération désactivée.', ephemeral: true });
            break;
        case 'config':
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('⚙️ Configuration Auto-Modération')
                .setDescription(`**Statut:** ${autoModSettings.get(guildId)?.enabled ? 'Activé' : 'Désactivé'}\n**Mots interdits:** ${bannedWords.join(', ')}`)
                .setTimestamp();
            await interaction.reply({ embeds: [embed], ephemeral: true });
            break;
    }
}

// ===============================
// FONCTIONS UTILITAIRES
// ===============================

function parseDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return null;
    
    const [, amount, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    
    return parseInt(amount) * multipliers[unit];
}

function addXP(userId, guildId) {
    const userKey = `${userId}_${guildId}`;
    const userData = userLevels.get(userKey) || { xp: 0, level: 1 };
    
    userData.xp += Math.floor(Math.random() * 10) + 1;
    
    const newLevel = Math.floor(userData.xp / 100) + 1;
    if (newLevel > userData.level) {
        userData.level = newLevel;
        // Ici vous pourriez envoyer un message de level up
    }
    
    userLevels.set(userKey, userData);
}

async function checkAutoMod(message) {
    const content = message.content.toLowerCase();
    
    // Vérifier les mots interdits
    for (const word of bannedWords) {
        if (content.includes(word)) {
            await message.delete();
            await message.author.send(`⚠️ Votre message a été supprimé car il contenait un mot interdit: "${word}"`);
            return;
        }
    }
    
    // Vérifier le spam (messages identiques)
    const recent = message.channel.messages.cache
        .filter(m => m.author.id === message.author.id && m.createdTimestamp > Date.now() - 5000)
        .first(5);
    
    if (recent.length >= 3 && recent.every(m => m.content === message.content)) {
        await message.delete();
        await message.author.send('⚠️ Détection de spam. Veuillez éviter de répéter le même message.');
    }
}

// ===============================
// GESTION DES ERREURS
// ===============================

process.on('unhandledRejection', error => {
    console.error('Erreur non gérée:', error);
});

// ===============================
// CONNEXION DU BOT
// ===============================

client.login(config.token);
