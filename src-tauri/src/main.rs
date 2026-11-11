#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use serde_json::Value;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const KEYRING_SERVICE: &str = "com.xflux.socialai";
const STORES: &[&str] = &["media", "categories", "history", "usage", "conversations", "captions", "pairings", "plans", "posts"];

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("Não foi possível localizar a pasta de dados: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Não foi possível criar a pasta de dados: {e}"))?;
    Ok(dir.join("xflux-local.sqlite3"))
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let conn = Connection::open(path).map_err(|e| format!("Não foi possível abrir o banco local: {e}"))?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         CREATE TABLE IF NOT EXISTS records (
           store TEXT NOT NULL,
           id TEXT NOT NULL,
           payload TEXT NOT NULL,
           PRIMARY KEY (store, id)
         );
         CREATE TABLE IF NOT EXISTS kv (
           key TEXT PRIMARY KEY,
           payload TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS meta (
           key TEXT PRIMARY KEY,
           value TEXT NOT NULL
         );"
    ).map_err(|e| format!("Não foi possível preparar o banco local: {e}"))?;
    Ok(conn)
}

fn valid_store(store: &str) -> bool { STORES.contains(&store) }

#[derive(Deserialize)]
struct LegacyRecord { store: String, id: String, payload: Value }
#[derive(Deserialize)]
struct LegacyKeyValue { key: String, payload: Value }

#[tauri::command]
fn local_db_init(app: AppHandle) -> Result<(), String> {
    let _ = open_database(&app)?;
    Ok(())
}

#[tauri::command]
fn local_db_import_legacy(app: AppHandle, records: Vec<LegacyRecord>, key_values: Vec<LegacyKeyValue>) -> Result<(), String> {
    let mut conn = open_database(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let already: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM meta WHERE key='indexeddb_migrated_v1')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if !already {
        for item in records {
            if !valid_store(&item.store) || item.id.is_empty() { continue; }
            let payload = serde_json::to_string(&item.payload).map_err(|e| e.to_string())?;
            tx.execute("INSERT OR IGNORE INTO records(store,id,payload) VALUES(?1,?2,?3)", params![item.store, item.id, payload]).map_err(|e| e.to_string())?;
        }
        for item in key_values {
            if let Ok(payload) = serde_json::to_string(&item.payload) {
                tx.execute("INSERT OR IGNORE INTO kv(key,payload) VALUES(?1,?2)", params![item.key, payload]).map_err(|e| e.to_string())?;
            }
        }
        tx.execute("INSERT INTO meta(key,value) VALUES('indexeddb_migrated_v1','done')", []).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
fn local_db_get_all(app: AppHandle, store: String) -> Result<Vec<Value>, String> {
    if !valid_store(&store) { return Err("Coleção local inválida.".into()); }
    let conn = open_database(&app)?;
    let mut stmt = conn.prepare("SELECT payload FROM records WHERE store=?1 ORDER BY rowid").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![store], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| {
        let raw = row.map_err(|e| e.to_string())?;
        serde_json::from_str(&raw).map_err(|e| e.to_string())
    }).collect()
}

#[tauri::command]
fn local_db_put(app: AppHandle, store: String, value: Value) -> Result<(), String> {
    if !valid_store(&store) { return Err("Coleção local inválida.".into()); }
    let id = value.get("id").and_then(Value::as_str).filter(|s| !s.is_empty()).ok_or("Registro sem identificador.")?;
    let payload = serde_json::to_string(&value).map_err(|e| e.to_string())?;
    let conn = open_database(&app)?;
    conn.execute("INSERT INTO records(store,id,payload) VALUES(?1,?2,?3) ON CONFLICT(store,id) DO UPDATE SET payload=excluded.payload", params![store,id,payload]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn local_db_put_many(app: AppHandle, store: String, values: Vec<Value>) -> Result<(), String> {
    if !valid_store(&store) { return Err("Coleção local inválida.".into()); }
    let mut conn = open_database(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for value in values {
        let id = value.get("id").and_then(Value::as_str).filter(|s| !s.is_empty()).ok_or("Registro sem identificador.")?;
        let payload = serde_json::to_string(&value).map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO records(store,id,payload) VALUES(?1,?2,?3) ON CONFLICT(store,id) DO UPDATE SET payload=excluded.payload", params![store,id,payload]).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
fn local_db_delete(app: AppHandle, store: String, id: String) -> Result<(), String> {
    if !valid_store(&store) { return Err("Coleção local inválida.".into()); }
    let conn = open_database(&app)?;
    conn.execute("DELETE FROM records WHERE store=?1 AND id=?2", params![store,id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn local_db_delete_many(app: AppHandle, store: String, ids: Vec<String>) -> Result<(), String> {
    if !valid_store(&store) { return Err("Coleção local inválida.".into()); }
    let mut conn = open_database(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for id in ids { tx.execute("DELETE FROM records WHERE store=?1 AND id=?2", params![store,id]).map_err(|e| e.to_string())?; }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
fn local_kv_set(app: AppHandle, key: String, value: Value) -> Result<(), String> {
    let payload = serde_json::to_string(&value).map_err(|e| e.to_string())?;
    let conn = open_database(&app)?;
    conn.execute("INSERT INTO kv(key,payload) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload", params![key,payload]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn local_kv_get(app: AppHandle, key: String) -> Result<Option<Value>, String> {
    let conn = open_database(&app)?;
    let raw: Option<String> = conn.query_row("SELECT payload FROM kv WHERE key=?1", params![key], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
    raw.map(|s| serde_json::from_str(&s).map_err(|e| e.to_string())).transpose()
}

#[tauri::command]
fn secure_store_credential(account: String, value: String) -> Result<(), String> {
    if account.trim().is_empty() || account.len() > 200 || value.len() > 64_000 { return Err("Dados da credencial inválidos.".into()); }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account).map_err(|e| format!("Não foi possível acessar o cofre do sistema: {e}"))?;
    entry.set_password(&value).map_err(|e| format!("Não foi possível salvar a credencial no cofre do sistema: {e}"))
}

#[tauri::command]
fn secure_read_credential(account: String) -> Result<Option<String>, String> {
    if account.trim().is_empty() || account.len() > 200 { return Err("Identificador da credencial inválido.".into()); }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account).map_err(|e| format!("Não foi possível acessar o cofre do sistema: {e}"))?;
    match entry.get_password() { Ok(value) => Ok(Some(value)), Err(keyring::Error::NoEntry) => Ok(None), Err(e) => Err(format!("Não foi possível ler a credencial do cofre do sistema: {e}")) }
}

#[tauri::command]
fn secure_delete_credential(account: String) -> Result<(), String> {
    if account.trim().is_empty() || account.len() > 200 { return Err("Identificador da credencial inválido.".into()); }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account).map_err(|e| format!("Não foi possível acessar o cofre do sistema: {e}"))?;
    match entry.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(e) => Err(format!("Não foi possível remover a credencial do cofre do sistema: {e}")) }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .invoke_handler(tauri::generate_handler![
            local_db_init, local_db_import_legacy, local_db_get_all, local_db_put,
            local_db_put_many, local_db_delete, local_db_delete_many, local_kv_set, local_kv_get,
            secure_store_credential, secure_read_credential, secure_delete_credential
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o XFLUX Social AI");
}
