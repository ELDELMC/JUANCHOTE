/**
 * 🧬 SISTEMA DE CLONACIÓN DE GRUPOS
 * Base de datos liviana por grupo en ./db/grupos_clonados/
 * Cada grupo = un archivo JSON con array de JIDs
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'db', 'grupos_clonados');

/**
 * Sanitiza el nombre del grupo para usarlo como nombre de archivo
 */
function sanitizeGroupName(subject) {
  return subject
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '_')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
}

/**
 * Asegura que la carpeta ./db/grupos_clonados/ exista
 */
async function ensureDbDir() {
  await fsp.mkdir(DB_DIR, { recursive: true });
}

/**
 * Lee el archivo JSON de un grupo clonado.
 * Retorna array de JIDs o array vacío si no existe.
 */
async function leerGrupoClonado(nombreSanitizado) {
  await ensureDbDir();
  const filePath = path.join(DB_DIR, `${nombreSanitizado}.json`);
  try {
    const data = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return []; // No existe aún
  }
}

/**
 * Guarda/actualiza el archivo JSON de un grupo clonado.
 * Hace merge sin duplicados con los JIDs existentes.
 * @param {string} nombreSanitizado - Nombre del archivo (sin .json)
 * @param {string[]} nuevosJids - Array de JIDs nuevos a agregar
 * @returns {number} Total de JIDs guardados
 */
async function guardarGrupoClonado(nombreSanitizado, nuevosJids) {
  await ensureDbDir();
  const filePath = path.join(DB_DIR, `${nombreSanitizado}.json`);
  
  // Leer existentes
  const existentes = await leerGrupoClonado(nombreSanitizado);
  
  // Merge sin duplicados usando Set
  const merged = [...new Set([...existentes, ...nuevosJids])];
  
  await fsp.writeFile(filePath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`💾 [CLONADOR] Guardados ${merged.length} JIDs en ${nombreSanitizado}.json (${nuevosJids.length - (merged.length - existentes.length)} duplicados filtrados)`);
  
  return merged.length;
}

/**
 * Lista todos los archivos de grupos clonados disponibles.
 * @returns {string[]} Array de nombres (sin .json)
 */
async function listarGruposClonados() {
  await ensureDbDir();
  try {
    const files = await fsp.readdir(DB_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (e) {
    return [];
  }
}

module.exports = {
  sanitizeGroupName,
  leerGrupoClonado,
  guardarGrupoClonado,
  listarGruposClonados,
  DB_DIR
};
