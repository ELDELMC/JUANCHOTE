const { getGroupSettings } = require('./settings');

/**
 * 📢 Manejador de Eventos de Grupo
 * Procesa Bienvenidas y Despedidas.
 */
async function handleGroupParticipantsUpdate(sock, anu) {
    try {
        const { id, participants, action } = anu;
        const settings = getGroupSettings(id);
        
        // Si no hay mensaje configurado para ninguna acción, salir rápido
        if (!settings.bienvenida && !settings.despedida) return;

        const metadata = await sock.groupMetadata(id);
        
        for (const num of participants) {
            if (action === 'add' && settings.bienvenida) {
                let welcomeMsg = settings.bienvenida
                    .replace(/@user/g, `@${num.split('@')[0]}`)
                    .replace(/@groupname/g, metadata.subject);
                
                await sock.sendMessage(id, { text: welcomeMsg, mentions: [num] });
            }
            
            if (action === 'remove' && settings.despedida) {
                let goodbyeMsg = settings.despedida
                    .replace(/@user/g, `@${num.split('@')[0]}`)
                    .replace(/@groupname/g, metadata.subject);
                    
                await sock.sendMessage(id, { text: goodbyeMsg, mentions: [num] });
            }
        }
    } catch (err) {
        console.error('❌ Error en handleGroupParticipantsUpdate:', err);
    }
}

module.exports = { handleGroupParticipantsUpdate };
