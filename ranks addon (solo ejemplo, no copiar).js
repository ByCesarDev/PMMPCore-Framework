import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";


const RANKS = {
    owner: { id: "owner", name: "Owner", color: "§c" },
    admin: { id: "admin", name: "Admin", color: "§4" },
    mod: { id: "mod", name: "Moderator", color: "§2" },
    vip: { id: "vip", name: "VIP", color: "§6" },
    player: { id: "player", name: "Player", color: "§7" }
};

const DEFAULT_RANK = RANKS.player;



function getPlayerRank(player) {
    const tags = player.getTags();
    const rankTag = tags.find(tag => tag.startsWith("rank:"));

    if (rankTag) {
        const rankId = rankTag.split(":")[1];
        return RANKS[rankId] || DEFAULT_RANK;
    }
    return DEFAULT_RANK;
}

function setPlayerRank(targetPlayer, rankKey) {
    const newRank = RANKS[rankKey];
    if (!newRank) return;


    targetPlayer.getTags().forEach(tag => {
        if (tag.startsWith("rank:")) {
            targetPlayer.removeTag(tag);
        }
    });


    targetPlayer.addTag(`rank:${newRank.id}`);


    refreshNameTag(targetPlayer);
}

function refreshNameTag(player) {
    const rank = getPlayerRank(player);

    player.nameTag = `${rank.color}[${rank.name}] §r${player.name}`;
}


world.beforeEvents.chatSend.subscribe((event) => {
    const player = event.sender;
    const message = event.message;


    event.cancel = true;

    const rank = getPlayerRank(player);


    const formattedMessage = `§8[${rank.color}${rank.name}§8] §7${player.name}: §f${message}`;


    world.sendMessage(formattedMessage);
});


system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        refreshNameTag(player);
    }
}, 40);


world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    if (event.itemStack.typeId === "minecraft:amethyst_shard") {
        system.run(() => {
            if (player.hasTag("admin")) {
                showPlayerSelectMenu(player);
            } else {

                player.sendMessage({ translate: "ranks.error.no_perm" });
                player.playSound("note.bass");
            }
        });
    }
});

function showPlayerSelectMenu(admin) {
    const players = world.getAllPlayers();
    const form = new ActionFormData()
        .title({ translate: "ranks.menu.title" })
        .body({ translate: "ranks.menu.select_player" });

    players.forEach(p => {
        form.button(p.name);
    });

    form.show(admin).then(res => {
        if (res.canceled) return;
        const selectedPlayer = players[res.selection];
        if (selectedPlayer) {
            showRankSelectMenu(admin, selectedPlayer);
        }
    });
}

function showRankSelectMenu(admin, target) {
    const rankKeys = Object.keys(RANKS);
    const form = new ActionFormData()
        .title(target.name)
        .body({ translate: "ranks.menu.select_rank" });

    rankKeys.forEach(key => {
        const r = RANKS[key];
        form.button(`${r.color}${r.name}`);
    });

    form.show(admin).then(res => {
        if (res.canceled) return;

        const selectedKey = rankKeys[res.selection];
        const newRank = RANKS[selectedKey];


        setPlayerRank(target, selectedKey);


        admin.sendMessage({
            translate: "ranks.msg.admin_success",
            with: [target.name, newRank.name]
        });
        admin.playSound("random.orb");

        target.sendMessage({
            translate: "ranks.msg.user_notify",
            with: [newRank.name]
        });
        target.playSound("random.levelup");
    });
}