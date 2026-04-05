const { getGroupSettings } = require('./settings');
const { sendStyledMessage, toFancyText } = require('./styles');

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
                
                await sendStyledMessage(sock, id, "𝙱𝚒𝚎𝚗𝚟𝚎𝚗𝚒𝚍𝚘 𝚊𝚕 𝙶𝚛𝚞𝚙𝚘", welcomeMsg);
            }
            
            if (action === 'remove' && settings.despedida) {
                let goodbyeMsg = settings.despedida
                    .replace(/@user/g, `@${num.split('@')[0]}`)
                    .replace(/@groupname/g, metadata.subject);
                    
                await sendStyledMessage(sock, id, "𝙷𝚊𝚜𝚝𝚊 𝙻𝚞𝚎𝚐𝚘", goodbyeMsg);
            }
        }
    } catch (err) {
        console.error('❌ Error en handleGroupParticipantsUpdate:', err);
    }
}

module.exports = { handleGroupParticipantsUpdate };
