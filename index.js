'use strict';

module.exports = function crystalManager(dispatch) {
    const lib = dispatch.require.library;
    dispatch.game.initialize('inventory')
    const inventory = dispatch.game.inventory;

    dispatch.dispatch.addDefinition('C_MOVE_ITEM', 999, [
        ['count', 'uint32'],
        ['packetCount', 'uint32'],
        ['gameId', 'uint64'],
        ['unk', 'uint64'],
        ['invPos', 'uint32'],
        ['unk2', 'uint32'],
        ['unk3', 'uint32'],
        ['slot', 'uint32'],
    ]);
    dispatch.dispatch.addDefinition('C_UNEQUIP_ITEM', 999, [
        ['count', 'uint32'],
        ['packetCount', 'uint32'],
        ['gameId', 'uint64'],
        ['slot', 'uint32'],
        ['unk', 'uint32'],
        ['unk2', 'uint32'],
        ['item', 'uint32'],
    ]);
    dispatch.dispatch.addDefinition('C_GET_WARE_ITEM', 999, [
        ['count', 'uint32'],
        ['packetCount', 'uint32'],
        ['gameId', 'uint64'],
        ['container', 'uint32'],
        ['offset', 'uint32'],
        ['money', 'uint64'],
        ['fromSlot', 'uint32'],
        ['dbid', 'uint64'],
        ['id', 'uint32'],
        ['amount', 'uint32'],
        ['toPocket', 'uint32'],
        ['toSlot', 'uint32'],
    ]);

    let hooks = [];

    /* Last digit is rarity grade: 
        0 common (green), 
        1 uncommon(green shiny), 
        2 rare (blue), 
        3 legendary (gold), 
        4 mythic (purple) */
    const weapCrystals = [
        292020, // Furious  DPS
        292030, // Swift    Heal
        292040, // Titanic  DPS
        292050, // Bitter   DPS
        292060, // Wrathful Tank
        292070, // Forceful DPS
        292080, // Carving  Heal
        292090, // Infused  Heal
        292100, // Relentless   Heal
        292110, // Cunning  Heal
        292120, // Salivating   Heal
    ]

    const armorCrystals = [
        292130, // Shielding
        292140, // Sneaking
        292150, // Confronting
    ]

    const enable = () => {
        hooks.push(dispatch.hook("C_RETURN_TO_LOBBY", 1, { filter: { fake: null, modified: null, silenced: null } }, async () => {
            unequipCrystals();
            await sleep(dispatch.settings.delay)
            bankCrystals();
        }))

        hooks.push(dispatch.hook("C_EXIT", 1, { filter: { fake: null, modified: null, silenced: null } }, async () => {
            unequipCrystals();
            await sleep(dispatch.settings.delay)
            bankCrystals();
        }))

        hooks.push(dispatch.hook("S_LOGIN", 14, { filter: { fake: null, modified: null, silenced: null } }, () => {
            dispatch.hookOnce("S_VISIT_NEW_SECTION", 1, async () => {
                await sleep(dispatch.settings.delay)
                unbankCrystals();
                await sleep(dispatch.settings.delay)
                equipCrystals();
            })
        }));

        dispatch.settings.enabled = true;
        dispatch.command.message("Crystal Manager enabled.");
    }

    const disable = () => {
        if (hooks.length) {
            for (let h of hooks) {
                dispatch.unhook(h);
            }
        }
        dispatch.settings.enabled = false;
        dispatch.command.message("Crystal Manager disabled.");
    }

    const unequipCrystals = () => {
        inventory.equipmentCrystals.forEach(crystal => {
            const offset = crystal % 10;
            const slot = weapCrystals.includes(crystal - offset)
                ? 1
                : armorCrystals.includes(crystal - offset)
                    ? 3
                    : null;
            if (!slot)
                return
            dispatch.send("C_UNEQUIP_ITEM", 999, {
                count: 0,
                packetCount: 0,
                gameId: lib.player.gameId,
                slot: slot,
                unk: 0,
                unk2: 0,
                item: crystal
            })
        });
    }

    const equipCrystals = () => {
        let crystals = dispatch.settings.crystals.weapon[getRole(lib.player.job)]
        crystals.forEach(crystal => equipCrystal(crystal, 1))
        crystals = dispatch.settings.crystals.armor[getRole(lib.player.job)]
        for (let i = 0; i < crystals.length; i++) {
            equipCrystal(crystals[i], 3, i)
        }
    }

    const equipCrystal = (crystal, slot, used = 0) => {
        const item = getItemFromInventory(crystal, used)
        if (!item)
            return
        dispatch.send("C_MOVE_ITEM", 999, {
            count: 0,
            packetCount: 0,
            gameId: lib.player.gameId,
            unk: 0,
            invPos: item.slot,
            unk2: 14,
            unk3: 0,
            slot: slot
        });
    }

    const bankCrystals = async () => {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(1);
        dispatch.send("C_REQUEST_CONTRACT", 1, {
            type: 26,
            target: 0,
            value: 1,
            name: "",
            data: buffer
        });
        weapCrystals.forEach(crystal => bankCrystal(crystal))
        armorCrystals.forEach(crystal => {
            for (let i = 0; i < 4; i++) {
                bankCrystal(crystal, i)
            }
        })
    }

    const bankCrystal = (crystal, used = 0) => {
        const item = getItemFromInventory(crystal, used)
        if (!item)
            return
        dispatch.send("C_PUT_WARE_ITEM", 3, {
            gameId: lib.player.gameId,
            container: 1,
            offset: 0,
            money: 0n,
            fromPocket: 0,
            fromSlot: item.slot,
            id: item.id,
            dbid: item.dbid,
            amount: 1,
            toSlot: 0
        })
    }

    const unbankCrystals = async () => {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(1);
        dispatch.send("C_REQUEST_CONTRACT", 1, {
            type: 26,
            target: 0,
            value: 1,
            name: "",
            data: buffer
        });
        dispatch.hookOnce("S_VIEW_WARE_EX", 3, (event) => {
            let crystals = dispatch.settings.crystals.weapon[getRole(lib.player.job)]
            crystals.forEach(crystal => unbankCrystal(crystal, event.items))
            crystals = dispatch.settings.crystals.armor[getRole(lib.player.job)]
            for (let i = 0; i < crystals.length; i++) {
                unbankCrystal(crystals[i], event.items, i)
            }
        })
        dispatch.send("C_VIEW_WARE", 2, {
            gameId: lib.player.gameId,
            type: 1,
            offset: 0
        })
    }

    const unbankCrystal = (crystal, items, used = 0) => {
        const item = getItemFromBank(crystal, items, used)
        if (!item)
            return
        dispatch.send("C_GET_WARE_ITEM", 999, {
            count: 0,
            packetCount: 0,
            gameId: lib.player.gameId,
            container: 1,
            offset: 0,
            money: 0,
            fromSlot: item.slot,
            dbid: item.dbid,
            id: item.id,
            amount: 1,
            toPocket: -1,
            toSlot: -1,
        });
    }

    // Workaround in case s1 does not have full perfect maxRarityGrade crystals
    const getItemFromInventory = (crystal, used = 0) => {
        const maxRarityGrade = 4;
        for (let i = maxRarityGrade; i >= 0; i--) {
            if (inventory.getTotalAmount(crystal + i) - used <= 0) {
                used -= inventory.getTotalAmount(crystal + i)
                continue;
            }
            return inventory.find(crystal + i);
        }
    }

    // Workaround in case s1 does not have full perfect maxRarityGrade crystals
    const getItemFromBank = (crystal, items, used = 0) => {
        const maxRarityGrade = 4;
        for (let i = maxRarityGrade; i >= 0; i--) {
            const result = items.find(item => item.id === (crystal + i))
            if (!result || result.amountTotal - used <= 0) {
                used -= result?.amountTotal;
                continue;
            }
            return result;
        }
    }

    const getRole = (job) => {
        switch (job) {
            case 0: return 'dps'    // Warrior
            case 1: return 'tank'   // Lancer
            case 2: return 'dps'    // Slayer
            case 3: return 'dps'    // Berserker
            case 4: return 'dps'    // Sorcerer
            case 5: return 'dps'    // Archer 
            case 6: return 'heal'   // Priest
            case 7: return 'heal'   // Myst
            case 8: return 'dps'    // Reaper
            case 9: return 'dps'    // Gunner
            case 10: return 'tank'  // Brawler
            case 11: return 'dps'   // Ninja
            case 12: return 'dps'   // Valk
            default: return 'dps'
        }
    }

    const sleep = async (ms) => {
        return new Promise((resolve) => {
            dispatch.setTimeout(resolve, ms);
        });
    }

    dispatch.command.add("cm", async (...args) => {
        switch (args[0]) {
            case "enable":
            case "disable":
                dispatch.settings.enabled ? disable() : enable();
                break;
            default: dispatch.settings.enabled ? disable() : enable();
        }
    });

    if (dispatch.settings.enabled) {
        enable();
    }
}